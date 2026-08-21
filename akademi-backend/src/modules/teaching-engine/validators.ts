import {
  CriticReview,
  EpisodeTeachingAnalysis,
  EpisodeTeachingBlueprint,
  ProductionDialogueScript,
} from './types';
import {
  EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION,
  EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION,
  EPISODE_TEACHING_BLUEPRINT_SCHEMA_VERSION,
  PRODUCTION_DIALOGUE_SCHEMA_VERSION,
} from './schema';

const HOST_2_AGENCY_INTENTS = new Set(['DEDUCE', 'CHALLENGE', 'REFRAME', 'TEST_ANALOGY', 'SYNTHESIZE', 'CHECK_UNDERSTANDING']);
const PASSIVE_HOST_2 = /^(?:wow[,! ]*)?(?:that's fascinating|exactly|tell me more|that's crazy|makes sense)(?:[!. ]+tell me more)?[!. ]*$/i;
const CLAIM_TYPES = new Set(['SOURCE_FACT', 'SOURCE_SYNTHESIS', 'SUPPORTED_INFERENCE', 'PEDAGOGICAL_ANALOGY', 'PEDAGOGICAL_QUESTION']);
const EPISTEMIC_STATUSES = new Set(['CONFIRMED', 'CONTEXT_DEPENDENT', 'SOURCE_DISAGREEMENT', 'AMBIGUOUS', 'LOW_CONFIDENCE']);
const CONCEPT_TIERS = new Set(['CORE_PILLAR', 'SUPPORTING_MECHANISM', 'OPTIONAL_CONTEXT', 'PRUNED']);

export class TeachingValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join('; '));
    this.name = 'TeachingValidationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => nonEmpty(item));
const nonEmptyStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every((item) => nonEmpty(item));
const sameStringArray = (left: string[] | undefined, right: string[] | undefined) =>
  Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => item === right[index]);

function unknownReference(kind: string, owner: string, id: string) {
  return `UNKNOWN_${kind}_REFERENCE: ${owner} references ${id}, which does not exist in EpisodeTeachingAnalysis.`;
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(trimmed) as unknown;
  if (!isRecord(parsed)) throw new TeachingValidationError(['Model output must be a JSON object.']);
  return parsed;
}

function assertAnalysisShape(value: unknown): asserts value is EpisodeTeachingAnalysis {
  if (!isRecord(value)) throw new TeachingValidationError(['Analysis must be a JSON object.']);
  if (!Object.prototype.hasOwnProperty.call(value, 'schema_version')) throw new TeachingValidationError(['Analysis is missing schema_version.']);
  if (value.schema_version !== EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION) {
    throw new TeachingValidationError([`Unsupported analysis schema_version ${JSON.stringify(value.schema_version)}; expected ${EPISODE_TEACHING_ANALYSIS_SCHEMA_VERSION}.`]);
  }
  if (value.analysis_contract_version !== EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION) {
    throw new TeachingValidationError([`Unsupported analysis_contract_version ${JSON.stringify(value.analysis_contract_version)}; expected ${EPISODE_TEACHING_ANALYSIS_CONTRACT_VERSION}.`]);
  }
  if (!isRecord(value.analysis_metadata) || !isRecord(value.episode_thesis) || !Array.isArray(value.evidence_registry) || !Array.isArray(value.concepts)) {
    throw new TeachingValidationError(['Analysis is missing required top-level fields.']);
  }
}

export function validateAnalysis(value: unknown, analogyRiskThreshold = 0.35): EpisodeTeachingAnalysis {
  assertAnalysisShape(value);
  const analysis = value;
  const issues: string[] = [];
  const evidenceIds = new Set<string>();
  const conceptIds = new Set<string>();
  const invariantIds = new Set<string>();
  const misconceptionIds = new Set<string>();
  const analogyIds = new Set<string>();
  const analogyInvariantReferences: Array<{ analogyId: string; invariantIds: string[] | undefined }> = [];
  const selectedAnalogies: Array<{ conceptId: string; analogyId: string }> = [];

  for (const evidence of analysis.evidence_registry) {
    if (!isRecord(evidence) || !nonEmpty(evidence.evidence_id) || !nonEmpty(evidence.source_id) || !nonEmpty(evidence.verbatim_span) || !nonEmpty(evidence.normalized_claim)) {
      issues.push('Every evidence entry needs ID, source, verbatim span, and normalized claim.');
      continue;
    }
    if (evidenceIds.has(evidence.evidence_id)) issues.push(`Duplicate evidence ID ${evidence.evidence_id}.`);
    evidenceIds.add(evidence.evidence_id);
  }

  for (const concept of analysis.concepts) {
    if (!isRecord(concept) || !nonEmpty(concept.concept_id) || !nonEmpty(concept.canonical_name) || !Array.isArray(concept.invariants) || concept.invariants.length === 0) {
      issues.push('Every concept needs an ID, name, and at least one invariant.');
      continue;
    }
    if (conceptIds.has(concept.concept_id)) issues.push(`Duplicate concept ID ${concept.concept_id}.`);
    conceptIds.add(concept.concept_id);
    if (!CONCEPT_TIERS.has(concept.tier) || !EPISTEMIC_STATUSES.has(concept.epistemic_status) || typeof concept.teaching_priority !== 'number' || concept.teaching_priority < 0 || concept.teaching_priority > 1) {
      issues.push(`Concept ${concept.concept_id} has an invalid tier, epistemic status, or priority.`);
    }
    if (!nonEmptyStringArray(concept.evidence_ids) || concept.evidence_ids.some((id) => !evidenceIds.has(id))) issues.push(`Concept ${concept.concept_id} references missing evidence.`);

    for (const invariant of concept.invariants) {
      if (!isRecord(invariant) || !nonEmpty(invariant.invariant_id) || !nonEmpty(invariant.statement) || !nonEmptyStringArray(invariant.evidence_ids) || !Array.isArray(invariant.forbidden_exaggerations)) {
        issues.push(`Concept ${concept.concept_id} has an invalid invariant.`);
        continue;
      }
      if (invariantIds.has(invariant.invariant_id)) issues.push(`Duplicate invariant ID ${invariant.invariant_id}.`);
      invariantIds.add(invariant.invariant_id);
      if (!CLAIM_TYPES.has(invariant.claim_type) || !EPISTEMIC_STATUSES.has(invariant.epistemic_status)) issues.push(`Invariant ${invariant.invariant_id} has invalid claim or epistemic status.`);
      if (invariant.evidence_ids.some((id) => !evidenceIds.has(id))) issues.push(`Invariant ${invariant.invariant_id} references missing evidence.`);
    }

    for (const relationship of concept.causal_relationships || []) {
      if (!isRecord(relationship) || !nonEmpty(relationship.statement) || !nonEmptyStringArray(relationship.evidence_ids) || relationship.evidence_ids.some((id) => !evidenceIds.has(id))) {
        issues.push(`Concept ${concept.concept_id} has a causal relationship without valid evidence.`);
      }
    }

    for (const misconception of concept.misconceptions || []) {
      if (!isRecord(misconception) || !nonEmpty(misconception.misconception_id)) {
        issues.push(`Concept ${concept.concept_id} has an invalid misconception.`);
        continue;
      }
      if (misconceptionIds.has(misconception.misconception_id)) issues.push(`Duplicate misconception ID ${misconception.misconception_id}.`);
      misconceptionIds.add(misconception.misconception_id);
    }

    for (const analogy of concept.analogy_candidates || []) {
      if (!isRecord(analogy) || !nonEmpty(analogy.analogy_id) || !nonEmpty(analogy.breakdown_boundary) || !Array.isArray(analogy.mapping) || !Array.isArray(analogy.forbidden_inferences) || typeof analogy.analogy_risk !== 'number') {
        issues.push(`Concept ${concept.concept_id} has an invalid analogy.`);
        continue;
      }
      if (analogyIds.has(analogy.analogy_id)) issues.push(`Duplicate analogy ID ${analogy.analogy_id}.`);
      analogyIds.add(analogy.analogy_id);
      if (analogy.analogy_risk < 0 || analogy.analogy_risk > 1) issues.push(`Analogy ${analogy.analogy_id} has invalid risk.`);
      analogyInvariantReferences.push({ analogyId: analogy.analogy_id, invariantIds: analogy.preserves_invariant_ids });
      if (concept.selected_analogy_id === analogy.analogy_id && analogy.analogy_risk > analogyRiskThreshold) issues.push(`Selected analogy ${analogy.analogy_id} exceeds risk threshold.`);
    }
    if (concept.selected_analogy_id) selectedAnalogies.push({ conceptId: concept.concept_id, analogyId: concept.selected_analogy_id });
  }

  for (const reference of analogyInvariantReferences) {
    if (!stringArray(reference.invariantIds) || reference.invariantIds.some((id) => !invariantIds.has(id))) issues.push(`Analogy ${reference.analogyId} references missing invariant.`);
  }
  for (const selected of selectedAnalogies) {
    if (!analogyIds.has(selected.analogyId)) issues.push(`Concept ${selected.conceptId} selects unknown analogy ${selected.analogyId}.`);
  }

  for (const concept of analysis.concepts) {
    for (const prerequisiteId of concept.prerequisite_concept_ids || []) {
      if (!conceptIds.has(prerequisiteId)) issues.push(`Concept ${concept.concept_id} references missing prerequisite ${prerequisiteId}.`);
      if (prerequisiteId === concept.concept_id) issues.push(`Concept ${concept.concept_id} cannot depend on itself.`);
    }
  }
  detectCycles(analysis.concepts.map((concept) => ({ id: concept.concept_id, deps: concept.prerequisite_concept_ids || [] })), issues);

  if (!CLAIM_TYPES.has(analysis.episode_thesis.claim_type) || !EPISTEMIC_STATUSES.has(analysis.episode_thesis.epistemic_status)) issues.push('Episode thesis has invalid claim or epistemic status.');
  if (!nonEmptyStringArray(analysis.episode_thesis.evidence_ids) || analysis.episode_thesis.evidence_ids.some((id) => !evidenceIds.has(id))) issues.push('Episode thesis references missing evidence.');
  if (issues.length) throw new TeachingValidationError(issues);
  return analysis;
}

export function validateBlueprint(value: unknown, analysis: EpisodeTeachingAnalysis): EpisodeTeachingBlueprint {
  if (!isRecord(value) || value.schema_version !== EPISODE_TEACHING_BLUEPRINT_SCHEMA_VERSION || !Array.isArray(value.turns) || value.turns.length < 2) {
    throw new TeachingValidationError(['Blueprint needs at least two turns.']);
  }
  const blueprint = value as unknown as EpisodeTeachingBlueprint;
  const issues: string[] = [];
  const conceptIds = new Set(analysis.concepts.map((concept) => concept.concept_id));
  const invariantIds = new Set(analysis.concepts.flatMap((concept) => concept.invariants.map((invariant) => invariant.invariant_id)));
  const misconceptionIds = new Set(analysis.concepts.flatMap((concept) => concept.misconceptions.map((misconception) => misconception.misconception_id)));
  const evidenceIds = new Set(analysis.evidence_registry.map((evidence) => evidence.evidence_id));
  const analogyIds = new Set(analysis.concepts.flatMap((concept) => concept.analogy_candidates.map((analogy) => analogy.analogy_id)));
  const invariantEvidence = new Map(analysis.concepts.flatMap((concept) => concept.invariants.map((invariant) => [
    invariant.invariant_id,
    new Set([...invariant.evidence_ids, ...concept.evidence_ids]),
  ] as const)));
  const turnIds = new Set<string>();
  const representedConcepts = new Set<string>();
  const handledMisconceptions = new Set<string>();
  let host2Turns = 0;
  let activeHost2Turns = 0;
  let sameSpeakerRun = 0;
  let previousSpeaker = '';

  for (const turn of blueprint.turns) {
    if (!nonEmpty(turn.turn_id) || !nonEmpty(turn.core_epistemic_payload)) issues.push('Every blueprint turn needs an ID and epistemic payload.');
    if (turnIds.has(turn.turn_id)) issues.push(`Duplicate blueprint turn ID ${turn.turn_id}.`);
    turnIds.add(turn.turn_id);
    if (turn.speaker === previousSpeaker) sameSpeakerRun += 1; else sameSpeakerRun = 1;
    previousSpeaker = turn.speaker;
    if (sameSpeakerRun > 2) issues.push('Blueprint has more than two consecutive turns by one host.');
    if (turn.speaker === 'HOST_2') {
      host2Turns += 1;
      if (HOST_2_AGENCY_INTENTS.has(turn.intent)) activeHost2Turns += 1;
    }
    for (const id of turn.concept_ids || []) { if (!conceptIds.has(id)) issues.push(unknownReference('CONCEPT', `Blueprint turn ${turn.turn_id}`, id)); else representedConcepts.add(id); }
    for (const id of turn.invariant_ids || []) {
      if (!invariantIds.has(id)) {
        issues.push(unknownReference('INVARIANT', `Blueprint turn ${turn.turn_id}`, id));
        continue;
      }
      const support = invariantEvidence.get(id) || new Set<string>();
      if (!(turn.evidence_ids || []).some((evidenceId) => support.has(evidenceId))) {
        issues.push(`MISSING_INVARIANT_EVIDENCE_BINDING: Blueprint turn ${turn.turn_id} references ${id} without an evidence ID inherited from that invariant or its concept.`);
      }
    }
    for (const id of turn.misconception_ids || []) { if (!misconceptionIds.has(id)) issues.push(unknownReference('MISCONCEPTION', `Blueprint turn ${turn.turn_id}`, id)); else handledMisconceptions.add(id); }
    for (const id of turn.evidence_ids || []) if (!evidenceIds.has(id)) issues.push(unknownReference('EVIDENCE', `Blueprint turn ${turn.turn_id}`, id));
    if (turn.analogy_id && !analogyIds.has(turn.analogy_id)) issues.push(unknownReference('ANALOGY', `Blueprint turn ${turn.turn_id}`, turn.analogy_id));
  }
  for (const concept of analysis.concepts.filter((concept) => concept.tier === 'CORE_PILLAR')) if (!representedConcepts.has(concept.concept_id)) issues.push(`Core concept ${concept.concept_id} is missing from blueprint.`);
  for (const misconception of analysis.concepts.flatMap((concept) => concept.misconceptions).filter((item) => item.severity === 'HIGH' && item.must_surface_in_dialogue)) if (!handledMisconceptions.has(misconception.misconception_id)) issues.push(`High-severity misconception ${misconception.misconception_id} is not handled.`);
  if (!host2Turns || activeHost2Turns / host2Turns < 0.7) issues.push('Host 2 agency is below 70%.');
  if (!blueprint.turns.some((turn) => turn.intent === 'CLOSE_LOOP' || turn.intent === 'SYNTHESIZE')) issues.push('Blueprint has no synthesis or loop closure.');
  if (issues.length) throw new TeachingValidationError(issues);
  return blueprint;
}

export function validateDialogue(value: unknown, blueprint: EpisodeTeachingBlueprint, analysis: EpisodeTeachingAnalysis): ProductionDialogueScript {
  if (!isRecord(value) || value.schema_version !== PRODUCTION_DIALOGUE_SCHEMA_VERSION || !Array.isArray(value.turns)) throw new TeachingValidationError(['Dialogue has an invalid shape.']);
  const script = value as unknown as ProductionDialogueScript;
  const issues: string[] = [];
  const blueprintById = new Map(blueprint.turns.map((turn) => [turn.turn_id, turn]));
  const realizedTurnIds = new Set<string>();
  const exactLines = new Set<string>();
  const forbidden = analysis.concepts.flatMap((concept) => concept.invariants.flatMap((invariant) => invariant.forbidden_exaggerations));
  if (script.turns.length !== blueprint.turns.length) issues.push('Dialogue must realize every blueprint turn exactly once.');
  for (const turn of script.turns) {
    const planned = blueprintById.get(turn.turn_id);
    if (!planned) { issues.push(`Dialogue includes unknown turn ${turn.turn_id}.`); continue; }
    if (realizedTurnIds.has(turn.turn_id)) issues.push(`Dialogue realizes blueprint turn ${turn.turn_id} more than once.`);
    realizedTurnIds.add(turn.turn_id);
    if (turn.speaker !== planned.speaker) issues.push(`Dialogue turn ${turn.turn_id} has the wrong speaker.`);
    if (!sameStringArray(turn.concept_ids, planned.concept_ids)) issues.push(`Dialogue turn ${turn.turn_id} changes planned concept bindings.`);
    if (!sameStringArray(turn.invariant_ids, planned.invariant_ids)) issues.push(`Dialogue turn ${turn.turn_id} changes planned invariant bindings.`);
    if (!sameStringArray(turn.misconception_ids, planned.misconception_ids)) issues.push(`Dialogue turn ${turn.turn_id} changes planned misconception bindings.`);
    if (!sameStringArray(turn.evidence_ids, planned.evidence_ids)) issues.push(`Dialogue turn ${turn.turn_id} changes planned evidence bindings.`);
    if ((turn.analogy_id || null) !== (planned.analogy_id || null)) issues.push(`Dialogue turn ${turn.turn_id} changes planned analogy binding.`);
    if (!nonEmpty(turn.spoken_text) || turn.spoken_text.trim().split(/\s+/).length > 220) issues.push(`Dialogue turn ${turn.turn_id} has invalid length.`);
    if (turn.speaker === 'HOST_2' && PASSIVE_HOST_2.test(turn.spoken_text.trim())) issues.push(`Host 2 turn ${turn.turn_id} is passive banter.`);
    const normalized = turn.spoken_text.trim().toLowerCase();
    if (exactLines.has(normalized)) issues.push(`Dialogue duplicates a line at ${turn.turn_id}.`);
    exactLines.add(normalized);
    if (forbidden.some((phrase) => normalized.includes(phrase.toLowerCase()))) issues.push(`Dialogue turn ${turn.turn_id} repeats a registered forbidden exaggeration.`);
  }
  if (issues.length) throw new TeachingValidationError(issues);
  return script;
}

export function validateCriticReview(value: unknown, analysis?: EpisodeTeachingAnalysis, blueprint?: EpisodeTeachingBlueprint): CriticReview {
  if (!isRecord(value) || (value.verdict !== 'PASS' && value.verdict !== 'REPAIR_REQUIRED') || !Array.isArray(value.defects)) {
    throw new TeachingValidationError(['Critic review has an invalid shape.']);
  }
  if (value.verdict === 'PASS' && value.defects.some((defect) => isRecord(defect) && defect.severity === 'HARD_BLOCKER')) {
    throw new TeachingValidationError(['A passing fidelity review cannot contain a hard blocker.']);
  }
  if (analysis && blueprint) {
    const turnIds = new Set(blueprint.turns.map((turn) => turn.turn_id));
    const conceptIds = new Set(analysis.concepts.map((concept) => concept.concept_id));
    const invariantIds = new Set(analysis.concepts.flatMap((concept) => concept.invariants.map((invariant) => invariant.invariant_id)));
    const evidenceIds = new Set(analysis.evidence_registry.map((evidence) => evidence.evidence_id));
    const issues: string[] = [];
    for (const defect of value.defects) {
      if (!isRecord(defect)) { issues.push('Critic review contains an invalid defect.'); continue; }
      for (const id of Array.isArray(defect.turn_ids) ? defect.turn_ids : []) if (!turnIds.has(id)) issues.push(`UNKNOWN_TURN_REFERENCE: Fidelity defect references ${id}, which does not exist in EpisodeTeachingBlueprint.`);
      for (const id of Array.isArray(defect.concept_ids) ? defect.concept_ids : []) if (!conceptIds.has(id)) issues.push(unknownReference('CONCEPT', 'Fidelity defect', id));
      for (const id of Array.isArray(defect.invariant_ids) ? defect.invariant_ids : []) if (!invariantIds.has(id)) issues.push(unknownReference('INVARIANT', 'Fidelity defect', id));
      for (const id of Array.isArray(defect.evidence_ids) ? defect.evidence_ids : []) if (!evidenceIds.has(id)) issues.push(unknownReference('EVIDENCE', 'Fidelity defect', id));
    }
    if (issues.length) throw new TeachingValidationError(issues);
  }
  return value as unknown as CriticReview;
}

function detectCycles(nodes: Array<{ id: string; deps: string[] }>, issues: string[]) {
  const dependencies = new Map(nodes.map((node) => [node.id, node.deps]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { issues.push(`Hard dependency cycle includes ${id}.`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of dependencies.get(id) || []) visit(dep);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of nodes) visit(node.id);
}
