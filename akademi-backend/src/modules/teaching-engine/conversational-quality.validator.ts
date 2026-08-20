import type { EpisodeTeachingAnalysis, ProductionDialogueScript } from './types';

export type ConversationalQualityIssueType = 'REPETITIVE_AFFIRMATION' | 'UNSUPPORTED_INTENSITY' | 'HOST2_LEADING_QUESTION' | 'HOST2_ECHO' | 'HOST2_PREPACKAGED_SYNTHESIS' | 'REPEATED_OPENER' | 'REPEATED_EXCHANGE_PATTERN';
export type Host2PrepackagedSynthesisSignal = 'SUMMARY_OPENER' | 'LONG_COMPARED_TO_HOST2_TURNS' | 'MULTI_CONCLUSION' | 'MULTIPLE_DISCOURSE_CONNECTORS' | 'HIGH_PRIOR_TURN_OVERLAP' | 'LOW_NOVEL_RELATIONSHIP_GAIN';

export interface ConversationalQualityIssue {
  type: ConversationalQualityIssueType;
  turn_id: string;
  phrase: string;
  evidence_ids: string[];
  reason: string;
  intensity_context?: 'ASSERTED_INTENSITY' | 'HYPOTHESIS_INTENSITY' | 'NEGATED_INTENSITY';
  signals?: Host2PrepackagedSynthesisSignal[];
}

export interface ConversationalQualityReport {
  verdict: 'PASS' | 'PASS_WITH_WARNINGS';
  metrics: {
    host2_agency_ratio: number;
    host2_leading_question_rate: number;
    host2_echo_rate: number;
    affirmation_count: number;
    affirmation_rate: number;
    unsupported_intensity_count: number;
    asserted_intensity_count: number;
    hypothesis_intensity_count: number;
    negated_intensity_count: number;
    repeated_opener_rate: number;
    passive_turn_count: number;
    host2_prepackaged_synthesis_count: number;
    host2_prepackaged_synthesis_rate: number;
  };
  repeated_affirmation_patterns: string[];
  repeated_turn_openers: string[];
  repeated_exchange_patterns: string[];
  issues: ConversationalQualityIssue[];
}

export const conversationalQualityConfig = {
  echoJaccardThreshold: 0.35,
  repeatedOpenerMinimum: 2,
} as const;

const affirmation = /^(?:exactly(?: right)?|that's exactly right|that's excellent|great question|you're spot on|that's a great way to put it|precisely|correct|absolutely|you've got it)[!,. ]*/i;
const intensityTerms = ['cripple', 'catastrophic', 'disastrous', 'completely', 'totally', 'permanently', 'guaranteed', 'inevitable', 'impossible', 'always', 'never', 'absolutely', 'instantly', 'perfectly', 'massive', 'devastating'];
const novelty = /\b(?:because|but|while|if|unless|instead|therefore|which means|for example|imagine|however|reason)\b/i;
const activeHost2 = new Set(['DEDUCE', 'CHALLENGE', 'TEST_ANALOGY', 'REFRAME', 'SYNTHESIZE', 'CLOSE_LOOP']);
const summaryOpener = /^(?:okay,?\s+so|so basically|in summary|so the picture is|what this means is|so we(?:'ve| have) got|putting that together)\b/i;
const relationshipGain = /\b(?:if|would|could|might|why|how|unless|instead|imagine|for example|compare|versus)\b/i;
const discourseConnectors = /\b(?:so|which makes|which means|however|therefore|but|and if|while|still)\b/gi;
const stopWords = new Set(['about', 'after', 'again', 'also', 'another', 'because', 'being', 'between', 'candidate', 'candidates', 'chance', 'cluster', 'could', 'does', 'election', 'elections', 'entirely', 'every', 'from', 'have', 'into', 'just', 'leader', 'leaders', 'like', 'makes', 'means', 'more', 'most', 'need', 'only', 'other', 'over', 'really', 'server', 'servers', 'split', 'still', 'system', 'that', 'their', 'there', 'these', 'this', 'those', 'timeout', 'timeouts', 'under', 'what', 'when', 'where', 'which', 'while', 'with', 'would']);

function tokens(text: string) {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2));
}

function jaccard(left: string, right: string) {
  const a = tokens(left); const b = tokens(right);
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / Math.max(1, a.size + b.size - intersection);
}

function meaningfulTokens(text: string) {
  return [...tokens(text)].filter((word) => !stopWords.has(word));
}

function priorHost1Text(turns: ProductionDialogueScript['turns'], index: number) {
  return turns.slice(0, index).filter((turn) => turn.speaker === 'HOST_1').map((turn) => turn.spoken_text).join(' ');
}

function priorHost2WordMedian(turns: ProductionDialogueScript['turns'], index: number) {
  const counts = turns.slice(0, index).filter((turn) => turn.speaker === 'HOST_2').map((turn) => turn.spoken_text.trim().split(/\s+/).filter(Boolean).length).sort((a, b) => a - b);
  if (!counts.length) return 0;
  return counts[Math.floor(counts.length / 2)];
}

function prepackagedSynthesisSignals(turns: ProductionDialogueScript['turns'], index: number): Host2PrepackagedSynthesisSignal[] {
  const text = turns[index].spoken_text.trim();
  if (/\?|\b(?:wait|wouldn't|couldn't|how|why)\b/i.test(text) || (relationshipGain.test(text) && /\?$/.test(text))) return [];
  const signals: Host2PrepackagedSynthesisSignal[] = [];
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const priorHost1 = priorHost1Text(turns, index);
  const priorTokens = new Set(meaningfulTokens(priorHost1));
  const currentTokens = meaningfulTokens(text);
  const overlap = currentTokens.filter((word) => priorTokens.has(word)).length / Math.max(1, currentTokens.length);
  const novelRatio = currentTokens.filter((word) => !priorTokens.has(word)).length / Math.max(1, currentTokens.length);
  const connectorCount = new Set(Array.from(text.toLowerCase().matchAll(discourseConnectors), (match) => match[0])).size;
  const conclusionCount = [
    /\b(?:reduce|less likely|rare|stagger)\b/i,
    /\b(?:majority|one candidate|secure a leader)\b/i,
    /\b(?:not|still).{0,24}\b(?:impossible|possible|split vote|collision)\b/i,
    /\b(?:new election|another election|try again|retry|another chance)\b/i,
  ].filter((pattern) => pattern.test(text)).length;
  if (summaryOpener.test(text)) signals.push('SUMMARY_OPENER');
  if (wordCount >= Math.max(28, priorHost2WordMedian(turns, index) + 12)) signals.push('LONG_COMPARED_TO_HOST2_TURNS');
  if (conclusionCount >= 3 || (text.split(/[.!?]+/).filter(Boolean).length >= 3 && connectorCount >= 2)) signals.push('MULTI_CONCLUSION');
  if (connectorCount >= 3) signals.push('MULTIPLE_DISCOURSE_CONNECTORS');
  if (overlap >= 0.4) signals.push('HIGH_PRIOR_TURN_OVERLAP');
  if (currentTokens.length >= 8 && novelRatio <= 0.45) signals.push('LOW_NOVEL_RELATIONSHIP_GAIN');
  return signals;
}

function opener(text: string) {
  return text.toLowerCase().replace(/^[^a-z]+/, '').split(/\s+/).slice(0, 2).join(' ');
}

function intensityIsSupported(phrase: string, evidenceIds: string[], analysis: EpisodeTeachingAnalysis) {
  return evidenceIds.some((id) => {
    const evidence = analysis.evidence_registry.find((item) => item.evidence_id === id);
    return Boolean(evidence && `${evidence.verbatim_span} ${evidence.normalized_claim}`.toLowerCase().includes(phrase));
  });
}

export function validateConversationalQuality(dialogue: ProductionDialogueScript, analysis: EpisodeTeachingAnalysis): ConversationalQualityReport {
  const issues: ConversationalQualityIssue[] = [];
  const affirmations: string[] = [];
  const openerCounts = new Map<string, number>();
  const host2 = dialogue.turns.filter((turn) => turn.speaker === 'HOST_2');
  let leading = 0; let echoes = 0; let passive = 0; let prepackaged = 0;
  let assertedIntensity = 0; let hypothesisIntensity = 0; let negatedIntensity = 0;

  dialogue.turns.forEach((turn, index) => {
    const text = turn.spoken_text.trim();
    const match = text.match(affirmation);
    if (match) {
      affirmations.push(match[0].trim().toLowerCase());
      // A brief acknowledgement that immediately advances causal reasoning is allowed.
      if (!novelty.test(text.slice(match[0].length))) {
        issues.push({ type: 'REPETITIVE_AFFIRMATION', turn_id: turn.turn_id, phrase: match[0].trim(), evidence_ids: turn.evidence_ids, reason: 'Teacher affirmation does not immediately add a causal, boundary, or example-based contribution.' });
      }
    }
    const first = opener(text);
    if (first) openerCounts.set(first, (openerCounts.get(first) || 0) + 1);

    for (const word of intensityTerms) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(text) && !intensityIsSupported(word, turn.evidence_ids, analysis)) {
        const negated = new RegExp(`(?:not|isn't|is not|doesn't|does not|never)\\s+(?:\\w+\\s+){0,2}${word}`, 'i').test(text);
        const context = negated ? 'NEGATED_INTENSITY' : (turn.speaker === 'HOST_2' || /\?$/.test(text) ? 'HYPOTHESIS_INTENSITY' : 'ASSERTED_INTENSITY');
        if (context === 'ASSERTED_INTENSITY') assertedIntensity += 1;
        if (context === 'HYPOTHESIS_INTENSITY') hypothesisIntensity += 1;
        if (context === 'NEGATED_INTENSITY') negatedIntensity += 1;
        if (context === 'ASSERTED_INTENSITY') {
          issues.push({ type: 'UNSUPPORTED_INTENSITY', turn_id: turn.turn_id, phrase: word, evidence_ids: turn.evidence_ids, intensity_context: context, reason: 'Intensity word is asserted but is not present in the evidence bound to this turn.' });
        } else {
          issues.push({ type: 'UNSUPPORTED_INTENSITY', turn_id: turn.turn_id, phrase: word, evidence_ids: turn.evidence_ids, intensity_context: context, reason: context === 'NEGATED_INTENSITY' ? 'Intensity occurs in a negated statement; retained for review, not counted as asserted inflation.' : 'Intensity occurs in a learner hypothesis/question; retained for review, not counted as asserted inflation.' });
        }
      }
    }

    if (turn.speaker !== 'HOST_2') return;
    const previous = dialogue.turns[index - 1];
    const directLeading = /^(?:so .+\b(?:right|isn't it)\?|which means .+\?|so the answer is .+\?|doesn't that mean .+\?|so really (?:it'?s|it is) just .+\?)/i.test(text);
    const confirmationFrame = /^(?:so )?(?:what you're saying is|you're saying|basically|in other words,? you're saying|the idea is|really)/i.test(text);
    const overlapsPrevious = previous?.speaker === 'HOST_1' && jaccard(previous.spoken_text, text) >= conversationalQualityConfig.echoJaccardThreshold;
    const leadingQuestion = directLeading || (confirmationFrame && Boolean(overlapsPrevious) && !novelty.test(text));
    if (leadingQuestion && !/\bif\b|\bwould\b|\bwhy\b|\bhow\b/.test(text.toLowerCase())) {
      leading += 1;
      issues.push({ type: 'HOST2_LEADING_QUESTION', turn_id: turn.turn_id, phrase: text, evidence_ids: turn.evidence_ids, reason: 'Host 2 states the intended conclusion and merely appends a question.' });
    }
    if (previous?.speaker === 'HOST_1' && jaccard(previous.spoken_text, text) >= conversationalQualityConfig.echoJaccardThreshold && !novelty.test(text)) {
      echoes += 1;
      issues.push({ type: 'HOST2_ECHO', turn_id: turn.turn_id, phrase: text, evidence_ids: turn.evidence_ids, reason: 'High lexical overlap with the preceding Host 1 turn without a new causal connection, challenge, boundary, or example.' });
    }
    const synthesisSignals = prepackagedSynthesisSignals(dialogue.turns, index);
    if (synthesisSignals.length >= 3 && synthesisSignals.includes('MULTI_CONCLUSION') && (synthesisSignals.includes('SUMMARY_OPENER') || synthesisSignals.includes('HIGH_PRIOR_TURN_OVERLAP'))) {
      prepackaged += 1;
      issues.push({ type: 'HOST2_PREPACKAGED_SYNTHESIS', turn_id: turn.turn_id, phrase: text, evidence_ids: turn.evidence_ids, signals: synthesisSignals, reason: 'Host 2 packages several already-established conclusions as a polished recap without adding a new prediction, challenge, boundary test, contrast, or unresolved question.' });
    }
    if (!activeHost2.has(turn.intent)) passive += 1;
  });

  const repeatedOpeners = [...openerCounts.entries()].filter(([, count]) => count >= conversationalQualityConfig.repeatedOpenerMinimum).map(([value]) => value);
  for (const value of repeatedOpeners) issues.push({ type: 'REPEATED_OPENER', turn_id: dialogue.turns.find((turn) => opener(turn.spoken_text) === value)?.turn_id || 'unknown', phrase: value, evidence_ids: [], reason: 'Conversation opener repeats across multiple turns.' });
  const exchangePatterns: string[] = [];
  for (let index = 0; index < dialogue.turns.length - 1; index += 2) {
    const a = dialogue.turns[index]; const b = dialogue.turns[index + 1];
    if (a?.speaker === 'HOST_2' && b?.speaker === 'HOST_1' && affirmation.test(b.spoken_text)) exchangePatterns.push(`${opener(a.spoken_text)} → affirmation`);
  }
  const repeatedExchanges = [...new Set(exchangePatterns.filter((value, _, all) => all.filter((candidate) => candidate === value).length > 1))];
  for (const value of repeatedExchanges) issues.push({ type: 'REPEATED_EXCHANGE_PATTERN', turn_id: 'pattern', phrase: value, evidence_ids: [], reason: 'Repeated Host 2 prompt followed by teacher affirmation pattern.' });
  const agency = host2.filter((turn) => activeHost2.has(turn.intent)).length / Math.max(1, host2.length);
  return {
    verdict: issues.length ? 'PASS_WITH_WARNINGS' : 'PASS',
    metrics: {
      host2_agency_ratio: Number(agency.toFixed(2)), host2_leading_question_rate: Number((leading / Math.max(1, host2.length)).toFixed(2)), host2_echo_rate: Number((echoes / Math.max(1, host2.length)).toFixed(2)),
      affirmation_count: affirmations.length, affirmation_rate: Number((affirmations.length / Math.max(1, dialogue.turns.length)).toFixed(2)), unsupported_intensity_count: assertedIntensity,
      asserted_intensity_count: assertedIntensity, hypothesis_intensity_count: hypothesisIntensity, negated_intensity_count: negatedIntensity,
      repeated_opener_rate: Number((repeatedOpeners.length / Math.max(1, dialogue.turns.length)).toFixed(2)), passive_turn_count: passive, host2_prepackaged_synthesis_count: prepackaged, host2_prepackaged_synthesis_rate: Number((prepackaged / Math.max(1, host2.length)).toFixed(2)),
    },
    repeated_affirmation_patterns: [...new Set(affirmations.filter((value, _, all) => all.filter((candidate) => candidate === value).length > 1))],
    repeated_turn_openers: repeatedOpeners,
    repeated_exchange_patterns: repeatedExchanges,
    issues,
  };
}
