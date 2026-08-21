import type { ProductionDialogueScript } from './types';

export type Host1ValidationCategory = 'PURE_AFFIRMATION' | 'LEARNER_EVALUATION' | 'META_PRAISE' | 'IDEA_VALIDATION';

export interface Host1ValidationPrefix {
  category: Host1ValidationCategory;
  removed_text: string;
  separator: '.' | '!' | ':' | ',';
}

export interface Host1OpeningRepair {
  turn_id: string;
  repair_type: 'HOST1_TEACHER_VALIDATION_REMOVAL';
  category: Host1ValidationCategory;
  removed_text: string;
  original_text: string;
  repaired_text: string;
  applied: boolean;
  warning?: 'HOST1_UNREPAIRABLE_VALIDATION_ONLY';
}

const patterns: Array<{ category: Host1ValidationCategory; expression: RegExp }> = [
  { category: 'LEARNER_EVALUATION', expression: /^you(?:'|’)ve\s+(?:identified|highlighted|hit\s+on)\s+(?:(?:the|a|an)\s+)?(?:key|critical|important|core|crucial)\s+(?:problem|point|idea|distinction)(?:\s+here)?/i },
  { category: 'LEARNER_EVALUATION', expression: /^you(?:'|’)ve\s+got\s+(?:the\s+)?(?:core|key)\s+idea/i },
  { category: 'META_PRAISE', expression: /^that(?:'|’)s\s+(?:an?\s+)?(?:excellent|great|perfect|very\s+helpful)\s+(?:way\s+to\s+(?:put|think\s+about)\s+it|observation|question|analogy|summary)/i },
  { category: 'META_PRAISE', expression: /^(?:great|excellent)\s+(?:observation|question|point)/i },
  { category: 'META_PRAISE', expression: /^that\s+observation\s+highlights\s+(?:a\s+)?(?:critical|key|important)\s+(?:design\s+aspect|point|distinction)(?:\s+of\s+\w+)?/i },
  { category: 'IDEA_VALIDATION', expression: /^that(?:'|’)s\s+precisely\s+how\s+it\s+works/i },
  { category: 'IDEA_VALIDATION', expression: /^that\s+analogy\s+(?:works\s+(?:very\s+)?well(?:\s+for\s+(?:the\s+)?(?:initiation|timing)\s+(?:part|aspect))?|captures\s+(?:the\s+)?core\s+idea(?:\s+beautifully)?)/i },
  { category: 'IDEA_VALIDATION', expression: /^that\s+captures\s+it\s+well/i },
  { category: 'IDEA_VALIDATION', expression: /^that(?:'|’)s\s+a\s+(?:crucial|key|important)\s+distinction/i },
  { category: 'IDEA_VALIDATION', expression: /^that(?:'|’)s\s+the\s+right\s+way\s+to\s+think\s+about\s+it/i },
  { category: 'PURE_AFFIRMATION', expression: /^(?:that(?:'|’)s\s+)?exactly\s+(?:right|it)/i },
  { category: 'PURE_AFFIRMATION', expression: /^(?:exactly|precisely|absolutely|correct)/i },
];

function separatorAt(text: string, start: number) {
  const match = text.slice(start).match(/^\s*([.!:,])(?:\s+|$)/);
  return match ? { value: match[1] as Host1ValidationPrefix['separator'], length: match[0].length } : null;
}

/** Detect only evaluative openings. Contrastive responses such as “Right—but …” intentionally do not match. */
export function detectHost1ValidationPrefix(text: string): Host1ValidationPrefix | null {
  for (const candidate of patterns) {
    const match = text.match(candidate.expression);
    if (!match || match.index !== 0) continue;
    const separator = separatorAt(text, match[0].length);
    if (!separator) continue;
    return {
      category: candidate.category,
      removed_text: text.slice(0, match[0].length + separator.length).trim(),
      separator: separator.value,
    };
  }
  return null;
}

function directRemainder(prefix: Host1ValidationPrefix, original: string) {
  const remainder = original.slice(prefix.removed_text.length).trim();
  if (prefix.category === 'LEARNER_EVALUATION' && prefix.separator === ':' && /^[a-z]/.test(remainder)) {
    return `That's ${remainder}`;
  }
  return remainder;
}

export function repairHost1ValidationOpenings(dialogue: ProductionDialogueScript): { dialogue: ProductionDialogueScript; repairs: Host1OpeningRepair[] } {
  const repairs: Host1OpeningRepair[] = [];
  const turns = dialogue.turns.map((turn) => {
    if (turn.speaker !== 'HOST_1') return turn;
    const prefix = detectHost1ValidationPrefix(turn.spoken_text);
    if (!prefix) return turn;
    const repaired = directRemainder(prefix, turn.spoken_text);
    const base = {
      turn_id: turn.turn_id,
      repair_type: 'HOST1_TEACHER_VALIDATION_REMOVAL' as const,
      category: prefix.category,
      removed_text: prefix.removed_text,
      original_text: turn.spoken_text,
    };
    if (!/[A-Za-z]/.test(repaired) || repaired.split(/\s+/).length < 3) {
      repairs.push({ ...base, repaired_text: turn.spoken_text, applied: false, warning: 'HOST1_UNREPAIRABLE_VALIDATION_ONLY' });
      return turn;
    }
    repairs.push({ ...base, repaired_text: repaired, applied: true });
    return { ...turn, spoken_text: repaired };
  });
  return { dialogue: { ...dialogue, turns }, repairs };
}
