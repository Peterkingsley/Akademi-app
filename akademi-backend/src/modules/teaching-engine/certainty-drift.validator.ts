import type { EpisodeTeachingAnalysis, ProductionDialogueScript } from './types';

export type CertaintyDriftWarningType = 'POSSIBLE_CERTAINTY_DRIFT';

export interface CertaintyDriftWarning {
  type: CertaintyDriftWarningType;
  turn_id: string;
  phrase: string;
  evidence_ids: string[];
  reason: string;
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
  { pattern: /\bprevent(?:s|ed|ing)?\b/i, phrase: 'prevent' },
];

function sourceSupportsSameStrength(source: string, phrase: string) {
  const patterns: Record<string, RegExp> = {
    ensure: /\b(?:ensur(?:e|es|ed|ing)|guarantee(?:s|d|ing)?|inevitably|certainly|must eventually|will eventually|eventually succeed(?:s|ed|ing)?|cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i,
    guarantee: /\b(?:ensur(?:e|es|ed|ing)|guarantee(?:s|d|ing)?|inevitably|certainly|must eventually|will eventually|eventually succeed(?:s|ed|ing)?|cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i,
    always: /\balways\b/i,
    inevitably: /\b(?:inevitably|certainly|must eventually|will eventually|eventually succeed(?:s|ed|ing)?|cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i,
    certainly: /\b(?:inevitably|certainly|must eventually|will eventually|eventually succeed(?:s|ed|ing)?|cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i,
    'must eventually': /\b(?:must eventually|will eventually|eventually succeed(?:s|ed|ing)?|cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i,
    'will eventually': /\b(?:must eventually|will eventually|eventually succeed(?:s|ed|ing)?|cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i,
    'eventually succeed': /\b(?:must eventually|will eventually|eventually succeed(?:s|ed|ing)?|cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i,
    'cannot fail': /\b(?:cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i,
    'impossible to fail': /\b(?:cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i,
    'necessarily succeeds': /\b(?:cannot fail|impossible to fail|necessarily succeed(?:s|ed|ing)?)\b/i,
    prevent: /\b(?:prevent(?:s|ed|ing)?|impossible)\b/i,
  };
  return patterns[phrase]?.test(source) || false;
}

function boundSourceText(turn: ProductionDialogueScript['turns'][number], analysis: EpisodeTeachingAnalysis) {
  const evidence = analysis.evidence_registry
    .filter((item) => turn.evidence_ids.includes(item.evidence_id))
    .map((item) => `${item.verbatim_span} ${item.normalized_claim}`);
  const invariants = analysis.concepts
    .flatMap((concept) => concept.invariants)
    .filter((item) => turn.invariant_ids.includes(item.invariant_id))
    .flatMap((item) => [item.statement, ...item.forbidden_exaggerations]);
  return [...evidence, ...invariants].join(' ');
}

/**
 * This is deliberately a warning, not a semantic verdict. It makes certainty
 * jumps visible to Call 4, which retains authority to decide source support.
 */
export function detectPossibleCertaintyDrift(dialogue: ProductionDialogueScript, analysis: EpisodeTeachingAnalysis): CertaintyDriftWarning[] {
  return dialogue.turns.flatMap((turn) => {
    const source = boundSourceText(turn, analysis);
    const match = certaintyPatterns.find((candidate) => candidate.pattern.test(turn.spoken_text));
    if (!match || sourceSupportsSameStrength(source, match.phrase)) return [];
    return [{
      type: 'POSSIBLE_CERTAINTY_DRIFT' as const,
      turn_id: turn.turn_id,
      phrase: match.phrase,
      evidence_ids: turn.evidence_ids,
      reason: 'The dialogue uses guarantee-level language, but its bound evidence and invariants do not contain equivalent certainty. Call 4 must determine whether this is a CLAIM_EXAGGERATION.',
    }];
  });
}
