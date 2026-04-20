import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/env';

export interface AIRequestOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}

export class AIProvider {
  private anthropic: Anthropic | null = null;
  private lastClaudeKey: string | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private lastGeminiKey: string | null = null;

  private getAnthropic() {
    if (config.claudeApiKey && config.claudeApiKey !== this.lastClaudeKey) {
      this.anthropic = new Anthropic({ apiKey: config.claudeApiKey });
      this.lastClaudeKey = config.claudeApiKey;
    } else if (!config.claudeApiKey) {
      this.anthropic = null;
      this.lastClaudeKey = null;
    }
    return this.anthropic;
  }

  private getGemini() {
    if (config.geminiApiKey && config.geminiApiKey !== this.lastGeminiKey) {
      this.gemini = new GoogleGenerativeAI(config.geminiApiKey);
      this.lastGeminiKey = config.geminiApiKey;
    } else if (!config.geminiApiKey) {
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
      } catch (error) {
        console.error('Claude API error, falling back to Gemini:', error);
      }
    } else {
      console.warn('Claude API key missing, using Gemini fallback');
    }

    // 2. Fallback to Gemini
    const geminiClient = this.getGemini();
    if (geminiClient) {
      try {
        const geminiModel = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
      } catch (error) {
        console.error('Gemini API error:', error);
        throw new Error('Both AI providers failed or are unavailable');
      }
    }

    throw new Error('No AI provider configured or available');
  }
}

export const aiProvider = new AIProvider();
