import { aiProvider } from '../ai/ai.provider';
import { withTransientRetry } from '../../shared/ai/retryTransient';
import { answersMatch } from './answerNormalizer';

const MIN_MS_BETWEEN_CALLS = 4500; // same fallback-model per-minute cap as the archetype pipeline
const SOLVE_TEMPERATURE = 0.7; // high enough that 3 attempts are genuinely independent, not copies
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type SolveAttempt = { answer: string; rawText: string; steps: string[] };
export type VerifySolutionResult = {
  agreement: number; // 0-3: size of the largest cluster of matching answers
  consensusAnswer: string | null; // representative answer of that largest cluster, or null if no cluster
  solutions: SolveAttempt[];
  verdict: 'PASS' | 'FAIL';
};

function sanitizeJsonEscapes(text: string): string {
  const validEscapeChars = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
  let result = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString && ch === '\\') {
      const next = text[i + 1];
      if (next !== undefined && validEscapeChars.has(next)) {
        result += ch + next;
        i += 1;
      } else {
        result += '\\\\';
      }
      continue;
    }
    result += ch;
  }
  return result;
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(sanitizeJsonEscapes(cleaned));
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(sanitizeJsonEscapes(cleaned.slice(start, end + 1)));
    throw new Error('AI did not return valid JSON');
  }
}

// Solves the problem with NO knowledge of any claimed answer or of any other solve attempt — each
// call is a cold, independent solve. That independence is the entire point: agreement between
// attempts that couldn't have seen each other is real evidence, not an artifact of anchoring.
async function solveIndependently(problem: string): Promise<SolveAttempt> {
  const prompt = `Solve this problem completely, showing your full working.

PROBLEM:
${problem}

Format as JSON: { "steps": string[], "answer": string }
"steps" is your ordered working, one step per array entry. "answer" is your final answer alone — just the value/expression, no surrounding words like "the answer is".`;

  const { parsed, text } = await withTransientRetry(
    async () => {
      const { text } = await aiProvider.generateResponseWithModel(prompt, {
        systemPrompt: 'You are solving a math problem from scratch. You have not seen any other attempt at this problem and do not know if there is a claimed answer — solve it entirely on your own merits. Return ONLY valid JSON, no prose outside the JSON object.',
        maxTokens: 2000,
        extendedTimeouts: true,
        temperature: SOLVE_TEMPERATURE,
      });
      return { parsed: parseJsonObject(text), text };
    },
    { label: 'solve-independently' },
  );

  const answer = String(parsed?.answer ?? '').trim();
  const steps = Array.isArray(parsed?.steps) ? parsed.steps.map((s: any) => String(s).trim()).filter(Boolean) : [];
  return { answer, rawText: text, steps };
}

// Largest cluster of pairwise-matching answers among the 3 attempts (answersMatch is not
// necessarily transitive across floating-point tolerance, so this unions on ANY pairwise match
// rather than assuming a strict equivalence-class partition).
function largestAgreementCluster(solutions: SolveAttempt[]): { size: number; representative: string | null } {
  if (solutions.length === 0) return { size: 0, representative: null };
  let best = { size: 1, representative: solutions[0].answer };
  for (let i = 0; i < solutions.length; i += 1) {
    let clusterSize = 1;
    for (let j = 0; j < solutions.length; j += 1) {
      if (i === j) continue;
      if (answersMatch(solutions[i].answer, solutions[j].answer)) clusterSize += 1;
    }
    if (clusterSize > best.size) best = { size: clusterSize, representative: solutions[i].answer };
  }
  return best;
}

export async function verifySolution(problem: string, claimedAnswer: string): Promise<VerifySolutionResult> {
  const solutions: SolveAttempt[] = [];
  for (let i = 0; i < 3; i += 1) {
    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    solutions.push(await solveIndependently(problem));
  }

  const { size: agreement, representative: consensusAnswer } = largestAgreementCluster(solutions);
  const verdict: 'PASS' | 'FAIL' = agreement >= 2 && consensusAnswer !== null && answersMatch(consensusAnswer, claimedAnswer) ? 'PASS' : 'FAIL';

  return { agreement, consensusAnswer, solutions, verdict };
}
