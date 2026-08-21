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
  AnalysisCacheStatus, Complexity, CriticReview, EpisodeTeachingAnalysis, EpisodeTeachingBlueprint,
  NormalizedSource, ProductionDialogueScript, TeachingEpisodeRequest, TeachingEpisodeResult,
  TeachingStageInstrumentation,
} from './types';
import {
  parseJsonObject, TeachingValidationError, validateAnalysis, validateBlueprint,
  validateCriticReview, validateDialogue,
} from './validators';
import {
  ANALYSIS_STRUCTURED_OUTPUT,
  BLUEPRINT_STRUCTURED_OUTPUT,
  DIALOGUE_STRUCTURED_OUTPUT,
  EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION,
  EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION,
  EPISODE_TEACHING_BLUEPRINT_SCHEMA_VERSION,
  FIDELITY_STRUCTURED_OUTPUT,
  PRODUCTION_DIALOGUE_SCHEMA_VERSION,
} from './schema';
import { validateConversationalQuality } from './conversational-quality.validator';
import { repairHost1ValidationOpenings } from './host1-opening-repair';
import { validateBlueprintQuality } from './blueprint-quality.validator';
import { detectPossibleCertaintyDrift } from './certainty-drift.validator';

const MAX_PATCH_ATTEMPTS = 1;

export class TeachingCallFailureError extends Error {
  constructor(
    message: string,
    public readonly diagnostic: Record<string, unknown>,
    /** Returned only to the explicitly enabled development validation harness. */
    public readonly rawResponse?: string,
  ) {
    super(message);
    this.name = 'TeachingCallFailureError';
  }
}

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

function cacheCompatibilityStatus(value: unknown): Exclude<AnalysisCacheStatus, 'HIT_VALID' | 'MISS'> {
  const cached = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (cached.schema_version !== EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION) return 'HIT_INVALIDATED_SCHEMA';
  return 'HIT_INVALIDATED_CONTRACT';
}

function unknownReferenceIds(issues: string[]) {
  return [...new Set(issues.flatMap((issue) => [...issue.matchAll(/UNKNOWN_[A-Z_]+_REFERENCE: .*? references ([^,\s]+)/g)].map((match) => match[1])))];
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
    structuredOutput?: { name: string; schema: Readonly<Record<string, unknown>> };
  }): Promise<{ artifact: T; model: string; trace: TeachingStageInstrumentation }> {
    let lastError: unknown;
    let validationFailureReason: string | undefined;
    let invalidReferenceIds: string[] | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await aiProvider.generateResponseWithModel(
          attempt === 0 ? args.prompt : `${args.prompt}\n\nYour prior output failed validation: ${lastError instanceof Error ? lastError.message : 'invalid JSON'}. Return a corrected JSON object only.`,
          { model: args.model || undefined, systemPrompt: args.systemPrompt, maxTokens: args.maxTokens, extendedTimeouts: true, temperature: 0.2, jsonSchema: args.structuredOutput },
        );
        const parsed = parseJsonObject(response.text);
        let artifact: T;
        try {
          artifact = args.validate(parsed);
        } catch (error) {
          const issues = error instanceof TeachingValidationError ? error.issues : [error instanceof Error ? error.message : 'Unknown validation error'];
          const diagnostic = {
            stage: args.stage === 'analysis' ? 'CALL_1' : args.stage,
            model: response.model,
            expected_schema_version: args.stage === 'analysis'
              ? EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION
              : args.stage === 'blueprint' ? EPISODE_TEACHING_BLUEPRINT_SCHEMA_VERSION
                : args.stage === 'dialogue' ? PRODUCTION_DIALOGUE_SCHEMA_VERSION : undefined,
            actual_schema_version: Object.prototype.hasOwnProperty.call(parsed, 'schema_version') ? parsed.schema_version : undefined,
            top_level_keys: Object.keys(parsed).sort(),
            concept_classifications: Array.isArray(parsed.concepts)
              ? parsed.concepts.slice(0, 12).map((concept) => {
                const value = concept && typeof concept === 'object' ? concept as Record<string, unknown> : {};
                return {
                  concept_id: value.concept_id,
                  tier: value.tier,
                  epistemic_status: value.epistemic_status,
                  teaching_priority: value.teaching_priority,
                };
              })
              : undefined,
            validation_issues: issues,
            provider_response: response.metadata || { provider: 'unknown' },
          };
          validationFailureReason = issues.join('; ');
          invalidReferenceIds = unknownReferenceIds(issues);
          if (args.stage === 'blueprint') {
            console.warn('teaching_blueprint.validation_failed', {
              blueprint_validation_failure_reason: validationFailureReason,
              retry_count: attempt + 1,
              unknown_reference_ids: invalidReferenceIds,
            });
          }
          // The raw text is deliberately not logged. The development-only
          // harness can persist it locally for the Raft fixture if enabled.
          console.warn('teaching_engine.validation_failed', diagnostic);
          throw new TeachingCallFailureError(issues.join('; '), diagnostic, response.text);
        }
        const latencyMs = Date.now() - startedAt;
        const trace: TeachingStageInstrumentation = {
          stage: args.stage as TeachingStageInstrumentation['stage'], latencyMs, model: response.model, attempt: attempt + 1,
          tokenUsage: response.metadata?.tokenUsage, retryCount: attempt,
          validationFailureReason, unknownReferenceIds: invalidReferenceIds,
        };
        console.info('teaching_engine.stage.completed', { stage: args.stage, latency_ms: latencyMs, model: response.model, attempt: attempt + 1 });
        return { artifact, model: response.model, trace };
      } catch (error) {
        lastError = error;
        console.warn('teaching_engine.stage.failed', { stage: args.stage, attempt: attempt + 1, message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    if (lastError instanceof TeachingCallFailureError) throw lastError;
    throw new Error(`Teaching ${args.stage} failed after bounded retries: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
  }

  private async getOrCreateAnalysis(
    sources: NormalizedSource[], materialId: string | undefined, learnerLevel: string, durationMinutes: number, focus: string | null,
  ) {
    const sourceHash = fingerprint(sources);
    // Versioned cache keys prevent a legacy analysis artifact from being
    // treated as current merely because the prompt revision is unchanged.
    const cacheKey = fingerprint({
      sourceHash,
      learnerLevel,
      durationMinutes,
      focus,
      promptVersion: PROMPT_VERSIONS.analysis,
      schemaVersion: EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION,
      contractVersion: EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION,
    });
    const cached = await prisma.teachingAnalysisCache.findUnique({ where: { cache_key: cacheKey } });
    if (cached) {
      try {
        return {
          analysis: validateAnalysis(cached.analysis, config.teachingAnalogyRiskThreshold), sourceHash, cached: true, cacheStatus: 'HIT_VALID' as const,
          trace: { stage: 'analysis' as const, latencyMs: 0, attempt: 0, cacheHit: true, cacheStatus: 'HIT_VALID' as const },
        };
      } catch (error) {
        const cacheStatus = cacheCompatibilityStatus(cached.analysis);
        console.warn('teaching_analysis.cache_invalid', { cacheKey, cache_status: cacheStatus, message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // The current version is part of the primary key, so inspect a compatible
    // source/scope row solely to make stale-cache invalidation observable.
    // It is never reused; only a fully validated exact-key row can be a hit.
    const stale = await prisma.teachingAnalysisCache.findFirst({
      where: { source_hash: sourceHash, learner_level: learnerLevel, user_focus: focus },
      orderBy: { updated_at: 'desc' },
    });
    const staleMetadata = stale?.analysis && typeof stale.analysis === 'object'
      ? (stale.analysis as Record<string, unknown>).analysis_metadata as Record<string, unknown> | undefined
      : undefined;
    const sameDuration = staleMetadata?.requested_duration_minutes === durationMinutes;
    const cacheStatus: Exclude<AnalysisCacheStatus, 'HIT_VALID'> = stale && sameDuration
      ? cacheCompatibilityStatus(stale.analysis)
      : 'MISS';
    if (stale && sameDuration) console.info('teaching_analysis.cache_invalidated', { cache_status: cacheStatus });

    console.info('teaching_analysis.started', { source_route: sourceRoute(sources), source_count: sources.length, source_token_estimate: estimateTokens(sources) });
    if (sourceRoute(sources) === 'huge_retrieval_required') {
      throw new Error('Source set is too large for immediate generation. Build the persistent source index before creating this episode.');
    }
    const { artifact: analysis, trace } = await this.callJson({
      stage: 'analysis', prompt: analysisPrompt(sources, learnerLevel, durationMinutes, focus), systemPrompt: analysisSystemPrompt,
      model: config.teachingAnalysisModel, maxTokens: 12_000,
      validate: (value) => validateAnalysis(value, config.teachingAnalogyRiskThreshold),
      structuredOutput: ANALYSIS_STRUCTURED_OUTPUT,
    });
    await prisma.teachingAnalysisCache.upsert({
      where: { cache_key: cacheKey },
      create: { cache_key: cacheKey, source_hash: sourceHash, material_id: materialId, learner_level: learnerLevel, user_focus: focus, prompt_version: PROMPT_VERSIONS.analysis, analysis: analysis as any },
      update: { analysis: analysis as any, material_id: materialId },
    });
    return { analysis, sourceHash, cached: false, cacheStatus, trace: { ...trace, cacheStatus } };
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

    console.info('teaching_blueprint.started', { complexity, cached_analysis: cached, analysis_cache_status: analysisTrace.cacheStatus });
    const { artifact: blueprint, trace: blueprintTrace } = await this.callJson({
      stage: 'blueprint', prompt: blueprintPrompt(analysis, complexity), systemPrompt: blueprintSystemPrompt,
      model: config.teachingBlueprintModel, maxTokens: 8_000, validate: (value) => validateBlueprint(value, analysis),
      structuredOutput: BLUEPRINT_STRUCTURED_OUTPUT,
    });
    traces.push(blueprintTrace);
    const blueprintQuality = validateBlueprintQuality(blueprint);
    const { artifact: realizedDialogue, model: dialogueModel, trace: dialogueTrace } = await this.callJson({
      stage: 'dialogue', prompt: dialoguePrompt(analysis, blueprint), systemPrompt: dialogueSystemPrompt,
      model: config.teachingDialogueModel, maxTokens: 12_000, validate: (value) => validateDialogue(value, blueprint, analysis),
      structuredOutput: DIALOGUE_STRUCTURED_OUTPUT,
    });
    traces.push(dialogueTrace);
    let dialogue: ProductionDialogueScript = { ...realizedDialogue, generation_metadata: { ...realizedDialogue.generation_metadata, model: dialogueModel } };
    const rawConversationalQuality = validateConversationalQuality(dialogue, analysis);
    const openingRepair = repairHost1ValidationOpenings(dialogue);
    let host1OpeningRepairs = openingRepair.repairs;
    dialogue = validateDialogue(openingRepair.dialogue, blueprint, analysis);
    let fidelity: CriticReview | null = null;
    const fidelityHistory: CriticReview[] = [];
    let preRepairDialogue: ProductionDialogueScript | null = null;
    const initialCertaintyDriftWarnings = detectPossibleCertaintyDrift(dialogue, analysis);
    let certaintyDriftWarnings = initialCertaintyDriftWarnings;

    if (complexity !== 'FAST') {
      const runFidelity = async (candidate: ProductionDialogueScript) => this.callJson({
        stage: 'fidelity', prompt: fidelityPrompt(analysis, blueprint, candidate, certaintyDriftWarnings), systemPrompt: fidelitySystemPrompt,
        model: config.teachingFidelityModel, maxTokens: 4_000, validate: (value) => validateCriticReview(value, analysis, blueprint),
        structuredOutput: FIDELITY_STRUCTURED_OUTPUT,
      });
      const firstFidelity = await runFidelity(dialogue);
      fidelity = firstFidelity.artifact;
      fidelityHistory.push(fidelity);
      traces.push(firstFidelity.trace);
      for (let attempt = 0; attempt < MAX_PATCH_ATTEMPTS && fidelity.defects.some((defect) => defect.severity === 'HARD_BLOCKER'); attempt += 1) {
        preRepairDialogue = dialogue;
        const repaired = await this.repairDialogue(analysis, blueprint, dialogue, fidelity);
        const postPatchOpeningRepair = repairHost1ValidationOpenings(repaired.dialogue);
        host1OpeningRepairs = [...host1OpeningRepairs, ...postPatchOpeningRepair.repairs];
        dialogue = validateDialogue(postPatchOpeningRepair.dialogue, blueprint, analysis);
        certaintyDriftWarnings = detectPossibleCertaintyDrift(dialogue, analysis);
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
    // This measures the final dialogue, including any bounded fidelity repair.
    const conversationalQuality = validateConversationalQuality(dialogue, analysis);

    const episode = await prisma.teachingEpisode.create({
      data: {
        requested_by: requestedBy, material_id: materialId, source_hash: sourceHash, complexity, status: 'READY_FOR_TTS',
        request_config: { learnerLevel, durationMinutes, focus, sourceRoute: sourceRoute(sources) } as any,
        analysis: analysis as any, blueprint: blueprint as any, dialogue: dialogue as any, fidelity_review: fidelity as any,
      },
    });
    console.info('episode.ready_for_tts', { episode_id: episode.id, complexity, cached_analysis: cached, turn_count: dialogue.turns.length });
    return {
      episodeId: episode.id, analysis, blueprint, blueprintQuality, dialogue, preRepairDialogue, fidelity, fidelityHistory, conversationalQuality, rawConversationalQuality, host1OpeningRepairs, initialCertaintyDriftWarnings, certaintyDriftWarnings, cachedAnalysis: cached, analysisCacheStatus: analysisTrace.cacheStatus || (cached ? 'HIT_VALID' : 'MISS'),
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
