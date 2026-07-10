import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/env';

export interface AIRequestOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}

const PLACEHOLDER_KEYWORDS = [
  'your_',
  'replace_me',
  'api_key',
  'dummy',
  'sk-placeholder',
];

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
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

// Bounds so a slow/hanging provider can't silently eat the client's request
// timeout - without these, a single overloaded Gemini model or a stalled
// Claude call had no cap and could stall the response past the 90s the
// frontend waits, which surfaces as a network error with no status at all.
const GEMINI_ATTEMPT_TIMEOUT_MS = 8000;
const GEMINI_TOTAL_BUDGET_MS = 15000;
const CLAUDE_TIMEOUT_MS = 15000;

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

export class AIProvider {
  private anthropic: Anthropic | null = null;
  private lastClaudeKey: string | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private lastGeminiKey: string | null = null;

  private getAnthropic() {
    const key = config.claudeApiKey;
    if (key && !isPlaceholder(key) && key !== this.lastClaudeKey) {
      this.anthropic = new Anthropic({ apiKey: key });
      this.lastClaudeKey = key;
    } else if (!key || isPlaceholder(key)) {
      this.anthropic = null;
      this.lastClaudeKey = null;
    }
    return this.anthropic;
  }

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
    const {
      model = DEFAULT_CLAUDE_MODEL,
      maxTokens = 1000,
      systemPrompt,
    } = options;

    let claudeError: string | null = null;
    let geminiError: string | null = null;

    const geminiClient = this.getGemini();
    if (geminiClient) {
      const combinedPrompt = systemPrompt
        ? `Instructions: ${systemPrompt}\n\nUser Question: ${prompt}`
        : prompt;

      const geminiDeadline = Date.now() + GEMINI_TOTAL_BUDGET_MS;

      for (const geminiModelName of uniqueModels(config.geminiModel)) {
        const remainingBudget = geminiDeadline - Date.now();
        if (remainingBudget <= 0) {
          geminiError = geminiError || 'Gemini budget exhausted before a model could respond';
          break;
        }

        try {
          const geminiModel = geminiClient.getGenerativeModel({ model: geminiModelName });
          const result = await withTimeout(
            geminiModel.generateContent(combinedPrompt),
            Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remainingBudget),
            `Gemini (${geminiModelName})`
          );
          const response = await result.response;
          const text = response.text();

          if (!text) {
            throw new Error('Gemini returned empty response');
          }

          return text;
        } catch (error: any) {
          const errorMessage = error.message || 'Unknown Gemini error';
          geminiError = errorMessage;
          console.error(`Gemini API error on ${geminiModelName}:`, error);
          if (!(error instanceof ProviderTimeoutError) && !isRetryableGeminiError(errorMessage)) {
            break;
          }
          await sleep(350);
        }
      }
    } else {
      geminiError = 'Gemini API key is missing or invalid';
    }

    const anthropicClient = this.getAnthropic();
    if (anthropicClient) {
      try {
        const response = await anthropicClient.messages.create(
          {
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
          },
          { timeout: CLAUDE_TIMEOUT_MS, maxRetries: 0 }
        );
        return (response.content[0] as any).text;
      } catch (error: any) {
        claudeError = error.message || 'Unknown Claude error';
        console.error('Claude API error:', error);
      }
    } else {
      claudeError = 'Claude API key is missing or invalid';
    }

    console.error('AI providers failed', { geminiError, claudeError });
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
        const model = geminiClient.getGenerativeModel({ model: 'embedding-001' });
        const result = await model.embedContent(text.slice(0, 8000));
        const values = result.embedding.values;
        if (values?.length) return values;
      } catch (error) {
        console.error('Gemini embedding failed, using deterministic fallback:', error);
      }
    }

    return hashTextEmbedding(text);
  }

}

export const aiProvider = new AIProvider();
