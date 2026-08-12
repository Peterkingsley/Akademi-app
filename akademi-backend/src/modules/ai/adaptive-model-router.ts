import { config } from '../../config/env';
import { aiProvider } from './ai.provider';

export type AdaptiveModelPurpose = 'tutor' | 'planner' | 'verifier';

export interface AdaptiveGenerationOptions {
  systemPrompt: string;
  maxTokens?: number;
  complexity?: number;
  purpose?: AdaptiveModelPurpose;
  extendedTimeouts?: boolean;
  temperature?: number;
}

function selectedModel(purpose: AdaptiveModelPurpose, complexity: number) {
  if (purpose === 'planner') {
    return process.env.OPENAI_TUTOR_PLANNER_MODEL?.trim() || config.openAiModel;
  }
  if (purpose === 'verifier') {
    return process.env.OPENAI_TUTOR_VERIFIER_MODEL?.trim()
      || process.env.OPENAI_TUTOR_COMPLEX_MODEL?.trim()
      || config.openAiModel;
  }
  if (complexity >= 4) {
    return process.env.OPENAI_TUTOR_COMPLEX_MODEL?.trim() || config.openAiModel;
  }
  return config.openAiModel;
}

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

async function callOpenAIWithModel(
  model: string,
  prompt: string,
  options: AdaptiveGenerationOptions,
) {
  if (!config.openAiApiKey) throw new Error('OpenAI API key is unavailable for routed model call');

  const controller = new AbortController();
  const timeoutMs = options.extendedTimeouts ? 60000 : 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const complexity = Math.max(1, Math.min(5, options.complexity || 1));
    const effort = options.purpose === 'planner'
      ? 'minimal'
      : complexity >= 4
        ? 'medium'
        : 'minimal';

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        instructions: options.systemPrompt,
        input: prompt,
        max_output_tokens: Math.max(options.maxTokens || 1000, 128),
        reasoning: { effort },
        text: { verbosity: complexity >= 4 ? 'medium' : 'low' },
        store: false,
        ...(typeof options.temperature === 'number' ? { temperature: options.temperature } : {}),
      }),
    });
    const body: any = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${body?.error?.message || 'routed request failed'}`);
    }
    const text = extractOpenAIText(body);
    if (!text) throw new Error('Routed OpenAI call returned an empty response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAdaptiveResponse(
  prompt: string,
  options: AdaptiveGenerationOptions,
): Promise<string> {
  const purpose = options.purpose || 'tutor';
  const complexity = Math.max(1, Math.min(5, options.complexity || 1));
  const model = selectedModel(purpose, complexity);

  // Existing provider keeps the production fallback chain (OpenAI -> Gemini). Only bypass it
  // when an operator explicitly configured a different model for complex tutoring or verification.
  if (!model || model === config.openAiModel) {
    return aiProvider.generateResponse(prompt, {
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens,
      extendedTimeouts: options.extendedTimeouts,
      temperature: options.temperature,
    });
  }

  try {
    return await callOpenAIWithModel(model, prompt, options);
  } catch (error) {
    console.warn('adaptive_model_route_failed_falling_back', { model, purpose, error });
    return aiProvider.generateResponse(prompt, {
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens,
      extendedTimeouts: options.extendedTimeouts,
      temperature: options.temperature,
    });
  }
}
