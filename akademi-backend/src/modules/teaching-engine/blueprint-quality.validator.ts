import type { EpisodeTeachingBlueprint } from './types';

export type BlueprintQualityIssueType = 'HOST2_OVERCOMPLETE_PAYLOAD';
export type Host2OvercompletePayloadSignal =
  | 'SUMMARY_LANGUAGE'
  | 'LONG_RELATIVE_TO_HOST2'
  | 'MULTI_CONCLUSION'
  | 'MULTIPLE_RESULT_CLAUSES'
  | 'TERMINAL_GLOBAL_RECAP'
  | 'MECHANISM_PLUS_QUALIFICATION'
  | 'QUALIFICATION_CLAUSE'
  | 'GLOBAL_OUTCOME_CLAUSE'
  | 'RECOVERY_CLAUSE'
  | 'EXCEPTION_CLAUSE'
  | 'HIGH_PAYLOAD_DENSITY';

export interface BlueprintQualityIssue {
  type: BlueprintQualityIssueType;
  turn_id: string;
  payload: string;
  signals: Host2OvercompletePayloadSignal[];
  reason: string;
}

export interface BlueprintQualityReport {
  verdict: 'PASS' | 'PASS_WITH_WARNINGS';
  metrics: {
    host2_agency_ratio: number;
    host2_overcomplete_payload_count: number;
    host2_overcomplete_payload_rate: number;
  };
  issues: BlueprintQualityIssue[];
}

const activeHost2 = new Set(['DEDUCE', 'CHALLENGE', 'REFRAME', 'TEST_ANALOGY', 'SYNTHESIZE', 'CHECK_UNDERSTANDING']);
const synthesisLikeHost2 = new Set(['DEDUCE', 'REFRAME', 'SYNTHESIZE', 'CHECK_UNDERSTANDING']);
const summaryLanguage = /\b(?:summari[sz]e|in summary|so the picture is|putting that together|overall|the takeaway|in conclusion)\b/i;
const resultClauses = /\b(?:so|therefore|however|but|while|still|which means|and if)\b/gi;
const mechanismClause = /\b(?:randomi[sz](?:e|ed|ing|ation)|timeout|stagger|separat(?:e|ing)|reduc(?:e|es|ing|tion)|less likely|mitigat(?:e|es|ion)|prevent)\b/i;
const qualificationClause = /\b(?:do(?:es)?n't\s+(?:make|eliminate)|do\s+not\s+(?:make|eliminate)|not\s+guaranteed|cannot\s+guarantee|can't\s+guarantee|rare\s+but\s+possible|less\s+likely\s*,?\s*(?:but|not)\s+impossible|still\s+possible|can\s+still\s+happen|not\s+a\s+silver\s+bullet)\b/i;
const exceptionClause = /\b(?:rare\s+but\s+possible|still\s+possible|can\s+still\s+happen|occasional(?:ly)?|by\s+chance|not\s+a\s+silver\s+bullet)\b/i;
const recoveryClause = /\b(?:retry|try again|new election|another chance|recover|recovery|next term|another round)\b/i;
const globalOutcomeClause = /\b(?:efficient(?:ly)?|reliable|reliably|robust|stable|successful|resilient|availability|ensure(?:s|d)?\s+progress|leader\s+election\s+(?:works|will\s+work)|system\s+(?:works|will\s+work)|overall\s+reliability|eventually|over\s+multiple\s+terms|liveness)\b/i;
const causalConsequenceClause = /\b(?:majority|head start|single candidate|successful election|contention)\b/i;

function host2MedianWordCount(blueprint: EpisodeTeachingBlueprint, index: number) {
  const counts = blueprint.turns.slice(0, index).filter((turn) => turn.speaker === 'HOST_2').map((turn) => turn.core_epistemic_payload.trim().split(/\s+/).filter(Boolean).length).sort((a, b) => a - b);
  return counts.length ? counts[Math.floor(counts.length / 2)] : 0;
}

function overcompleteSignals(blueprint: EpisodeTeachingBlueprint, index: number): Host2OvercompletePayloadSignal[] {
  const turn = blueprint.turns[index];
  const payload = turn.core_epistemic_payload.trim();
  const lower = payload.toLowerCase();
  const signals: Host2OvercompletePayloadSignal[] = [];
  const wordCount = payload.split(/\s+/).filter(Boolean).length;
  const hasMechanism = mechanismClause.test(payload);
  const hasQualification = qualificationClause.test(payload);
  const hasException = exceptionClause.test(payload);
  const hasRecovery = recoveryClause.test(payload);
  const hasGlobalOutcome = globalOutcomeClause.test(payload);
  const hasCausalConsequence = causalConsequenceClause.test(payload);
  const conceptualLayerCount = [hasMechanism, hasQualification, hasRecovery, hasGlobalOutcome, hasCausalConsequence].filter(Boolean).length;
  const connectorCount = new Set(Array.from(lower.matchAll(resultClauses), (match) => match[0])).size;
  if (summaryLanguage.test(payload)) signals.push('SUMMARY_LANGUAGE');
  if (wordCount >= Math.max(30, host2MedianWordCount(blueprint, index) + 12)) signals.push('LONG_RELATIVE_TO_HOST2');
  if (hasQualification) signals.push('QUALIFICATION_CLAUSE');
  if (hasException) signals.push('EXCEPTION_CLAUSE');
  if (hasRecovery) signals.push('RECOVERY_CLAUSE');
  if (hasGlobalOutcome) signals.push('GLOBAL_OUTCOME_CLAUSE');
  if (hasMechanism && hasQualification) signals.push('MECHANISM_PLUS_QUALIFICATION');
  if (conceptualLayerCount >= 3) signals.push('MULTI_CONCLUSION');
  if (conceptualLayerCount >= 3 && wordCount <= 60) signals.push('HIGH_PAYLOAD_DENSITY');
  if (connectorCount >= 3) signals.push('MULTIPLE_RESULT_CLAUSES');
  if (index >= blueprint.turns.length - 3 && conceptualLayerCount >= 3 && (hasGlobalOutcome || summaryLanguage.test(payload))) signals.push('TERMINAL_GLOBAL_RECAP');
  return signals;
}

export function validateBlueprintQuality(blueprint: EpisodeTeachingBlueprint): BlueprintQualityReport {
  const issues: BlueprintQualityIssue[] = [];
  const host2 = blueprint.turns.filter((turn) => turn.speaker === 'HOST_2');
  for (let index = 0; index < blueprint.turns.length; index += 1) {
    const turn = blueprint.turns[index];
    if (turn.speaker !== 'HOST_2' || !synthesisLikeHost2.has(turn.intent)) continue;
    const signals = overcompleteSignals(blueprint, index);
    if (signals.includes('MULTI_CONCLUSION')) {
      issues.push({
        type: 'HOST2_OVERCOMPLETE_PAYLOAD', turn_id: turn.turn_id, payload: turn.core_epistemic_payload, signals,
        reason: 'Host 2 plans a finished recap spanning three or more established conclusions. Keep the learner on one local relationship, or at most two tightly connected conclusions; let Host 1 add remaining qualification or recovery behavior.',
      });
    }
  }
  const agency = host2.filter((turn) => activeHost2.has(turn.intent)).length / Math.max(1, host2.length);
  return {
    verdict: issues.length ? 'PASS_WITH_WARNINGS' : 'PASS',
    metrics: {
      host2_agency_ratio: Number(agency.toFixed(2)),
      host2_overcomplete_payload_count: issues.length,
      host2_overcomplete_payload_rate: Number((issues.length / Math.max(1, host2.length)).toFixed(2)),
    },
    issues,
  };
}
