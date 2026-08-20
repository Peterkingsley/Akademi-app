import type { EpisodeTeachingBlueprint } from './types';

export type BlueprintQualityIssueType = 'HOST2_OVERCOMPLETE_PAYLOAD';
export type Host2OvercompletePayloadSignal = 'SUMMARY_LANGUAGE' | 'LONG_RELATIVE_TO_HOST2' | 'MULTI_CONCLUSION' | 'MULTIPLE_RESULT_CLAUSES' | 'TERMINAL_GLOBAL_RECAP';

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
  const conclusionCount = [
    /\b(?:reduce|less likely|rare(?:ly)?|stagger|mitigat(?:e|ion)|prevent)\b/i,
    /\b(?:majority|leader\s+(?:will|can)\s+be\s+elected|successful election|one candidate)\b/i,
    /\b(?:not|still|however|but).{0,40}\b(?:impossible|possible|eliminate|guarantee|collision|split vote)\b/i,
    /\b(?:retry|try again|new election|another chance|recover|recovery)\b/i,
    /\b(?:reliable|robust|eventually|over multiple terms|liveness)\b/i,
  ].filter((pattern) => pattern.test(payload)).length;
  const connectorCount = new Set(Array.from(lower.matchAll(resultClauses), (match) => match[0])).size;
  if (summaryLanguage.test(payload)) signals.push('SUMMARY_LANGUAGE');
  if (wordCount >= Math.max(30, host2MedianWordCount(blueprint, index) + 12)) signals.push('LONG_RELATIVE_TO_HOST2');
  if (conclusionCount >= 3) signals.push('MULTI_CONCLUSION');
  if (connectorCount >= 3) signals.push('MULTIPLE_RESULT_CLAUSES');
  if (index >= blueprint.turns.length - 3 && conclusionCount >= 3 && /\b(?:reliable|robust|eventually|overall|fundamental|key design)\b/i.test(payload)) signals.push('TERMINAL_GLOBAL_RECAP');
  return signals;
}

export function validateBlueprintQuality(blueprint: EpisodeTeachingBlueprint): BlueprintQualityReport {
  const issues: BlueprintQualityIssue[] = [];
  const host2 = blueprint.turns.filter((turn) => turn.speaker === 'HOST_2');
  for (let index = 0; index < blueprint.turns.length; index += 1) {
    const turn = blueprint.turns[index];
    if (turn.speaker !== 'HOST_2' || !synthesisLikeHost2.has(turn.intent)) continue;
    const signals = overcompleteSignals(blueprint, index);
    const strongContext = signals.includes('SUMMARY_LANGUAGE') || signals.includes('TERMINAL_GLOBAL_RECAP') || (signals.includes('LONG_RELATIVE_TO_HOST2') && signals.includes('MULTIPLE_RESULT_CLAUSES'));
    if (signals.includes('MULTI_CONCLUSION') && strongContext) {
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
