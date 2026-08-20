import crypto from 'crypto';

import prisma from '../../config/db';
import { config } from '../../config/env';
import { aiProvider } from '../ai/ai.provider';
import {
  analysisPrompt, analysisSystemPrompt, blueprintPrompt, blueprintSystemPrompt,
  dialoguePrompt, dialogueSystemPrompt, fidelityPrompt, fidelitySystemPrompt,
  patchPrompt, patchSystemPrompt, PROMPT_VERSIONS,
} from './prompts';
import {
  Complexity, CriticReview, EpisodeTeachingAnalysis, EpisodeTeachingBlueprint,
  NormalizedSource, ProductionDialogueScript, TeachingEpisodeRequest, TeachingEpisodeResult,
  TeachingStageInstrumentation,
} from './types';
import {
  parseJsonObject, TeachingValidationError, validateAnalysis, validateBlueprint,
  validateCriticReview, validateDialogue,
} from './validators';

const MAX_PATCH_ATTEMPTS = 1;

function fingerprint(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function estimateTokens(sources: NormalizedSource[]) {
  return Math.ceil(sources.reduce((sum, source) => sum + source.segments.reduce((segmentSum, segment) => segmentSum + segment.text.length, 0), 0) / 4);
}

function chooseComplexity(requested: Complexity | undefined, sources: NormalizedSource[]): Complexity {
  if (requested) return requested;
  const tokens = estimateTokens(sources);
  if (tokens < 7_000) return 'FAST';
  return tokens > config.teachingSmallSourceTokenLimit ? 'DEEP' : 'STANDARD';
}

function sourceRoute(sources: NormalizedSource[]) {
  const tokens = estimateTokens(sources);
  if (tokens <= config.teachingSmallSourceTokenLimit) return 'small_direct';
  if (tokens <= config.teachingMediumSourceTokenLimit) return 'medium_long_context';
  if (tokens <= config.teachingLargeSourceTokenLimit) return 'large_section_distillation';
  return 'huge_retrieval_required';
}

function normalisePastedSources(sources: NormalizedSource[]) {
  return sources
    .filter((source) => source.source_id && source.title && source.segments?.length)
    .map((source) => ({
      ...source,
      segments: source.segments
        .filter((segment) => segment.segment_id && segment.text?.trim())
        .map((segment) => ({ ...segment, text: segment.text.trim() })),
    }))
    .filter((source) => source.segments.length);
}

export class TeachingEngineService {
  private async sourcesFor(request: TeachingEpisodeRequest): Promise<{ sources: NormalizedSource[]; materialId?: string }> {
    if (request.materialId) {
      const material = await prisma.material.findUnique({
        where: { id: request.materialId },
        select: { id: true, title: true, content: true, reader_structure: true },
      });
      if (!material) throw new Error('Material not found.');
      if (!material.content?.trim()) throw new Error('This material has no extracted text yet.');
      return {
        materialId: material.id,
        sources: [{
          source_id: `MAT_${material.id}`,
          type: 'MATERIAL',
          title: material.title,
          segments: [{ segment_id: 'SEG_001', text: material.content.trim(), location: { section: 'Extracted material' } }],
        }],
      };
    }

    const sources = normalisePastedSources(request.sources || []);
    if (!sources.length) throw new Error('Provide a material ID or at least one source with text.');
    return { sources };
  }

  private async callJson<T>(args: {
    stage: string;
    prompt: string;
    systemPrompt: string;
    model?: string;
    maxTokens: number;
    validate: (value: unknown) => T;
  }): Promise<{ artifact: T; model: string; trace: TeachingStageInstrumentation }> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await aiProvider.generateResponseWithModel(
          attempt === 0 ? args.prompt : `${args.prompt}\n\nYour prior output failed validation: ${lastError instanceof Error ? lastError.message : 'invalid JSON'}. Return a corrected JSON object only.`,
          { model: args.model || undefined, systemPrompt: args.systemPrompt, maxTokens: args.maxTokens, extendedTimeouts: true, temperature: 0.2 },
        );
        const artifact = args.validate(parseJsonObject(response.text));
        const latencyMs = Date.now() - startedAt;
        const trace: TeachingStageInstrumentation = {
          stage: args.stage as TeachingStageInstrumentation['stage'], latencyMs, model: response.model, attempt: attempt + 1,
        };
        console.info('teaching_engine.stage.completed', { stage: args.stage, latency_ms: latencyMs, model: response.model, attempt: attempt + 1 });
        return { artifact, model: response.model, trace };
      } catch (error) {
        lastError = error;
        console.warn('teaching_engine.stage.failed', { stage: args.stage, attempt: attempt + 1, message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    throw new Error(`Teaching ${args.stage} failed after bounded retries: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
  }

  private async getOrCreateAnalysis(
    sources: NormalizedSource[], materialId: string | undefined, learnerLevel: string, durationMinutes: number, focus: string | null,
  ) {
    const sourceHash = fingerprint(sources);
    const cacheKey = fingerprint({ sourceHash, learnerLevel, focus, promptVersion: PROMPT_VERSIONS.analysis });
    const cached = await prisma.teachingAnalysisCache.findUnique({ where: { cache_key: cacheKey } });
    if (cached) {
      try {
        return {
          analysis: validateAnalysis(cached.analysis, config.teachingAnalogyRiskThreshold), sourceHash, cached: true,
          trace: { stage: 'analysis' as const, latencyMs: 0, attempt: 0, cacheHit: true },
        };
      } catch (error) {
        console.warn('teaching_analysis.cache_invalid', { cacheKey, message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.info('teaching_analysis.started', { source_route: sourceRoute(sources), source_count: sources.length, source_token_estimate: estimateTokens(sources) });
    if (sourceRoute(sources) === 'huge_retrieval_required') {
      throw new Error('Source set is too large for immediate generation. Build the persistent source index before creating this episode.');
    }
    const { artifact: analysis, trace } = await this.callJson({
      stage: 'analysis', prompt: analysisPrompt(sources, learnerLevel, durationMinutes, focus), systemPrompt: analysisSystemPrompt,
      model: config.teachingAnalysisModel, maxTokens: 12_000,
      validate: (value) => validateAnalysis(value, config.teachingAnalogyRiskThreshold),
    });
    await prisma.teachingAnalysisCache.upsert({
      where: { cache_key: cacheKey },
      create: { cache_key: cacheKey, source_hash: sourceHash, material_id: materialId, learner_level: learnerLevel, user_focus: focus, prompt_version: PROMPT_VERSIONS.analysis, analysis: analysis as any },
      update: { analysis: analysis as any, material_id: materialId },
    });
    return { analysis, sourceHash, cached: false, trace };
  }

  private async repairDialogue(
    analysis: EpisodeTeachingAnalysis, blueprint: EpisodeTeachingBlueprint, dialogue: ProductionDialogueScript, review: CriticReview,
  ): Promise<{ dialogue: ProductionDialogueScript; trace: TeachingStageInstrumentation }> {
    const hardDefects = review.defects.filter((defect) => defect.severity === 'HARD_BLOCKER');
    const { artifact: replacement, trace } = await this.callJson({
      stage: 'targeted_patch', prompt: patchPrompt(analysis, blueprint, dialogue, hardDefects), systemPrompt: patchSystemPrompt,
      model: config.teachingPatchModel, maxTokens: 4_000,
      validate: (value) => {
        if (!value || typeof value !== 'object' || !Array.isArray((value as any).turns)) throw new TeachingValidationError(['Patch must return { turns: [...] }.']);
        return value as { turns: ProductionDialogueScript['turns'] };
      },
    });
    const replacements = new Map(replacement.turns.map((turn) => [turn.turn_id, turn]));
    return {
      dialogue: validateDialogue({ ...dialogue, turns: dialogue.turns.map((turn) => replacements.get(turn.turn_id) || turn) }, blueprint, analysis),
      trace,
    };
  }

  async generate(requestedBy: string, request: TeachingEpisodeRequest): Promise<TeachingEpisodeResult> {
    const generationStartedAt = Date.now();
    const { sources, materialId } = await this.sourcesFor(request);
    const learnerLevel = request.learnerLevel || 'INTELLIGENT_BEGINNER';
    const durationMinutes = Math.max(3, Math.min(30, Number(request.durationMinutes || 10)));
    const focus = request.focus?.trim() || null;
    const complexity = chooseComplexity(request.complexity, sources);
    const { analysis, sourceHash, cached, trace: analysisTrace } = await this.getOrCreateAnalysis(sources, materialId, learnerLevel, durationMinutes, focus);
    const traces: TeachingStageInstrumentation[] = [analysisTrace];

    console.info('teaching_blueprint.started', { complexity, cached_analysis: cached });
    const { artifact: blueprint, trace: blueprintTrace } = await this.callJson({
      stage: 'blueprint', prompt: blueprintPrompt(analysis, complexity), systemPrompt: blueprintSystemPrompt,
      model: config.teachingBlueprintModel, maxTokens: 8_000, validate: (value) => validateBlueprint(value, analysis),
    });
    traces.push(blueprintTrace);
    const { artifact: realizedDialogue, model: dialogueModel, trace: dialogueTrace } = await this.callJson({
      stage: 'dialogue', prompt: dialoguePrompt(analysis, blueprint), systemPrompt: dialogueSystemPrompt,
      model: config.teachingDialogueModel, maxTokens: 12_000, validate: (value) => validateDialogue(value, blueprint, analysis),
    });
    traces.push(dialogueTrace);
    let dialogue: ProductionDialogueScript = { ...realizedDialogue, generation_metadata: { ...realizedDialogue.generation_metadata, model: dialogueModel } };
    let fidelity: CriticReview | null = null;
    const fidelityHistory: CriticReview[] = [];
    let preRepairDialogue: ProductionDialogueScript | null = null;

    if (complexity !== 'FAST') {
      const runFidelity = async (candidate: ProductionDialogueScript) => this.callJson({
        stage: 'fidelity', prompt: fidelityPrompt(analysis, blueprint, candidate), systemPrompt: fidelitySystemPrompt,
        model: config.teachingFidelityModel, maxTokens: 4_000, validate: validateCriticReview,
      });
      const firstFidelity = await runFidelity(dialogue);
      fidelity = firstFidelity.artifact;
      fidelityHistory.push(fidelity);
      traces.push(firstFidelity.trace);
      for (let attempt = 0; attempt < MAX_PATCH_ATTEMPTS && fidelity.defects.some((defect) => defect.severity === 'HARD_BLOCKER'); attempt += 1) {
        preRepairDialogue = dialogue;
        const repaired = await this.repairDialogue(analysis, blueprint, dialogue, fidelity);
        dialogue = repaired.dialogue;
        traces.push(repaired.trace);
        const repairedFidelity = await runFidelity(dialogue);
        fidelity = repairedFidelity.artifact;
        fidelityHistory.push(fidelity);
        traces.push(repairedFidelity.trace);
      }
      if (fidelity.defects.some((defect) => defect.severity === 'HARD_BLOCKER')) {
        console.warn('fidelity_gate.failed', { hard_blocker_count: fidelity.defects.filter((defect) => defect.severity === 'HARD_BLOCKER').length });
        throw new Error('Teaching episode failed the semantic fidelity gate.');
      }
    }

    const episode = await prisma.teachingEpisode.create({
      data: {
        requested_by: requestedBy, material_id: materialId, source_hash: sourceHash, complexity, status: 'READY_FOR_TTS',
        request_config: { learnerLevel, durationMinutes, focus, sourceRoute: sourceRoute(sources) } as any,
        analysis: analysis as any, blueprint: blueprint as any, dialogue: dialogue as any, fidelity_review: fidelity as any,
      },
    });
    console.info('episode.ready_for_tts', { episode_id: episode.id, complexity, cached_analysis: cached, turn_count: dialogue.turns.length });
    return {
      episodeId: episode.id, analysis, blueprint, dialogue, preRepairDialogue, fidelity, fidelityHistory, cachedAnalysis: cached,
      tts_handoff: dialogue.turns.map(({ turn_id, speaker, spoken_text }) => ({ turn_id, speaker, spoken_text })),
      instrumentation: {
        totalLatencyMs: Date.now() - generationStartedAt,
        sourceRoute: sourceRoute(sources),
        sourceTokenEstimate: estimateTokens(sources),
        stages: traces,
      },
    };
  }
}

export const teachingEngineService = new TeachingEngineService();
