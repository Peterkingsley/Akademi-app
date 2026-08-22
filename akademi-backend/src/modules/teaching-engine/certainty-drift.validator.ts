import type { EpisodeTeachingAnalysis, ProductionDialogueScript } from './types';

export type CertaintyDriftWarningType = 'POSSIBLE_CERTAINTY_DRIFT' | 'CERTAINTY_DRIFT_HARD_BLOCKER';
export type CertaintySpeakerFunction = 'ASSERTED_CERTAINTY' | 'LEARNER_HYPOTHESIS_CERTAINTY' | 'NEGATED_CERTAINTY' | 'QUOTED_OR_MISCONCEPTION_CERTAINTY';
export type CertaintySupport = 'CERTAINTY_SUPPORTED' | 'CERTAINTY_UNSUPPORTED' | 'CERTAINTY_AMBIGUOUS';
export type CertaintyStrength = 'POSSIBLE' | 'LIKELY' | 'TYPICAL' | 'STRONG' | 'ABSOLUTE';

export interface CertaintyDriftWarning {
  type: CertaintyDriftWarningType;
  turn_id: string;
  phrase: string;
  evidence_ids: string[];
  reason: string;
  speaker_function: CertaintySpeakerFunction;
  support: CertaintySupport;
  dialogue_strength: CertaintyStrength;
  evidence_strength: CertaintyStrength;
}

const certaintyPatterns: Array<{ pattern: RegExp; phrase: string }> = [
  { pattern: /\bensur(?:e|es|ed|ing)\b/i, phrase: 'ensure' },
  { pattern: /\bguarantee(?:s|d|ing)?\b/i, phrase: 'guarantee' },
  { pattern: /\balways\b/i, phrase: 'always' },
  { pattern: /\binevitably\b/i, phrase: 'inevitably' },
  { pattern: /\bcertainly\b/i, phrase: 'certainly' },
  { pattern: /\bmust eventually\b/i, phrase: 'must eventually' },
  { pattern: /\bwill eventually\b/i, phrase: 'will eventually' },
  { pattern: /\beventually succeed(?:s|ed|ing)?\b/i, phrase: 'eventually succeed' },
  { pattern: /\bcannot fail\b/i, phrase: 'cannot fail' },
  { pattern: /\bimpossible to fail\b/i, phrase: 'impossible to fail' },
  { pattern: /\bnecessarily succeed(?:s|ed|ing)?\b/i, phrase: 'necessarily succeeds' },
  { pattern: /\b(?:completely|entirely|fully|absolutely)\s+(?:eliminat(?:e|es|ed|ing)|prevent(?:s|ed|ing)?|avoid(?:s|ed|ing)?|remov(?:e|es|ed|ing)|rule(?:s|d)?\s+out)\b/i, phrase: 'absolute elimination' },
  { pattern: /\bprevent(?:s|ed|ing)?\b/i, phrase: 'prevent' },
  { pattern: /\bcannot\s+(?:cast|grant|give)\s+(?:two|more than one)\s+votes?\b/i, phrase: 'cannot vote twice' },
];

interface BoundContext {
  evidence: string;
  invariants: string;
  epistemicStatuses: string[];
  claimTypes: string[];
}

function boundContext(turn: ProductionDialogueScript['turns'][number], analysis: EpisodeTeachingAnalysis): BoundContext {
  const invariants = analysis.concepts.flatMap((concept) => concept.invariants)
    .filter((item) => turn.invariant_ids.includes(item.invariant_id));
  return {
    evidence: analysis.evidence_registry.filter((item) => turn.evidence_ids.includes(item.evidence_id))
      .map((item) => `${item.verbatim_span} ${item.normalized_claim}`).join(' '),
    invariants: invariants.map((item) => item.statement).join(' '),
    epistemicStatuses: invariants.map((item) => item.epistemic_status),
    claimTypes: invariants.map((item) => item.claim_type),
  };
}

function affirmativeCertaintyText(text: string) {
  return text
    .replace(/\b(?:does?\s+not|do\s+not|cannot|can'?t)\s+(?:\w+\s+){0,3}(?:completely|entirely|fully|absolutely)\s+(?:eliminat(?:e|es|ed|ing)|prevent(?:s|ed|ing)?|avoid(?:s|ed|ing)?|remov(?:e|es|ed|ing)|rule(?:s|d)?\s+out)\b/gi, '')
    .replace(/\b(?:does?\s+not|do\s+not)\s+(?:\w+\s+){0,5}(?:always|never|guarantee(?:s|d)?|ensur(?:e|es|ed|ing)|impossible|cannot fail|must eventually|will eventually|eventually succeed(?:s|ed|ing)?)\b/gi, '')
    .replace(/\b(?:don't|doesn't|isn't|is\s+not|not)\s+(?:always|never|guarantee(?:s|d)?|ensur(?:e|es|ed|ing)|impossible|cannot fail|must eventually|will eventually|eventually succeed(?:s|ed|ing)?)\b/gi, '');
}

function strength(text: string): CertaintyStrength {
  const affirmative = affirmativeCertaintyText(text);
  if (/\b(?:always|never|guarantee(?:s|d)?|ensur(?:e|es|ed|ing)|prevent(?:s|ed|ing)?|impossible|cannot fail|must eventually|will eventually|eventually succeed(?:s|ed|ing)?|at most one|only one|(?:completely|entirely|fully|absolutely)\s+(?:eliminat(?:e|es|ed|ing)|prevent(?:s|ed|ing)?|avoid(?:s|ed|ing)?|remov(?:e|es|ed|ing)|rule(?:s|d)?\s+out))\b/i.test(affirmative)) return 'ABSOLUTE';
  if (/\b(?:very rare|strongly reduces?|drastically|significantly)\b/i.test(text)) return 'STRONG';
  if (/\b(?:usually|typically|generally)\b/i.test(text)) return 'TYPICAL';
  if (/\b(?:likely|unlikely)\b/i.test(text)) return 'LIKELY';
  return 'POSSIBLE';
}

function speakerFunction(turn: ProductionDialogueScript['turns'][number], match: RegExpMatchArray): CertaintySpeakerFunction {
  const index = match.index || 0;
  const before = turn.spoken_text.slice(0, index).toLowerCase();
  const nearby = turn.spoken_text.slice(Math.max(0, index - 40), index).toLowerCase();
  if (/\b(?:not|doesn't|does not|don't|do not|never|isn't|is not|cannot)(?:\s+\w+){0,4}\s*$/.test(nearby)) return 'NEGATED_CERTAINTY';
  if (/\b(?:misconception|believe|believes|assume|assumes|think|thinks|claim|claims|says|said)\b/.test(before) && /["“”']/.test(turn.spoken_text)) return 'QUOTED_OR_MISCONCEPTION_CERTAINTY';
  if (turn.speaker === 'HOST_2' && /\?/.test(turn.spoken_text)) return 'LEARNER_HYPOTHESIS_CERTAINTY';
  return 'ASSERTED_CERTAINTY';
}

function sourceSupportsAbsolute(context: BoundContext, phrase: string) {
  const source = affirmativeCertaintyText(`${context.evidence} ${context.invariants}`);
  if (phrase === 'cannot vote twice') return /\b(?:at most one|only one|cannot(?:\s+cast)?\s+two)\s+votes?\b/i.test(source);
  return /\b(?:always|never|guarantee(?:s|d)?|ensur(?:e|es|ed|ing)|inevitably|certainly|must eventually|will eventually|eventually succeed(?:s|ed|ing)?|cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i.test(source);
}

function supportFor(phrase: string, context: BoundContext, functionType: CertaintySpeakerFunction): CertaintySupport {
  if (functionType !== 'ASSERTED_CERTAINTY') return 'CERTAINTY_AMBIGUOUS';
  if (sourceSupportsAbsolute(context, phrase)) return 'CERTAINTY_SUPPORTED';
  const source = `${context.evidence} ${context.invariants}`;
  const probabilisticOrConditional = /\b(?:can|may|possible|chance|rare|less likely|reduce|another opportunity|retry|conditional)\b/i.test(source)
    || context.epistemicStatuses.some((status) => status !== 'CONFIRMED')
    || context.claimTypes.some((claimType) => claimType === 'SUPPORTED_INFERENCE');
  // “Always a tiny chance” is not “the failure always occurs,” but it still
  // claims the possibility can never be zero. Mere possibility supports the
  // safer wording “there is still a small chance,” not that universal claim.
  if (strength(source) !== 'ABSOLUTE' && probabilisticOrConditional) return 'CERTAINTY_UNSUPPORTED';
  return 'CERTAINTY_AMBIGUOUS';
}

function reasonFor(functionType: CertaintySpeakerFunction, support: CertaintySupport) {
  if (functionType === 'LEARNER_HYPOTHESIS_CERTAINTY') return 'Learner hypothesis certainty is informational only and remains available for misconception surfacing.';
  if (functionType === 'NEGATED_CERTAINTY') return 'Negated certainty does not assert the guarantee it mentions.';
  if (functionType === 'QUOTED_OR_MISCONCEPTION_CERTAINTY') return 'Quoted or misconception certainty is informational only.';
  if (support === 'CERTAINTY_SUPPORTED') return 'The bound evidence and invariant support equivalent certainty.';
  if (support === 'CERTAINTY_UNSUPPORTED') return 'An asserted certainty claim exceeds probabilistic or conditional bound evidence; it must be repaired even if the semantic critic passes it.';
  return 'The bound evidence does not prove equivalent certainty; Call 4 must review the semantic context.';
}

/** Clear asserted certainty mismatches are hard blockers; questions and negations are informational. */
export function detectPossibleCertaintyDrift(dialogue: ProductionDialogueScript, analysis: EpisodeTeachingAnalysis): CertaintyDriftWarning[] {
  return dialogue.turns.flatMap((turn) => {
    const found = certaintyPatterns.map((candidate) => ({ candidate, match: turn.spoken_text.match(candidate.pattern) })).find((item) => item.match);
    if (!found?.match) return [];
    const context = boundContext(turn, analysis);
    const functionType = speakerFunction(turn, found.match);
    const support = supportFor(found.candidate.phrase, context, functionType);
    if (functionType === 'ASSERTED_CERTAINTY' && support === 'CERTAINTY_SUPPORTED') return [];
    const dialogueStrength = strength(turn.spoken_text);
    const evidenceStrength = strength(`${context.evidence} ${context.invariants}`);
    const hardBlocker = functionType === 'ASSERTED_CERTAINTY' && support === 'CERTAINTY_UNSUPPORTED'
      && dialogueStrength === 'ABSOLUTE' && evidenceStrength !== 'ABSOLUTE';
    return [{
      type: hardBlocker ? 'CERTAINTY_DRIFT_HARD_BLOCKER' : 'POSSIBLE_CERTAINTY_DRIFT',
      turn_id: turn.turn_id,
      phrase: found.candidate.phrase,
      evidence_ids: turn.evidence_ids,
      reason: reasonFor(functionType, support),
      speaker_function: functionType,
      support,
      dialogue_strength: dialogueStrength,
      evidence_strength: evidenceStrength,
    }];
  });
}

export function certaintyHardBlockers(warnings: CertaintyDriftWarning[]) {
  return warnings.filter((warning) => warning.type === 'CERTAINTY_DRIFT_HARD_BLOCKER');
}
