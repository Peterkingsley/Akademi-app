import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/env';
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

function getGcpServiceAccount(): ServiceAccountKey | null {
  if (config.gcpServiceAccountJson) {
    try {
      return JSON.parse(config.gcpServiceAccountJson);
    } catch {
      // Ignore parse error
    }
  }
  const possiblePaths = [
    path.join(process.cwd(), 'gcp-service-account.json'),
    path.join(process.cwd(), '..', 'gcp-service-account.json'),
    path.join(__dirname, '..', '..', '..', 'gcp-service-account.json'),
  ];
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        // Ignore read error
      }
    }
  }
  return null;
}

function base64url(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getVertexAccessToken(sa: ServiceAccountKey): Promise<string> {
  const googleTimeMs = await new Promise<number>((resolve) => {
    https
      .get('https://www.google.com', (res) => {
        const serverDate = res.headers.date;
        resolve(serverDate ? Date.parse(serverDate) : Date.now());
      })
      .on('error', () => resolve(Date.now()));
  });

  const now = Math.floor(googleTimeMs / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now - 10,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  const signature = signer.sign(sa.private_key);
  const encodedSignature = base64url(signature);
  const jwt = `${unsignedToken}.${encodedSignature}`;

  const postData = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        port: 443,
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.access_token) {
              resolve(data.access_token);
            } else {
              reject(new Error(data.error_description || 'Failed to acquire access token'));
            }
          } catch (e: any) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function callVertexAi(
  contents: any[],
  options: { model?: string; location?: string } = {}
): Promise<string> {
  const sa = getGcpServiceAccount();
  if (!sa) {
    throw new Error('GCP Service Account credentials missing');
  }

  const token = await getVertexAccessToken(sa);
  const location = options.location || 'us-central1';
  const model = options.model || 'gemini-2.5-flash';

  const postData = JSON.stringify({ contents });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: `${location}-aiplatform.googleapis.com`,
        port: 443,
        path: `/v1/projects/${sa.project_id}/locations/${location}/publishers/google/models/${model}:generateContent`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              resolve(text);
            } else {
              reject(new Error(data.error?.message || 'Vertex AI returned empty response'));
            }
          } catch (e: any) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}


export interface AIRequestOptions {
  // A feature-level configuration override. The provider still owns fallback
  // behavior; domain modules never hard-code a model identifier.
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  // Long-form generations (multi-part assignment solves taught at full depth) need more
  // wall-clock time than a chat turn; this widens the per-provider time limits while
  // still keeping the worst case far inside the frontend's request timeout.
  extendedTimeouts?: boolean;
  // Omitted by default (uses the model's own default). Exists for callers that need explicit
  // control — e.g. an experiment sampling multiple independent runs at a fixed temperature.
  temperature?: number;
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

const OPENAI_ATTEMPT_TIMEOUT_MS = 15000;
const EXTENDED_OPENAI_ATTEMPT_TIMEOUT_MS = 45000;

function extractOpenAIText(response: any): string {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  return (response?.output || [])
    .flatMap((item: any) => item?.content || [])
    .filter((item: any) => item?.type === 'output_text' && typeof item?.text === 'string')
    .map((item: any) => item.text)
    .join('')
    .trim();
}

async function callOpenAI(
  prompt: string,
  options: AIRequestOptions,
): Promise<{ text: string; model: string }> {
  if (isPlaceholder(config.openAiApiKey)) throw new Error('OpenAI API key is missing or invalid');
  const model = options.model || config.openAiModel || 'gpt-5-nano';
  let maxOutputTokens = Math.max(options.maxTokens || 1000, 256);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await withTimeout(fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        ...(options.systemPrompt ? { instructions: options.systemPrompt } : {}),
        input: prompt,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: 'minimal' },
        text: { verbosity: 'medium' },
        store: false,
      }),
    }), options.extendedTimeouts ? EXTENDED_OPENAI_ATTEMPT_TIMEOUT_MS : OPENAI_ATTEMPT_TIMEOUT_MS, `OpenAI (${model})`);

    const body: any = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${body?.error?.message || 'request failed'}`);
    }
    const text = extractOpenAIText(body);
    const truncated = body?.status === 'incomplete' && body?.incomplete_details?.reason === 'max_output_tokens';
    if (text && !truncated) return { text, model };
    if (attempt === 0 && truncated) {
      maxOutputTokens = Math.min(maxOutputTokens * 2, MAX_OUTPUT_TOKENS_CEILING);
      continue;
    }
    if (text) return { text, model };
    throw new Error('OpenAI returned an empty response');
  }
  throw new Error('OpenAI response failed');
}


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
// Extended Gemini fallback budget for long-form calls. The OpenAI primary attempt
// is bounded separately before this fallback chain begins.
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
    const { text } = await this.generateResponseWithModel(prompt, options);
    return text;
  }

  // Same as generateResponse, but also reports which model in the fallback chain actually served
  // the request — useful for callers that want to know whether a result came from the primary
  // model or a fallback (e.g. to distinguish quality/behavior differences, or track quota usage).
  async generateResponseWithModel(
    prompt: string,
    options: AIRequestOptions = {}
  ): Promise<{ text: string; model: string }> {
    const { maxTokens = 1000, systemPrompt, extendedTimeouts = false, temperature } = options;

    // GPT-5 nano is Akademi's primary text model. Any configuration, capacity,
    // timeout, or provider error falls through to the existing Gemini chain.
    try {
      return await callOpenAI(prompt, { maxTokens, systemPrompt, extendedTimeouts, temperature });
    } catch (openAiError: any) {
      console.error('OpenAI primary provider failed; falling back to Gemini:', openAiError?.message || openAiError);
    }

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

      for (const geminiModelName of uniqueModels(options.model || config.geminiModel)) {
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
              generationConfig: {
                maxOutputTokens: attemptMaxTokens,
                ...(temperature !== undefined ? { temperature } : {}),
              },
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

          return { text, model: geminiModelName };
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

    // Try Vertex AI Service Account if Gemini client is unavailable or failed
    try {
      const combinedPrompt = systemPrompt
        ? `Instructions: ${systemPrompt}\n\nUser Question: ${prompt}`
        : prompt;
      const vertexText = await callVertexAi([
        { role: 'user', parts: [{ text: combinedPrompt }] },
      ], { model: options.model });
      if (vertexText) {
        return { text: vertexText, model: 'vertex:gemini-2.5-flash' };
      }
    } catch (vertexError: any) {
      console.error('Vertex AI fallback failed:', vertexError);
    }

    console.error('AI provider failed', { geminiError });
    if (lastErrorWasTransient) {
      throw new TransientCapacityError(`AI is temporarily out of capacity: ${geminiError}`);
    }
    throw new Error('AI is temporarily busy. Please try again in a moment.');
  }

  // Same model-fallback mechanism as generateResponse (config.geminiModel, then
  // GEMINI_FALLBACK_MODELS in order), but for calls that need to attach binary content —
  // PDF/image bytes — rather than a plain text prompt. This is the only place outside
  // generateResponse/transcribeAudio that should ever pick a Gemini model; any caller needing
  // multimodal input (PDF/image extraction, etc.) should go through this rather than
  // instantiating its own GoogleGenerativeAI client with a hardcoded model name.
  async generateMultimodalResponse(
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
    options: AIRequestOptions = {}
  ): Promise<string> {
    const { maxTokens, extendedTimeouts = false, temperature } = options;

    const geminiAttemptTimeoutMs = extendedTimeouts ? EXTENDED_GEMINI_ATTEMPT_TIMEOUT_MS : GEMINI_ATTEMPT_TIMEOUT_MS;
    const geminiTotalBudgetMs = extendedTimeouts ? EXTENDED_GEMINI_TOTAL_BUDGET_MS : GEMINI_TOTAL_BUDGET_MS;

    const geminiClient = this.getGemini();
    if (!geminiClient) {
      throw new Error('Gemini API key is missing or invalid');
    }

    let lastError: string | null = null;
    let lastErrorWasTransient = false;
    const geminiDeadline = Date.now() + geminiTotalBudgetMs;

    for (const geminiModelName of uniqueModels(config.geminiModel)) {
      const remainingBudget = geminiDeadline - Date.now();
      if (remainingBudget <= 0) {
        lastError = lastError || 'Gemini budget exhausted before a model could respond';
        break;
      }

      try {
        const generationConfig =
          maxTokens || temperature !== undefined
            ? {
                ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
                ...(temperature !== undefined ? { temperature } : {}),
              }
            : undefined;
        const geminiModel = geminiClient.getGenerativeModel({
          model: geminiModelName,
          ...(generationConfig ? { generationConfig } : {}),
        });
        const result = await withTimeout(
          geminiModel.generateContent(parts),
          Math.min(geminiAttemptTimeoutMs, remainingBudget),
          `Gemini (${geminiModelName})`
        );
        const text = result.response.text().trim();
        if (!text) throw new Error('Gemini returned empty response');
        return text;
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown Gemini error';
        lastError = errorMessage;
        console.error(`Gemini API error on ${geminiModelName}:`, error);
        if (!(error instanceof ProviderTimeoutError) && !isRetryableGeminiError(errorMessage)) {
          lastErrorWasTransient = false;
          break;
        }
        lastErrorWasTransient = true;
        await sleep(350);
      }
    }

    // Try Vertex AI Service Account if Gemini client is unavailable or failed
    try {
      const vertexParts = parts.map((part) => {
        if ('text' in part) return { text: part.text };
        return {
          inlineData: {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          },
        };
      });
      const vertexText = await callVertexAi([{ role: 'user', parts: vertexParts }]);
      if (vertexText) return vertexText;
    } catch (vertexError: any) {
      console.error('Vertex AI multimodal fallback failed:', vertexError);
    }

    console.error('Gemini multimodal request failed', { lastError });
    if (lastErrorWasTransient) {
      throw new TransientCapacityError(`AI is temporarily out of capacity: ${lastError}`);
    }
    throw new Error(lastError || 'Gemini multimodal request failed.');
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
