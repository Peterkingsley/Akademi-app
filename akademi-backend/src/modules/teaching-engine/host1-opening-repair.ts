import type { ProductionDialogueScript } from './types';

export type Host1OpeningRepairClass = 'PURE_AFFIRMATION' | 'PRAISE_EVALUATION' | 'META_VALIDATION';
export interface Host1OpeningRepair {
  turn_id: string;
  repair_type: 'HOST1_VALIDATION_PREFIX_REMOVAL';
  prefix_class: Host1OpeningRepairClass;
  removed_text: string;
  original_text: string;
  repaired_text: string;
  applied: boolean;
  warning?: string;
}

const prefixes: Array<{ kind: Host1OpeningRepairClass; phrase: string }> = [
  { kind: 'PURE_AFFIRMATION', phrase: 'Exactly right' }, { kind: 'PURE_AFFIRMATION', phrase: 'Exactly' },
  { kind: 'PURE_AFFIRMATION', phrase: 'Precisely' }, { kind: 'PURE_AFFIRMATION', phrase: 'Absolutely' }, { kind: 'PURE_AFFIRMATION', phrase: 'Correct' },
  { kind: 'PRAISE_EVALUATION', phrase: "That's a very helpful way to think about it" }, { kind: 'PRAISE_EVALUATION', phrase: "That's a great way to put it" },
  { kind: 'PRAISE_EVALUATION', phrase: "That's excellent" }, { kind: 'PRAISE_EVALUATION', phrase: 'Great question' },
  { kind: 'META_VALIDATION', phrase: "You've highlighted a critical point" }, { kind: 'META_VALIDATION', phrase: "You've got it" },
  { kind: 'META_VALIDATION', phrase: "That's a comprehensive summary" }, { kind: 'META_VALIDATION', phrase: "You've identified the key idea" },
];

function prefixMatch(text: string) {
  return prefixes
    .sort((a, b) => b.phrase.length - a.phrase.length)
    .map((item) => ({ ...item, match: text.match(new RegExp(`^${item.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[!.]+(?:\\s+|$)|,\\s+)`, 'i')) }))
    .find((item) => item.match);
}

export function repairHost1ValidationOpenings(dialogue: ProductionDialogueScript): { dialogue: ProductionDialogueScript; repairs: Host1OpeningRepair[] } {
  const repairs: Host1OpeningRepair[] = [];
  const turns = dialogue.turns.map((turn) => {
    if (turn.speaker !== 'HOST_1') return turn;
    const found = prefixMatch(turn.spoken_text);
    if (!found?.match) return turn;
    const remainder = turn.spoken_text.slice(found.match[0].length).trim();
    const base = { turn_id: turn.turn_id, repair_type: 'HOST1_VALIDATION_PREFIX_REMOVAL' as const, prefix_class: found.kind, removed_text: found.match[0].trim(), original_text: turn.spoken_text };
    if (!/[A-Za-z]/.test(remainder) || remainder.split(/\s+/).length < 3) {
      repairs.push({ ...base, repaired_text: turn.spoken_text, applied: false, warning: 'Prefix removal would leave no independently meaningful substantive clause.' });
      return turn;
    }
    repairs.push({ ...base, repaired_text: remainder, applied: true });
    return { ...turn, spoken_text: remainder };
  });
  return { dialogue: { ...dialogue, turns }, repairs };
}
