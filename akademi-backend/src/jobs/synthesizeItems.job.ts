import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';
import { verifySolution } from '../modules/verification/solutionVerification.service';
import { withTransientRetry } from '../shared/ai/retryTransient';

const MIN_MS_BETWEEN_CALLS = 4500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_MEMBER_EXAMPLES_IN_PROMPT = 10;
const MAX_INSTANTIATION_ATTEMPTS = 3;
const DIRECT_EVALUATION = 'DIRECT_EVALUATION';

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

// Deterministic PRNG (mulberry32) seeded from a string — so "seeded and reproducible" is literal:
// the same seed always produces the same slot-value picks.
function seedToInt(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return h;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Step 2: ItemModel synthesis ────────────────────────────────────────────────────────────────

type MemberExample = { problemText: string; solutionSteps: string[] };
type IncidentalSlot = { kind: string; pool: string[] };

function tokens(sig: string): string[] {
  return sig && sig !== DIRECT_EVALUATION ? sig.split(' -> ').map((s) => s.trim()).filter(Boolean) : [];
}

function tierFor(signature: string): number {
  if (signature === DIRECT_EVALUATION) return 1;
  return Math.max(1, tokens(signature).length);
}

function variabilityFor(tier: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (tier === 1) return 'LOW';
  if (tier === 2) return 'MEDIUM';
  return 'HIGH';
}

async function deriveStemTemplate(
  archetypeStem: string,
  method: string,
  members: MemberExample[],
): Promise<{ stemTemplate: string; incidentalSlots: Record<string, IncidentalSlot> }> {
  const sample = members.slice(0, MAX_MEMBER_EXAMPLES_IN_PROMPT);
  const prompt = `Here are ${sample.length} worked examples that all use the SAME solution technique: "${method}".

EXAMPLES:
${sample.map((m, i) => `${i + 1}. ${m.problemText}`).join('\n')}

Identify a generic STEM TEMPLATE for this family of problems, with placeholders in {curlyBraces} for whatever varies between examples (specific numbers, specific functions, specific coefficients — the incidental details), while keeping everything essential to the technique fixed. Then, for each placeholder, list the actual values you observed across the examples above.

Format as JSON: { "stemTemplate": string, "incidentalSlots": { "slotName": { "kind": "numeric" | "expression" | "text", "pool": string[] } } }
Every {placeholder} used in stemTemplate must have a matching entry in incidentalSlots.`;

  const parsed = await withTransientRetry(
    async () => {
      const { text } = await aiProvider.generateResponseWithModel(prompt, {
        systemPrompt: 'You identify the reusable template and varying slots across a family of worked math problems. Return ONLY valid JSON, no prose outside the JSON object.',
        maxTokens: 1500,
        extendedTimeouts: true,
        temperature: 0.3,
      });
      return parseJsonObject(text);
    },
    { label: 'derive-stem-template' },
  );

  const stemTemplate = String(parsed?.stemTemplate || archetypeStem);
  const rawSlots = parsed?.incidentalSlots && typeof parsed.incidentalSlots === 'object' ? parsed.incidentalSlots : {};
  const incidentalSlots: Record<string, IncidentalSlot> = {};
  for (const [name, val] of Object.entries<any>(rawSlots)) {
    incidentalSlots[name] = {
      kind: String(val?.kind || 'text'),
      pool: Array.isArray(val?.pool) ? val.pool.map((p: any) => String(p)) : [],
    };
  }
  return { stemTemplate, incidentalSlots };
}

export async function synthesizeItemModelsJob(courseCode: string): Promise<{ written: number; skipped: number }> {
  const km = await prisma.knowledgeModel.findFirst({ where: { courseCode, scope: 'COURSE' } });
  if (!km) throw new Error(`No course-scoped KnowledgeModel for ${courseCode} — run the archetype layer first.`);

  const archetypes = await prisma.archetype.findMany({ where: { modelId: km.id } });
  const eligible = archetypes.filter((a) => a.memberCount >= 2 && Array.isArray(a.memberExamples) && (a.memberExamples as any[]).length >= 2);
  console.log(`[synthesize-items] ${courseCode}: ${archetypes.length} archetypes, ${eligible.length} eligible (memberCount >= 2 with member examples).`);

  let written = 0;
  for (let i = 0; i < eligible.length; i += 1) {
    const archetype = eligible[i];
    const existing = await prisma.itemModel.findFirst({ where: { archetypeId: archetype.id } });
    if (existing) {
      console.log(`[synthesize-items] ItemModel already exists for archetype ${archetype.publicId}; skipping.`);
      continue;
    }

    if (i > 0) await sleep(MIN_MS_BETWEEN_CALLS);
    const members = archetype.memberExamples as unknown as MemberExample[];
    const { stemTemplate, incidentalSlots } = await deriveStemTemplate(archetype.canonicalStem, archetype.method, members);

    const tier = tierFor(archetype.actionSignature);
    const radicalIds = tokens(archetype.actionSignature);
    const solutionProcedure = archetype.actionSignature === DIRECT_EVALUATION ? ['direct evaluation — no distinctive technique beyond generic bookkeeping'] : radicalIds;

    await prisma.itemModel.create({
      data: {
        modelId: km.id,
        archetypeId: archetype.id,
        publicId: `IM-${archetype.publicId}`,
        targetKCIds: [], // KC extraction not built yet
        radicalIds,
        tier,
        tierSource: 'MODELLED',
        bloom: tier === 1 ? 'apply' : tier === 2 ? 'analyze' : 'evaluate',
        stemTemplate,
        incidentalSlots: incidentalSlots as any,
        variability: variabilityFor(tier),
        solutionProcedure,
        branchCoverageRequired: false,
        kind: 'STANDARD',
        minTraceEvidence: Math.min(archetype.memberCount, 2),
        harvestedStemRef: archetype.publicId,
        supportRungs: {
          create: [
            { ordinal: 1, support: 'FULL', stepsRemoved: [] },
            { ordinal: 2, support: 'FULL', stepsRemoved: [] },
            { ordinal: 3, support: 'FADED', stepsRemoved: [1], selfExplanationPrompt: 'Why does this last step work?' },
            { ordinal: 4, support: 'FADED', stepsRemoved: [1, 2], selfExplanationPrompt: 'Why do these last two steps work?' },
            { ordinal: 5, support: 'SOLO', stepsRemoved: [] },
            { ordinal: 6, support: 'SOLO', stepsRemoved: [] },
          ],
        },
      },
    });
    written += 1;
    console.log(`[synthesize-items] wrote ItemModel for ${archetype.publicId} (tier ${tier}, ${Object.keys(incidentalSlots).length} slots).`);
  }

  return { written, skipped: archetypes.length - eligible.length };
}

// ─── Step 3: instantiate 6 items per ItemModel, verify each, retry on FAIL ─────────────────────

function renderStem(template: string, slotValues: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name) => slotValues[name] ?? match);
}

function pickSlotValues(incidentalSlots: Record<string, IncidentalSlot>, seed: string): Record<string, string> {
  const rand = mulberry32(seedToInt(seed));
  const values: Record<string, string> = {};
  for (const [name, slot] of Object.entries(incidentalSlots)) {
    if (slot.pool.length === 0) {
      values[name] = '';
      continue;
    }
    const index = Math.floor(rand() * slot.pool.length);
    values[name] = slot.pool[index];
  }
  return values;
}

async function generateAndSolveInstance(renderedStem: string): Promise<{ steps: string[]; answer: string }> {
  const prompt = `Solve this problem completely, showing full working.

PROBLEM:
${renderedStem}

Format as JSON: { "steps": string[], "answer": string }
"steps" is your ordered working, one step per array entry. "answer" is your final answer alone.`;

  const parsed = await withTransientRetry(
    async () => {
      const { text } = await aiProvider.generateResponseWithModel(prompt, {
        systemPrompt: 'You solve math problems and show complete working. Return ONLY valid JSON, no prose outside the JSON object.',
        maxTokens: 2000,
        extendedTimeouts: true,
        temperature: 0.3,
      });
      return parseJsonObject(text);
    },
    { label: 'generate-instance' },
  );
  return {
    steps: Array.isArray(parsed?.steps) ? parsed.steps.map((s: any) => String(s).trim()).filter(Boolean) : [],
    answer: String(parsed?.answer ?? '').trim(),
  };
}

export type InstantiationReport = {
  itemModelsProcessed: number;
  itemsWritten: number;
  rungsAttempted: number;
  rungsDiscarded: number;
  totalGenerationAttempts: number;
  discardRate: number;
  topDiscardReasons: Array<{ reason: string; count: number }>;
};

// Categorizes a failed attempt so the final report can surface the most common reasons rather
// than just a raw discard count — a 0/3-agreement failure (the model itself can't solve the
// rendered instance) needs a different fix than a consensus/claimed mismatch (the slot values
// produced an ill-posed instance).
function classifyFailure(verification: { agreement: number; consensusAnswer: string | null }): string {
  if (verification.agreement === 0) return 'NO_AGREEMENT (0/3 independent solves matched each other)';
  if (verification.agreement === 1) return 'NO_AGREEMENT (only 1/3 independent solves matched)';
  return 'CONSENSUS_MISMATCH (solvers agreed with each other but not with the generated answer)';
}

export async function instantiateAndVerifyItemsJob(courseCode: string): Promise<InstantiationReport> {
  const km = await prisma.knowledgeModel.findFirst({ where: { courseCode, scope: 'COURSE' } });
  if (!km) throw new Error(`No course-scoped KnowledgeModel for ${courseCode}`);

  const itemModels = await prisma.itemModel.findMany({ where: { modelId: km.id }, include: { supportRungs: { orderBy: { ordinal: 'asc' } }, items: true } });
  console.log(`[synthesize-items] instantiating items for ${itemModels.length} ItemModels.`);

  let itemsWritten = 0;
  let rungsAttempted = 0;
  let rungsDiscarded = 0;
  let totalGenerationAttempts = 0;
  let firstCall = true;
  const discardReasonCounts: Record<string, number> = {};

  for (const im of itemModels) {
    const incidentalSlots = (im.incidentalSlots as unknown as Record<string, IncidentalSlot>) || {};
    for (const rung of im.supportRungs) {
      if (im.items.some((it) => it.rungOrdinal === rung.ordinal)) {
        console.log(`[synthesize-items] ${im.publicId} rung ${rung.ordinal} already has an item; skipping.`);
        continue;
      }
      rungsAttempted += 1;

      let written = false;
      let lastReason = 'GENERATION_ERROR (AI call failed on every attempt)';
      for (let attempt = 1; attempt <= MAX_INSTANTIATION_ATTEMPTS && !written; attempt += 1) {
        const seed = `${im.publicId}-rung${rung.ordinal}-attempt${attempt}`;
        const slotValues = pickSlotValues(incidentalSlots, seed);
        const renderedStem = renderStem(im.stemTemplate, slotValues);

        if (!firstCall) await sleep(MIN_MS_BETWEEN_CALLS);
        firstCall = false;
        totalGenerationAttempts += 1;

        // A persistent AI failure (retries exhausted inside withTransientRetry) must not crash
        // the whole job — it should count as a failed attempt on this rung, same as a FAIL
        // verdict, so the other 27 ItemModels' rungs still get processed.
        try {
          const { steps, answer } = await generateAndSolveInstance(renderedStem);

          await sleep(MIN_MS_BETWEEN_CALLS);
          const verification = await verifySolution(renderedStem, answer);

          if (verification.verdict === 'PASS') {
            await prisma.item.create({
              data: {
                itemModelId: im.id,
                surface: 'TEXTBOOK',
                seed,
                rungOrdinal: rung.ordinal,
                renderedStem,
                renderedSolution: steps,
                targetKCIds: [],
                solveAgreement: verification.agreement,
              },
            });
            itemsWritten += 1;
            written = true;
            console.log(`[synthesize-items] ${im.publicId} rung ${rung.ordinal}: PASS on attempt ${attempt} (agreement=${verification.agreement}).`);
          } else {
            lastReason = classifyFailure(verification);
            console.warn(`[synthesize-items] ${im.publicId} rung ${rung.ordinal}: FAIL on attempt ${attempt} (agreement=${verification.agreement}, claimed="${answer}", consensus="${verification.consensusAnswer}").`);
          }
        } catch (error) {
          lastReason = 'GENERATION_ERROR (AI call failed on every retry)';
          console.error(`[synthesize-items] ${im.publicId} rung ${rung.ordinal}: attempt ${attempt} threw — ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (!written) {
        rungsDiscarded += 1;
        discardReasonCounts[lastReason] = (discardReasonCounts[lastReason] || 0) + 1;
        console.error(`[synthesize-items] ${im.publicId} rung ${rung.ordinal}: discarded after ${MAX_INSTANTIATION_ATTEMPTS} failed attempts (${lastReason}).`);
      }
    }
  }

  const discardRate = rungsAttempted > 0 ? rungsDiscarded / rungsAttempted : 0;
  const topDiscardReasons = Object.entries(discardReasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return { itemModelsProcessed: itemModels.length, itemsWritten, rungsAttempted, rungsDiscarded, totalGenerationAttempts, discardRate, topDiscardReasons };
}
