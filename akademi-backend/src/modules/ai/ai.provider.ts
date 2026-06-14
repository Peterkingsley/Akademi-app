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
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
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
    message.includes('503') ||
    message.includes('Service Unavailable') ||
    lowerMessage.includes('unavailable') ||
    lowerMessage.includes('overloaded') ||
    lowerMessage.includes('high demand') ||
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    lowerMessage.includes('rate limit')
  );
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
}

export const aiProvider = new AIProvider();
