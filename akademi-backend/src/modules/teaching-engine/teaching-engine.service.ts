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
  ClaimModality, ClaimPolarity, ClaimStrength, CriticDefect, FidelityPublicationReport, FidelityRepairObservation, NormalizedSource, ProductionDialogueScript, RepairTarget, RepairTargetProposition, TeachingEpisodeRequest, TeachingEpisodeResult,
  TeachingStageInstrumentation,
} from './types';
import {
  blueprintProvenanceReport, parseJsonObject, TeachingValidationError, validateAnalysis, validateBlueprint,
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
import { certaintyHardBlockers, detectPossibleCertaintyDrift } from './certainty-drift.validator';

const MAX_PATCH_ATTEMPTS = config.teachingMaxPatchAttempts || 2;

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

/**
 * A controlled fidelity failure. Normal clients only receive its 422 message;
 * the development-only live validator receives the sanitized repair chain.
 */
export class TeachingFidelityGateError extends Error {
  constructor(public readonly diagnostic: Record<string, unknown>) {
    super('Teaching episode failed the semantic fidelity gate.');
    this.name = 'TeachingFidelityGateError';
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

/** The patch contract permits a provider to return the replacement collection directly. */
function parsePatchResponse(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(trimmed) as unknown;
  if (Array.isArray(parsed)) return { turns: parsed };
  return parseJsonObject(raw);
}

function mergeDeterministicCertaintyBlockers(review: CriticReview, warnings: ReturnType<typeof detectPossibleCertaintyDrift>): CriticReview {
  const blockers = certaintyHardBlockers(warnings);
  if (!blockers.length) return review;
  return {
    verdict: 'REPAIR_REQUIRED',
    defects: [
      ...review.defects,
      ...blockers.map((warning) => ({
        defect_id: `CERTAINTY_${warning.turn_id}_${warning.phrase.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}`,
        type: 'CLAIM_EXAGGERATION' as const,
        severity: 'HARD_BLOCKER' as const,
        turn_ids: [warning.turn_id],
        concept_ids: [],
        invariant_ids: [],
        evidence_ids: warning.evidence_ids,
        description: `CERTAINTY_DRIFT_HARD_BLOCKER: ${warning.reason}`,
        repair_directive: 'Replace only this asserted certainty phrase with source-faithful probabilistic, conditional, or explicitly supported wording. Preserve every turn binding and speaker.',
      })),
    ],
  };
}

function textForDefect(defect: CriticDefect, dialogue: ProductionDialogueScript) {
  return defect.turn_ids.map((turnId) => dialogue.turns.find((turn) => turn.turn_id === turnId)?.spoken_text || '').join(' ');
}

function negatesAbsoluteIntensity(text: string) {
  return /\b(?:cannot|can'?t|does?\s+not|doesn'?t|do\s+not|don'?t|never)\s+(?:\w+\s+){0,3}(?:completely|entirely|fully|absolutely)\s+(?:eliminat(?:e|es|ed|ing)|prevent(?:s|ed|ing)?|avoid(?:s|ed|ing)?|remov(?:e|es|ed|ing)|rule(?:s|d)?\s+out)\b/i.test(text);
}

function assertsAbsoluteElimination(text: string) {
  return /\b(?:completely|entirely|fully|absolutely)\s+(?:eliminat(?:e|es|ed|ing)|prevent(?:s|ed|ing)?|avoid(?:s|ed|ing)?|remov(?:e|es|ed|ing)|rule(?:s|d)?\s+out)\b/i.test(text)
    || /\bno\s+(?:\w+\s+){0,4}could\s+possibly\b/i.test(text);
}

function assertsMaterialIntensity(text: string) {
  return /\b(?:completely|entirely|fully|absolutely|dramatically|critical(?:ly)?)\b/i.test(text);
}

/** The provider supplies a useful critique; the engine owns publication severity. */
function normalizeFidelityReview(review: CriticReview, dialogue: ProductionDialogueScript): CriticReview {
  return {
    ...review,
    defects: review.defects.map((defect) => {
      const text = textForDefect(defect, dialogue);
      const negated = negatesAbsoluteIntensity(text);
      // A critic may call this a warning, but omitting an invariant-bound payload
      // leaves the learner with a changed mental model and is never publishable.
      if (defect.type === 'PAYLOAD_LOSS' && defect.invariant_ids.length) {
        return { ...defect, severity: 'HARD_BLOCKER' as const };
      }
      if (defect.type === 'UNSUPPORTED_INTENSITY') {
        if (negated || !assertsMaterialIntensity(text)) return { ...defect, severity: 'SOFT_WARNING' as const };
        if (assertsAbsoluteElimination(text)) return { ...defect, severity: 'HARD_BLOCKER' as const };
        return { ...defect, severity: 'MATERIAL_REPAIR' as const };
      }
      if (defect.severity === 'HARD_BLOCKER') return defect;
      if (!negated && assertsAbsoluteElimination(text)) return { ...defect, severity: 'HARD_BLOCKER' as const };
      if (!negated && defect.type === 'CLAIM_EXAGGERATION' && assertsMaterialIntensity(text)) {
        return { ...defect, severity: 'MATERIAL_REPAIR' as const };
      }
      return defect;
    }),
  };
}

function isActionableDefect(defect: CriticDefect) {
  return defect.severity === 'HARD_BLOCKER' || defect.severity === 'MATERIAL_REPAIR';
}

function publicationFidelityFor(review: CriticReview | null, providerVerdict: CriticReview['verdict'] | 'SKIPPED'): FidelityPublicationReport {
  const defects = review?.defects || [];
  const hardBlockerCount = defects.filter((defect) => defect.severity === 'HARD_BLOCKER').length;
  const materialRepairCount = defects.filter((defect) => defect.severity === 'MATERIAL_REPAIR').length;
  const softWarningCount = defects.filter((defect) => defect.severity === 'SOFT_WARNING').length;
  const engineVerdict = hardBlockerCount ? 'FAIL'
    : materialRepairCount ? 'REPAIR_REQUIRED'
      : softWarningCount ? 'PASS_WITH_WARNINGS' : 'PASS';
  return {
    provider_verdict: providerVerdict,
    engine_verdict: engineVerdict,
    hard_blocker_count: hardBlockerCount,
    material_repair_count: materialRepairCount,
    soft_warning_count: softWarningCount,
    publishable_for_audio: engineVerdict === 'PASS' || engineVerdict === 'PASS_WITH_WARNINGS',
    normalization_reason: providerVerdict === 'REPAIR_REQUIRED' && engineVerdict === 'PASS_WITH_WARNINGS'
      ? 'ONLY_NON_BLOCKING_SOFT_DEFECTS_REMAIN'
      : providerVerdict === 'PASS' && hardBlockerCount
        ? 'DETERMINISTIC_HARD_BLOCKER_OVERRIDES_PROVIDER_PASS'
        : 'DEFECT_SEVERITY_POLICY',
    defects,
  };
}

function normalizedText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

const modalityRank: Record<ClaimModality, number> = {
  POSSIBILITY: 1, CAPABILITY: 2, TYPICALITY: 3, STRONG_LIKELIHOOD: 4, NECESSITY: 5, GUARANTEE: 6, ABSOLUTE: 7,
};
const intensityWords = /\b(?:drastically|dramatically|massively|completely|entirely|extremely|fundamentally)\b/gi;
const negatedAbsolutePatterns = [
  /\b(?:does|do|did)\s+not\s+make\s+[^.?!,;]*?\s+impossible\b/gi,
  /\b(?:does|do|did)\s+not\s+(?:completely\s+|entirely\s+|fully\s+)?(?:eliminat(?:e|es|ed|ing)|prevent(?:s|ed|ing)?|avoid(?:s|ed|ing)?|remov(?:e|es|ed|ing)|rule(?:s|d)?\s+out)\b[^.?!,;]*/gi,
  /\b(?:doesn't|don't|didn't)\s+make\s+[^.?!,;]*?\s+impossible\b/gi,
  /\b(?:doesn't|don't|didn't)\s+(?:completely\s+|entirely\s+|fully\s+)?(?:eliminat(?:e|es|ed|ing)|prevent(?:s|ed|ing)?|avoid(?:s|ed|ing)?|remov(?:e|es|ed|ing)|rule(?:s|d)?\s+out)\b[^.?!,;]*/gi,
  /\b(?:cannot|can't)\s+guarantee\b[^.?!,;]*/gi,
  /\b(?:does|do|did)\s+not\s+guarantee\b[^.?!,;]*/gi,
  /\b(?:doesn't|don't|didn't)\s+guarantee\b[^.?!,;]*/gi,
  /\bnot\s+(?:always|guaranteed|impossible)\b/gi,
  /\bnever\s+(?:completely\s+|entirely\s+|fully\s+)?(?:eliminat(?:e|es|ed|ing)|prevent(?:s|ed|ing)?|avoid(?:s|ed|ing)?|remov(?:e|es|ed|ing)|rule(?:s|d)?\s+out)\b[^.?!,;]*/gi,
];

function polarityFor(text: string): ClaimPolarity {
  if (/\?/.test(text)) return 'QUESTIONED';
  if (negatedAbsolutePatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  })) return 'NEGATED';
  if (/\b(?:if|would|could|might)\b/i.test(text)) return 'HYPOTHETICAL';
  return 'AFFIRMATIVE';
}

function affirmativeClaimText(text: string) {
  return negatedAbsolutePatterns.reduce((current, pattern) => current.replace(pattern, ''), text);
}

const modalityFor = (text: string): ClaimModality => {
  const polarity = polarityFor(text);
  if (polarity === 'QUESTIONED' || polarity === 'HYPOTHETICAL') return 'POSSIBILITY';
  const affirmative = affirmativeClaimText(text);
  if (/\b(?:always|never|completely|entirely|absolutely|impossible)\b/i.test(affirmative)) return 'ABSOLUTE';
  if (/\b(?:guarantee|ensure|prevent(?:s|ed|ing)?|will recover|will succeed|must eventually)\b/i.test(affirmative)) return 'GUARANTEE';
  if (/\b(?:must|needs? to|required to|have to)\b/i.test(affirmative)) return 'NECESSITY';
  if (/\b(?:very rare|rare|greatly|significantly|strongly)\b/i.test(affirmative)) return 'STRONG_LIKELIHOOD';
  if (/\b(?:usually|typically|generally)\b/i.test(affirmative)) return 'TYPICALITY';
  if (/\b(?:can|able to|capable of|another opportunity|helps?)\b/i.test(affirmative)) return 'CAPABILITY';
  return 'POSSIBILITY';
};
const strengthFor = (text: string): ClaimStrength => {
  const affirmative = affirmativeClaimText(text);
  if (/\b(?:drastically|dramatically|massively|extremely|fundamentally)\b/i.test(affirmative)) return 'EXCESSIVE';
  if (/\b(?:very rare|rare|greatly|significantly|strongly|much less (?:likely|common)|infrequently)\b/i.test(affirmative)) return 'STRONG';
  return 'NEUTRAL';
};
const strengthRank: Record<ClaimStrength, number> = { SOURCE_EQUIVALENT: 0, NEUTRAL: 1, STRONG: 2, EXCESSIVE: 3 };

function allowedModalities(sourceModality: ClaimModality): ClaimModality[] {
  return (Object.entries(modalityRank) as Array<[ClaimModality, number]>)
    .filter(([, rank]) => rank <= modalityRank[sourceModality])
    .map(([modality]) => modality);
}

function sourcePropositions(authority: string): RepairTargetProposition[] {
  const clauses = authority.split(/(?:[.;]|\bbut\b|\bhowever\b|\balthough\b|\bthough\b|\bwhile\b)/i)
    .map((item) => item.trim()).filter((item) => item.length > 8);
  return clauses.map((meaning) => {
    const sourceModality = modalityFor(meaning);
    const sourceStrength = strengthFor(meaning);
    return {
      meaning,
      polarity: polarityFor(meaning),
      allowed_modality: allowedModalities(sourceModality),
      allowed_strength: sourceStrength,
    };
  });
}

function sourceMeaning(evidence: EpisodeTeachingAnalysis['evidence_registry'], invariants: Array<{ statement: string }>) {
  return [...evidence.flatMap((item) => [item.verbatim_span, item.normalized_claim]), ...invariants.map((item) => item.statement)]
    .filter(Boolean).filter((item, index, values) => values.indexOf(item) === index).join(' ');
}

function offendingSpan(text: string) {
  return text.match(/\b(?:must have a way to|needs? to|have to|must|ensur(?:e|es|ed|ing)|guarantee(?:s|d|ing)?|drastically|dramatically|massively|completely|entirely|extremely|fundamentally)\b[^.?!]*/i)?.[0] || null;
}

function compileRepairTargets(
  analysis: EpisodeTeachingAnalysis,
  blueprint: EpisodeTeachingBlueprint,
  dialogue: ProductionDialogueScript,
  defects: CriticReview['defects'],
): RepairTarget[] {
  const invariants = new Map(analysis.concepts.flatMap((concept) => concept.invariants.map((item) => [item.invariant_id, item] as const)));
  const blueprintByTurn = new Map(blueprint.turns.map((turn) => [turn.turn_id, turn]));
  return defects.flatMap((defect) => defect.turn_ids.map((turn_id) => {
    const turn = dialogue.turns.find((item) => item.turn_id === turn_id);
    const payload = blueprintByTurn.get(turn_id);
    const evidenceIds = [...new Set([...(defect.evidence_ids || []), ...(turn?.evidence_ids || []), ...(payload?.evidence_ids || [])])];
    const preserveInvariantIds = [...new Set([...(defect.invariant_ids || []), ...(turn?.invariant_ids || []), ...(payload?.invariant_ids || [])])];
    const boundInvariants = preserveInvariantIds.map((id) => invariants.get(id)).filter(Boolean) as Array<{ statement: string; forbidden_exaggerations: string[] }>;
    const evidence = analysis.evidence_registry.filter((item) => evidenceIds.includes(item.evidence_id));
    const authority = sourceMeaning(evidence, boundInvariants);
    const propositions = sourcePropositions(authority || defect.repair_directive);
    const allowedModality = [...new Set(propositions.flatMap((item) => item.allowed_modality))];
    const allowedStrength = propositions.some((item) => item.allowed_strength === 'STRONG') ? 'STRONG' : 'NEUTRAL';
    const forbidden = [...new Set([
      ...boundInvariants.flatMap((item) => item.forbidden_exaggerations),
      ...(allowedModality.includes('CAPABILITY') ? ['must have a way to', 'needs to', 'ensures recovery', 'guarantees recovery'] : []),
    ])];
    const text = turn?.spoken_text || '';
    return {
      turn_id, defect_id: defect.defect_id, defect_type: defect.type,
      offending_span: offendingSpan(text), proposition: payload?.core_epistemic_payload || defect.description,
      source_supported_meaning: authority || defect.repair_directive,
      source_evidence: evidence.map((item) => ({ evidence_id: item.evidence_id, claim: item.normalized_claim || item.verbatim_span })),
      source_propositions: propositions,
      allowed_modality: allowedModality, detected_original_modality: modalityFor(text),
      detected_original_polarity: polarityFor(text),
      allowed_strength: allowedStrength, detected_original_strength: strengthFor(text),
      forbidden_forms: forbidden, preserve_invariant_ids: preserveInvariantIds, preserve_evidence_ids: evidenceIds,
    };
  }));
}

function repairContextFor(
  analysis: EpisodeTeachingAnalysis,
  blueprint: EpisodeTeachingBlueprint,
  dialogue: ProductionDialogueScript,
  defects: CriticReview['defects'],
  repairTargets: RepairTarget[],
  attempt: number,
  previousFailure?: FidelityRepairObservation[],
) {
  const byTurn = new Map(dialogue.turns.map((turn, index) => [turn.turn_id, { turn, index }]));
  const invariants = new Map(analysis.concepts.flatMap((concept) => concept.invariants.map((invariant) => [invariant.invariant_id, invariant] as const)));
  const blueprintByTurn = new Map(blueprint.turns.map((turn) => [turn.turn_id, turn]));
  const priorFailure = previousFailure?.map((item) => ({
    defect_id: item.defect_id,
    turn_id: item.turn_id,
    proposed_text: item.proposed_text,
    repair_target: item.repair_target,
    detected_repaired_modality: item.detected_repaired_modality,
    detected_repaired_strength: item.detected_repaired_strength,
    deterministic_result: item.deterministic_post_patch_result,
    rejection_reason: item.rejection_reason,
    call4_invoked: item.call4_invoked,
    call4_result: item.call4_result,
    fidelity_result: item.fidelity_post_patch_result,
    final_status: item.final_status,
  })) || [];
  return {
    repair_attempt: attempt,
    prior_failure: priorFailure,
    retry_instruction: priorFailure.length
      ? 'Your previous patch did not materially remove the blocked claim and violated the supplied repair target. Do not repeat or lightly paraphrase the claim. Use only the allowed modality and strength recorded in the target; rewrite the minimum necessary text.'
      : undefined,
    affected_turns: defects.flatMap((defect) => defect.turn_ids.map((turnId) => {
      const located = byTurn.get(turnId);
      const turn = located?.turn;
      const boundInvariants = (turn?.invariant_ids || []).map((id) => invariants.get(id)).filter(Boolean);
      const analogy = turn?.analogy_id
        ? analysis.concepts.flatMap((concept) => concept.analogy_candidates).find((item) => item.analogy_id === turn.analogy_id)
        : undefined;
      return {
        defect: {
          defect_id: defect.defect_id, type: defect.type, description: defect.description,
          repair_directive: defect.repair_directive, evidence_ids: defect.evidence_ids,
          invariant_ids: defect.invariant_ids,
        },
        repair_target: repairTargets.find((target) => target.defect_id === defect.defect_id && target.turn_id === turnId),
        failing_turn: turn,
        previous_turn: located && located.index > 0 ? dialogue.turns[located.index - 1] : null,
        next_turn: located && located.index < dialogue.turns.length - 1 ? dialogue.turns[located.index + 1] : null,
        blueprint_payload: blueprintByTurn.get(turnId),
        source_evidence: analysis.evidence_registry.filter((item) => (turn?.evidence_ids || defect.evidence_ids).includes(item.evidence_id)),
        invariants: boundInvariants.map((item) => ({
          invariant_id: item!.invariant_id, statement: item!.statement,
          forbidden_exaggerations: item!.forbidden_exaggerations,
          allowed_claim_type: item!.claim_type, epistemic_status: item!.epistemic_status,
        })),
        analogy_boundary: analogy ? { analogy_id: analogy.analogy_id, breakdown_boundary: analogy.breakdown_boundary, forbidden_inferences: analogy.forbidden_inferences } : null,
      };
    })),
  };
}

function deterministicPostPatchValidation(
  original: ProductionDialogueScript,
  candidate: ProductionDialogueScript,
  analysis: EpisodeTeachingAnalysis,
  blueprint: EpisodeTeachingBlueprint,
  defects: CriticReview['defects'],
  repairTargets: RepairTarget[],
  replacementTurnIds: string[],
) {
  const codes: string[] = [];
  try {
    validateDialogue(candidate, blueprint, analysis);
  } catch (error) {
    if (error instanceof TeachingValidationError) codes.push(...error.issues.map((issue) => `STRUCTURAL_OR_FORBIDDEN:${issue}`));
    else codes.push(`STRUCTURAL_OR_FORBIDDEN:${error instanceof Error ? error.message : 'Unknown validation failure'}`);
  }
  const affectedTurnIds = [...new Set(defects.flatMap((defect) => defect.turn_ids))];
  if (!affectedTurnIds.some((id) => replacementTurnIds.includes(id))) {
    codes.push('PATCH_NO_MEANINGFUL_CHANGE', 'PATCH_MISSING_AFFECTED_REPLACEMENT');
  }
  for (const turnId of affectedTurnIds) {
    const before = original.turns.find((turn) => turn.turn_id === turnId)?.spoken_text || '';
    const after = candidate.turns.find((turn) => turn.turn_id === turnId)?.spoken_text || '';
    if (normalizedText(before) === normalizedText(after)) {
      codes.push(
        'PATCH_NO_MEANINGFUL_CHANGE',
        'PATCH_IDENTICAL_TEXT',
        `PATCH_NO_MEANINGFUL_CHANGE:${turnId}`,
        `PATCH_IDENTICAL_TEXT:${turnId}`,
      );
    }
  }
  const originalHard = certaintyHardBlockers(detectPossibleCertaintyDrift(original, analysis));
  const candidateWarnings = detectPossibleCertaintyDrift(candidate, analysis);
  const candidateHard = certaintyHardBlockers(candidateWarnings);
  const affectedCandidateHard = candidateHard.filter((warning) => affectedTurnIds.includes(warning.turn_id));
  if (affectedCandidateHard.length) {
    codes.push('PATCH_NO_MEANINGFUL_CHANGE', 'PATCH_SEMANTIC_NO_OP', 'PATCH_INSUFFICIENT_CERTAINTY_REDUCTION', 'PATCH_REPEATED_BLOCKED_CLAIM');
    for (const warning of affectedCandidateHard) {
      codes.push(`PATCH_SEMANTIC_NO_OP:${warning.turn_id}`, `PATCH_INSUFFICIENT_CERTAINTY_REDUCTION:${warning.turn_id}`);
      if (originalHard.some((prior) => prior.turn_id === warning.turn_id && prior.phrase === warning.phrase)) {
        codes.push('PATCH_REPEATED_BLOCKED_PHRASE', `PATCH_REPEATED_BLOCKED_PHRASE:${warning.turn_id}`);
      }
    }
  }
  if (candidateHard.some((warning) => !originalHard.some((prior) => prior.turn_id === warning.turn_id && prior.phrase === warning.phrase))) {
    codes.push('PATCH_CREATED_NEW_HARD_BLOCKER');
  }
  for (const target of repairTargets) {
    const after = candidate.turns.find((turn) => turn.turn_id === target.turn_id)?.spoken_text || '';
    const repairedModality = modalityFor(after);
    const repairedStrength = strengthFor(after);
    const permittedRank = Math.max(...target.allowed_modality.map((item) => modalityRank[item]));
    if (modalityRank[repairedModality] > permittedRank) {
      codes.push('PATCH_EXCEEDS_ALLOWED_MODALITY', `PATCH_EXCEEDS_ALLOWED_MODALITY:${target.turn_id}`);
    }
    if (strengthRank[repairedStrength] > strengthRank[target.allowed_strength]) {
      codes.push('PATCH_EXCEEDS_ALLOWED_INTENSITY', `PATCH_EXCEEDS_ALLOWED_INTENSITY:${target.turn_id}`);
    }
    const forbidden = target.forbidden_forms.some((form) => form && new RegExp(`\\b${form.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&').replace(/\\s+/g, '\\s+')}\\b`, 'i').test(after));
    if (forbidden) codes.push('PATCH_PRESERVES_MATERIAL_OVERSTATEMENT', `PATCH_PRESERVES_MATERIAL_OVERSTATEMENT:${target.turn_id}`);
    const requiredTerms = target.source_supported_meaning.toLowerCase().match(/\b(?:election|leader|split|vote|term|retry|chance|candidate|timeout)\w*\b/g) || [];
    if (requiredTerms.length && !requiredTerms.some((term) => after.toLowerCase().includes(term))) {
      codes.push('PATCH_LOST_REQUIRED_PROPOSITION', `PATCH_LOST_REQUIRED_PROPOSITION:${target.turn_id}`);
    }
    const requiresReductionMechanism = target.source_propositions.some((item) => /\b(?:rare|reduce|less likely|less common|infrequent)\b/i.test(item.meaning));
    if (requiresReductionMechanism && polarityFor(after) !== 'NEGATED' && /\b(?:randomi[sz]|timeout)\b/i.test(target.source_supported_meaning)
      && !/\b(?:rare|reduc(?:e|es|ed|ing|tion)|less likely|less common|infrequent)\b/i.test(after)) {
      codes.push('PATCH_LOST_REQUIRED_PROPOSITION', `PATCH_LOST_REQUIRED_PROPOSITION:${target.turn_id}:REDUCTION_MECHANISM`);
    }
  }
  return {
    verdict: codes.length ? 'REPAIR_REQUIRED' as const : 'PASS' as const,
    codes: [...new Set(codes)],
    certaintyWarnings: candidateWarnings,
    certaintyHardBlockerTurnIds: [...new Set(candidateHard.map((warning) => warning.turn_id))],
    targetCodes: codes.filter((code) => /^PATCH_(?:EXCEEDS_ALLOWED_MODALITY|EXCEEDS_ALLOWED_INTENSITY|PRESERVES_MATERIAL_OVERSTATEMENT|LOST_REQUIRED_PROPOSITION)/.test(code)),
  };
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
    parseResponse?: (raw: string) => Record<string, unknown>;
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
        const parsed = args.parseResponse ? args.parseResponse(response.text) : parseJsonObject(response.text);
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
    analysis: EpisodeTeachingAnalysis,
    blueprint: EpisodeTeachingBlueprint,
    dialogue: ProductionDialogueScript,
    review: CriticReview,
    attempt: number,
    previousFailure?: FidelityRepairObservation[],
  ): Promise<{ dialogue: ProductionDialogueScript; trace?: TeachingStageInstrumentation; replacementTurnIds: string[]; repairTargets: RepairTarget[]; repairMethod: 'TARGETED_MODEL' | 'DETERMINISTIC_INTENSITY_REMOVAL' }> {
    const hardDefects = review.defects.filter(isActionableDefect);
    const repairTargets = compileRepairTargets(analysis, blueprint, dialogue, hardDefects);
    const intensityOnly = hardDefects.length > 0 && hardDefects.every((defect) => defect.type === 'UNSUPPORTED_INTENSITY');
    if (intensityOnly) {
      const turns = dialogue.turns.map((turn) => {
        if (!repairTargets.some((target) => target.turn_id === turn.turn_id)) return turn;
        return { ...turn, spoken_text: turn.spoken_text.replace(intensityWords, '').replace(/\s{2,}/g, ' ').trim() };
      });
      const replacementTurnIds = turns.filter((turn, index) => turn.spoken_text !== dialogue.turns[index].spoken_text).map((turn) => turn.turn_id);
      if (replacementTurnIds.length) {
        return { dialogue: { ...dialogue, turns }, replacementTurnIds, repairTargets, repairMethod: 'DETERMINISTIC_INTENSITY_REMOVAL' };
      }
    }
    const { artifact: replacement, trace } = await this.callJson({
      stage: 'targeted_patch',
      prompt: patchPrompt(analysis, blueprint, dialogue, hardDefects, repairContextFor(analysis, blueprint, dialogue, hardDefects, repairTargets, attempt, previousFailure)),
      systemPrompt: patchSystemPrompt,
      model: config.teachingPatchModel, maxTokens: 4_000,
      parseResponse: parsePatchResponse,
      validate: (value) => {
        if (!value || typeof value !== 'object') throw new TeachingValidationError(['Patch must return { turns: [...] }.']);
        const candidate = value as { turns?: ProductionDialogueScript['turns']; replacement_dialogue_turns?: ProductionDialogueScript['turns'] };
        const turns = candidate.turns || candidate.replacement_dialogue_turns;
        if (!Array.isArray(turns)) throw new TeachingValidationError(['Patch must return { turns: [...] }.']);
        // Some providers name the requested replacement collection explicitly.
        // Normalize that transport detail before the existing binding validator
        // verifies every returned turn against the approved blueprint.
        return { turns };
      },
    });
    const allowedTurnIds = new Set(hardDefects.flatMap((defect) => defect.turn_ids));
    const replacements = new Map(replacement.turns.filter((turn) => allowedTurnIds.has(turn.turn_id)).map((turn) => [turn.turn_id, turn]));
    return {
      // Structural binding checks run immediately after the patch and before a
      // further paid fidelity review. This intentionally does not permit a
      // repair to touch an unrelated turn.
      dialogue: { ...dialogue, turns: dialogue.turns.map((turn) => replacements.get(turn.turn_id) || turn) },
      trace,
      replacementTurnIds: [...replacements.keys()],
      repairTargets,
      repairMethod: 'TARGETED_MODEL',
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
    const blueprintProvenance = blueprintProvenanceReport(blueprint);
    console.info('teaching_blueprint.provenance_enriched', {
      provenance_fields_enriched: blueprintProvenance.provenance_fields_enriched,
      blueprint_retry_count: blueprintTrace.retryCount || 0,
      semantic_reference_failures: blueprintTrace.unknownReferenceIds || [],
      retry_reason: blueprintTrace.validationFailureReason || null,
    });
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
    const semanticFidelityHistory: CriticReview[] = [];
    const fidelityRepairObservations: FidelityRepairObservation[] = [];
    let preRepairDialogue: ProductionDialogueScript | null = null;
    const initialCertaintyDriftWarnings = detectPossibleCertaintyDrift(dialogue, analysis);
    let certaintyDriftWarnings = initialCertaintyDriftWarnings;

    if (complexity !== 'FAST' || certaintyHardBlockers(certaintyDriftWarnings).length) {
      const runFidelity = async (candidate: ProductionDialogueScript) => this.callJson({
        stage: 'fidelity', prompt: fidelityPrompt(analysis, blueprint, candidate, certaintyDriftWarnings), systemPrompt: fidelitySystemPrompt,
        model: config.teachingFidelityModel, maxTokens: 4_000, validate: (value) => validateCriticReview(value, analysis, blueprint),
        structuredOutput: FIDELITY_STRUCTURED_OUTPUT,
      });
      const firstFidelity = await runFidelity(dialogue);
      semanticFidelityHistory.push(firstFidelity.artifact);
      fidelity = mergeDeterministicCertaintyBlockers(normalizeFidelityReview(firstFidelity.artifact, dialogue), certaintyDriftWarnings);
      fidelityHistory.push(fidelity);
      traces.push(firstFidelity.trace);
      for (let attempt = 1; attempt <= MAX_PATCH_ATTEMPTS && fidelity.defects.some(isActionableDefect); attempt += 1) {
        const hardDefects = fidelity.defects.filter(isActionableDefect);
        if (!preRepairDialogue) preRepairDialogue = dialogue;
        const beforePatch = dialogue;
        const repaired = await this.repairDialogue(analysis, blueprint, dialogue, fidelity, attempt, fidelityRepairObservations);
        const postPatchOpeningRepair = repairHost1ValidationOpenings(repaired.dialogue);
        host1OpeningRepairs = [...host1OpeningRepairs, ...postPatchOpeningRepair.repairs];
        if (repaired.trace) traces.push(repaired.trace);
        const deterministic = deterministicPostPatchValidation(
          beforePatch, postPatchOpeningRepair.dialogue, analysis, blueprint, hardDefects, repaired.repairTargets, repaired.replacementTurnIds,
        );
        const observationBase = hardDefects.flatMap((defect) => defect.turn_ids.map((turnId) => ({
          defect_id: defect.defect_id,
          turn_id: turnId,
          defect_type: defect.type,
          repair_target: repaired.repairTargets.find((target) => target.defect_id === defect.defect_id && target.turn_id === turnId),
          repair_method: repaired.repairMethod,
          repair_attempt: attempt,
          original_text: beforePatch.turns.find((turn) => turn.turn_id === turnId)?.spoken_text || '',
          proposed_text: postPatchOpeningRepair.dialogue.turns.find((turn) => turn.turn_id === turnId)?.spoken_text || '',
          deterministic_post_patch_result: {
            verdict: deterministic.verdict,
            codes: deterministic.codes,
            certainty_hard_blocker_turn_ids: deterministic.certaintyHardBlockerTurnIds,
            target_codes: deterministic.targetCodes,
          },
          detected_repaired_modality: modalityFor(postPatchOpeningRepair.dialogue.turns.find((turn) => turn.turn_id === turnId)?.spoken_text || ''),
          detected_repaired_strength: strengthFor(postPatchOpeningRepair.dialogue.turns.find((turn) => turn.turn_id === turnId)?.spoken_text || ''),
          rejection_reason: deterministic.verdict === 'PASS' ? null : deterministic.codes.join(', '),
          no_op_retry_triggered: false,
          call4_invoked: false,
          call4_result: null,
        })));
        if (deterministic.verdict !== 'PASS') {
          const status: FidelityRepairObservation['final_status'] = deterministic.codes.some((code) => code.startsWith('PATCH_NO_MEANINGFUL_CHANGE'))
            ? 'PATCH_NO_MEANINGFUL_CHANGE'
            : deterministic.codes.includes('PATCH_REPEATED_BLOCKED_CLAIM')
              ? 'PATCH_REPEATED_BLOCKED_CLAIM'
              : deterministic.codes.includes('PATCH_CREATED_NEW_HARD_BLOCKER')
                ? 'PATCH_CREATED_NEW_HARD_BLOCKER'
                : 'PATCH_FAILED_DETERMINISTIC_VALIDATION';
          const noOpRetry = attempt < MAX_PATCH_ATTEMPTS && deterministic.codes.includes('PATCH_NO_MEANINGFUL_CHANGE');
          fidelityRepairObservations.push(...observationBase.map((item) => ({ ...item, no_op_retry_triggered: noOpRetry, final_status: status })));
          // Retain the last valid dialogue. Attempt two receives the exact
          // failed patch diagnostics rather than blindly repeating attempt one.
          // A known no-op deliberately skips Call 4: the deterministic layer
          // already proved that the blocked proposition survived.
          continue;
        }
        dialogue = validateDialogue(postPatchOpeningRepair.dialogue, blueprint, analysis);
        certaintyDriftWarnings = deterministic.certaintyWarnings;
        const repairedFidelity = await runFidelity(dialogue);
        semanticFidelityHistory.push(repairedFidelity.artifact);
        const postPatchFidelity = mergeDeterministicCertaintyBlockers(normalizeFidelityReview(repairedFidelity.artifact, dialogue), certaintyDriftWarnings);
        fidelity = postPatchFidelity;
        fidelityHistory.push(fidelity);
        traces.push(repairedFidelity.trace);
        const survivorTurnIds = new Set(postPatchFidelity.defects.filter(isActionableDefect).flatMap((defect) => defect.turn_ids));
        fidelityRepairObservations.push(...observationBase.map((item) => ({
          ...item,
          call4_invoked: true,
          call4_result: postPatchFidelity,
          fidelity_post_patch_result: postPatchFidelity,
          final_status: (survivorTurnIds.has(item.turn_id) ? 'FIDELITY_BLOCKER_SURVIVED' : 'REPAIRED') as FidelityRepairObservation['final_status'],
        })));
      }
      if (fidelity.defects.some((defect) => defect.severity === 'HARD_BLOCKER')) {
        const finalHardDefects = fidelity.defects.filter((defect) => defect.severity === 'HARD_BLOCKER');
        const patchAttemptCount = new Set(fidelityRepairObservations.map((item) => item.repair_attempt)).size;
        const repairAttemptsExhausted = patchAttemptCount >= MAX_PATCH_ATTEMPTS;
        const finalRepairObservation = fidelityRepairObservations[fidelityRepairObservations.length - 1];
        console.warn('fidelity_gate.failed', {
          hard_blocker_count: finalHardDefects.length,
          repair_attempt_count: patchAttemptCount,
          repair_observation_count: fidelityRepairObservations.length,
          repair_attempts_exhausted: repairAttemptsExhausted,
          final_defect_ids: finalHardDefects.map((defect) => defect.defect_id),
        });
        throw new TeachingFidelityGateError({
          failure_type: repairAttemptsExhausted ? 'REPAIR_ATTEMPTS_EXHAUSTED' : 'FIDELITY_GATE',
          initial_dialogue: preRepairDialogue,
          final_candidate_dialogue: dialogue,
          blueprint,
          analysis,
          fidelity_history: fidelityHistory,
          semantic_fidelity_history: semanticFidelityHistory,
          repair_observations: fidelityRepairObservations,
          repair_attempt_count: patchAttemptCount,
          final_blocker_reason: finalRepairObservation?.rejection_reason || finalRepairObservation?.final_status || 'Hard blocker remained after fidelity review.',
          final_hard_defects: finalHardDefects,
        });
      }
    }
    const publicationFidelity = publicationFidelityFor(fidelity, semanticFidelityHistory[semanticFidelityHistory.length - 1]?.verdict || 'SKIPPED');
    // This measures the final dialogue, including any bounded fidelity repair.
    const conversationalQuality = validateConversationalQuality(dialogue, analysis);

    const episode = await prisma.teachingEpisode.create({
      data: {
        requested_by: requestedBy, material_id: materialId, source_hash: sourceHash, complexity, status: publicationFidelity.publishable_for_audio ? 'READY_FOR_TTS' : 'REPAIR_REQUIRED',
        request_config: { learnerLevel, durationMinutes, focus, sourceRoute: sourceRoute(sources) } as any,
        analysis: analysis as any, blueprint: blueprint as any, dialogue: dialogue as any, fidelity_review: { provider_review: fidelity, publication: publicationFidelity } as any,
      },
    });
    console.info('teaching_episode.fidelity_resolved', { episode_id: episode.id, complexity, cached_analysis: cached, turn_count: dialogue.turns.length, engine_verdict: publicationFidelity.engine_verdict, publishable_for_audio: publicationFidelity.publishable_for_audio });
    return {
      episodeId: episode.id, analysis, blueprint, blueprintProvenance, blueprintQuality, dialogue, preRepairDialogue, fidelity, publicationFidelity, fidelityHistory, semanticFidelityHistory, conversationalQuality, rawConversationalQuality, host1OpeningRepairs, fidelityRepairObservations, initialCertaintyDriftWarnings, certaintyDriftWarnings, cachedAnalysis: cached, analysisCacheStatus: analysisTrace.cacheStatus || (cached ? 'HIT_VALID' : 'MISS'),
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
