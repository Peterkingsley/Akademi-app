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

function isPlaceholder(key: string | undefined | null): boolean {
  if (!key) return true;
  const lowerKey = key.toLowerCase();
  return PLACEHOLDER_KEYWORDS.some(keyword => lowerKey.includes(keyword));
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
      model = 'claude-sonnet-4-20250514',
      maxTokens = 1000,
      systemPrompt,
    } = options;

    let claudeError: string | null = null;
    let geminiError: string | null = null;

    const anthropicClient = this.getAnthropic();

    // 1. Try Claude if API key is present
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
        console.error('Claude API error, falling back to Gemini:', error);
      }
    } else {
      claudeError = 'Claude API key is missing or invalid';
      console.warn('Claude API key missing or placeholder, using Gemini fallback');
    }

    // 2. Fallback to Gemini
    const geminiClient = this.getGemini();
    if (geminiClient) {
      try {
        const geminiModel = geminiClient.getGenerativeModel({ model: config.geminiModel });

        const combinedPrompt = systemPrompt
          ? `Instructions: ${systemPrompt}\n\nUser Question: ${prompt}`
          : prompt;

        const result = await geminiModel.generateContent(combinedPrompt);
        const response = await result.response;
        const text = response.text();

        if (!text) {
          throw new Error('Gemini returned empty response');
        }

        return text;
      } catch (error: any) {
        geminiError = error.message || 'Unknown Gemini error';
        console.error('Gemini API error:', error);
        throw new Error(`AI providers failed: [Claude: ${claudeError}] [Gemini: ${geminiError}]`);
      }
    } else {
      geminiError = 'Gemini API key is missing or invalid';
    }

    throw new Error(`No AI provider configured or available. [Claude: ${claudeError}] [Gemini: ${geminiError}]`);
  }
}

export const aiProvider = new AIProvider();
