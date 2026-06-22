import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/env';

export interface AIRequestOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface GeneratedImageResult {
  buffer: Buffer;
  mimeType: string;
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

      for (const geminiModelName of uniqueModels(config.geminiModel)) {
        try {
          const geminiModel = geminiClient.getGenerativeModel({ model: geminiModelName });
          const result = await geminiModel.generateContent(combinedPrompt);
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
          if (!isRetryableGeminiError(errorMessage)) {
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
        const response = await anthropicClient.messages.create({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        });
        return (response.content[0] as any).text;
      } catch (error: any) {
        claudeError = error.message || 'Unknown Claude error';
        console.error('Claude API error:', error);
      }
    } else {
      claudeError = 'Claude API key is missing or invalid';
    }

    console.error('AI providers failed', { geminiError, claudeError });
    throw new Error('AI tutor is temporarily busy. Please try again in a moment.');
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

  async generateEducationalImage(prompt: string): Promise<GeneratedImageResult> {
    const key = config.geminiApiKey;
    if (!config.enableTutorImageGeneration) {
      throw new Error('Tutor image generation is disabled');
    }
    if (isPlaceholder(key)) {
      throw new Error('Gemini API key is missing or invalid');
    }

    const model = config.geminiImageModel;
    // eslint-disable-next-line no-console
    console.log(`CALLING GEMINI IMAGE API - prompt: ${prompt}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      },
    );

    const payload = await response.json() as any;
    // eslint-disable-next-line no-console
    console.log(`GEMINI RAW RESPONSE: ${JSON.stringify(payload)}`);

    if (!response.ok) {
      throw new Error(payload?.error?.message || 'Gemini image generation failed');
    }

    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part?.inlineData?.data || part?.inline_data?.data);
    const inlineData = imagePart?.inlineData || imagePart?.inline_data;
    const data = inlineData?.data;
    const mimeType = inlineData?.mimeType || inlineData?.mime_type || 'image/png';

    if (!data) {
      throw new Error('Gemini did not return an image');
    }

    return {
      buffer: Buffer.from(data, 'base64'),
      mimeType,
    };
  }
}

export const aiProvider = new AIProvider();
