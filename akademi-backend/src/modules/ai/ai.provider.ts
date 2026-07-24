import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/env';

export interface AIRequestOptions {
  maxTokens?: number;
  systemPrompt?: string;
  // Long-form generations (multi-part assignment solves taught at full depth) need more
  // wall-clock time than a chat turn; this widens the per-provider time limits while
  // still keeping the worst case far inside the frontend's request timeout.
  extendedTimeouts?: boolean;
}

const PLACEHOLDER_KEYWORDS = [
  'your_',
  'replace_me',
  'api_key',
  'dummy',
  'sk-placeholder',
];

const GEMINI_FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
];


function isPlaceholder(key: string | undefined | null): boolean {
  if (!key) return true;
  const lowerKey = key.toLowerCase();
  return PLACEHOLDER_KEYWORDS.some(keyword => lowerKey.includes(keyword));
}

function uniqueModels(primary?: string) {
  return Array.from(new Set([primary, ...GEMINI_FALLBACK_MODELS].filter(Boolean))) as string[];
}

function isRetryableGeminiError(message: string) {
  const lowerMessage = message.toLowerCase();
  return (
    message.includes('404') ||
    message.includes('503') ||
    message.includes('Service Unavailable') ||
    lowerMessage.includes('not found') ||
    lowerMessage.includes('not supported') ||
    lowerMessage.includes('unavailable') ||
    lowerMessage.includes('overloaded') ||
    lowerMessage.includes('high demand') ||
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    lowerMessage.includes('rate limit')
  );
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Bounds so a slow/hanging model can't silently eat the client's request
// timeout - without this, a single overloaded Gemini model had no cap and
// could stall the response past the 90s the frontend waits, which surfaces
// as a network error with no status at all.
const GEMINI_ATTEMPT_TIMEOUT_MS = 8000;
const GEMINI_TOTAL_BUDGET_MS = 25000;

// Extended limits for long-form answers (see AIRequestOptions.extendedTimeouts): a
// several-thousand-token assignment solve simply cannot finish inside 8s, and killing it
// mid-generation is what surfaced as "AI is temporarily busy" on the assignment pager.
// Gemini is the sole provider now, so this budget alone has to cover the whole call -
// 60s leaves a healthy 30s margin under the frontend's 90s wait for network/DB overhead.
const EXTENDED_GEMINI_ATTEMPT_TIMEOUT_MS = 20000;
const EXTENDED_GEMINI_TOTAL_BUDGET_MS = 60000;

// Gemini truncates output at maxOutputTokens without erroring - response.text() still
// returns the partial text, ending mid-sentence, and a naive caller serves it as if it
// were complete. This ceiling bounds a single "give it more room" retry on the SAME model
// when that happens, instead of silently accepting a cut-off answer.
const MAX_OUTPUT_TOKENS_CEILING = 16000;

class ProviderTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ProviderTimeoutError(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function normalizeVector(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return values;
  return values.map(value => Number((value / magnitude).toFixed(6)));
}

function hashTextEmbedding(text: string, dimensions = 256) {
  const vector = new Array(dimensions).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];

  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % dimensions;
    vector[index] += 1;
  }

  return normalizeVector(vector);
}

export class TransientCapacityError extends Error {
  transient: boolean;
  constructor(message: string) {
    super(message);
    this.name = 'TransientCapacityError';
    this.transient = true;
  }
}

export class AIProvider {
  private gemini: GoogleGenerativeAI | null = null;
  private lastGeminiKey: string | null = null;

  private getGemini() {
    const key = config.geminiApiKey;
    if (key && !isPlaceholder(key) && key !== this.lastGeminiKey) {
      this.gemini = new GoogleGenerativeAI(key);
      this.lastGeminiKey = key;
    } else if (!key || isPlaceholder(key)) {
      this.gemini = null;
      this.lastGeminiKey = null;
    }
    return this.gemini;
  }

  async generateResponse(
    prompt: string,
    options: AIRequestOptions = {}
  ): Promise<string> {
    const { maxTokens = 1000, systemPrompt, extendedTimeouts = false } = options;

    const geminiAttemptTimeoutMs = extendedTimeouts ? EXTENDED_GEMINI_ATTEMPT_TIMEOUT_MS : GEMINI_ATTEMPT_TIMEOUT_MS;
    const geminiTotalBudgetMs = extendedTimeouts ? EXTENDED_GEMINI_TOTAL_BUDGET_MS : GEMINI_TOTAL_BUDGET_MS;

    let geminiError: string | null = null;
    let lastErrorWasTransient = false;

    const geminiClient = this.getGemini();
    if (geminiClient) {
      const combinedPrompt = systemPrompt
        ? `Instructions: ${systemPrompt}\n\nUser Question: ${prompt}`
        : prompt;

      const geminiDeadline = Date.now() + geminiTotalBudgetMs;

      for (const geminiModelName of uniqueModels(config.geminiModel)) {
        const remainingBudget = geminiDeadline - Date.now();
        if (remainingBudget <= 0) {
          geminiError = geminiError || 'Gemini budget exhausted before a model could respond';
          break;
        }

        try {
          let attemptMaxTokens = maxTokens;
          let text = '';
          let wasTruncated = false;

          // At most one retry per model: if Gemini cuts the answer off at maxOutputTokens,
          // give it a bigger budget once before moving on - most truncations only need a
          // little more room, and this stays bounded instead of looping indefinitely.
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const attemptRemainingBudget = geminiDeadline - Date.now();
            if (attemptRemainingBudget <= 0) break;

            const geminiModel = geminiClient.getGenerativeModel({
              model: geminiModelName,
              generationConfig: { maxOutputTokens: attemptMaxTokens },
            });
            const result = await withTimeout(
              geminiModel.generateContent(combinedPrompt),
              Math.min(geminiAttemptTimeoutMs, attemptRemainingBudget),
              `Gemini (${geminiModelName})`
            );
            const response = await result.response;
            text = response.text();
            wasTruncated = response.candidates?.[0]?.finishReason === 'MAX_TOKENS';

            if (!wasTruncated || attemptMaxTokens >= MAX_OUTPUT_TOKENS_CEILING) break;

            console.error(
              `Gemini (${geminiModelName}) truncated at maxOutputTokens=${attemptMaxTokens}; retrying with a larger budget`
            );
            attemptMaxTokens = Math.min(attemptMaxTokens * 2, MAX_OUTPUT_TOKENS_CEILING);
          }

          if (!text) {
            throw new Error('Gemini returned empty response');
          }

          if (wasTruncated) {
            console.error(
              `Gemini (${geminiModelName}) response still truncated at maxOutputTokens=${attemptMaxTokens} after retry`
            );
          }

          return text;
        } catch (error: any) {
          const errorMessage = error.message || 'Unknown Gemini error';
          geminiError = errorMessage;
          console.error(`Gemini API error on ${geminiModelName}:`, error);
          if (!(error instanceof ProviderTimeoutError) && !isRetryableGeminiError(errorMessage)) {
            lastErrorWasTransient = false;
            break;
          }
          lastErrorWasTransient = true;
          await sleep(350);
        }
      }
    } else {
      geminiError = 'Gemini API key is missing or invalid';
    }

    console.error('AI provider failed', { geminiError });
    if (lastErrorWasTransient) {
      throw new TransientCapacityError(`AI is temporarily out of capacity: ${geminiError}`);
    }
    throw new Error('AI is temporarily busy. Please try again in a moment.');
  }

  async transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
    const geminiClient = this.getGemini();
    if (!geminiClient) {
      throw new Error('Voice solve is unavailable right now. Please use text or photo for now.');
    }

    let lastError: string | null = null;

    for (const geminiModelName of uniqueModels(config.geminiModel)) {
      try {
        const geminiModel = geminiClient.getGenerativeModel({ model: geminiModelName });
        const result = await geminiModel.generateContent([
          {
            text:
              'Transcribe this student audio into clean plain text. Keep the academic question exactly as spoken, lightly clean filler words only when they do not change meaning, and return only the transcript with no commentary.',
          },
          {
            inlineData: {
              mimeType,
              data: buffer.toString('base64'),
            },
          },
        ]);

        const response = await result.response;
        const text = response.text().trim();

        if (!text) {
          throw new Error('Gemini returned empty transcript');
        }

        return text;
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown Gemini transcription error';
        lastError = errorMessage;
        console.error(`Gemini transcription error on ${geminiModelName}:`, error);
        if (!isRetryableGeminiError(errorMessage)) {
          break;
        }
        await sleep(350);
      }
    }

    console.error('Audio transcription failed', { lastError });
    throw new Error('Could not transcribe that recording. Please try again or type the question instead.');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const geminiClient = this.getGemini();

    if (geminiClient) {
      try {
        const model = geminiClient.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent(text.slice(0, 8000));
        const values = result.embedding.values;
        if (values?.length) return values;
      } catch (error: any) {
        const errorMessage = error?.message || '';
        if (isRetryableGeminiError(errorMessage)) {
          throw new TransientCapacityError(`AI is temporarily out of capacity: ${errorMessage}`);
        }
        console.error('Gemini embedding failed, using deterministic fallback:', error);
      }
    }

    return hashTextEmbedding(text);
  }

}

export const aiProvider = new AIProvider();
