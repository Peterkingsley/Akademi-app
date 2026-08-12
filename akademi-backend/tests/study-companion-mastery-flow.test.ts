import {
  computeCoverageScore,
  deriveFailedConcepts,
  sanitizeTutorStyle,
} from '../src/modules/sessions/study-companion-quality-relevance';
import {
  buildMemoryDumpPrompt,
  buildMasteryOutcome,
  evaluateMemoryDump,
} from '../src/modules/sessions/study-companion-teaching-pass';

const prefixSection = {
  key: 'prefixes',
  title: 'Some Important Abbreviations',
  content: [
    'Metric prefixes are shorthand for powers of ten.',
    'Symbol Prefix Multiplier Symbol Prefix Multiplier',
    'c m μ n',
    'Deci centi milli micro nano',
    '10 -1 10 -2 10 -3 10 -6 10 -9',
    'Kilo represents 10^3, milli represents 10^-3, micro represents 10^-6, and nano represents 10^-9.',
    'Use the multiplier when converting a prefixed quantity to its base unit.',
  ].join('\n'),
  status: 'IN_PROGRESS',
  pageStart: 2,
  pageEnd: 2,
} as any;

const decision = {
  strategy: 'definition_first',
  pace: 'normal',
  prerequisiteRepairMode: 'none',
  shouldUseAnalogy: false,
  shouldUseWorkedExample: false,
  shouldUseVisualExplanation: false,
  shouldUseCalculationSteps: false,
  shouldUseExamFraming: false,
  shouldChallengeStudent: false,
  shouldSlowDown: false,
  shouldRepairPrerequisite: false,
  repairConcepts: [],
  reason: 'test',
  promptDirectives: [],
  traceMetadata: {},
} as any;

describe('Study Companion mastery-flow regressions', () => {
  it('treats Hmmm as no recall evidence', () => {
    expect(computeCoverageScore(prefixSection, 'Hmmm')).toBe(0);
    expect(computeCoverageScore(prefixSection, 'I do not know')).toBe(0);
  });

  it('never exposes raw OCR/table rows as failed concepts', () => {
    const failed = deriveFailedConcepts(prefixSection, 'Hmmm');
    expect(failed).toEqual([
      'using metric-prefix multipliers correctly in unit conversions',
    ]);
    expect(failed.join(' ')).not.toMatch(/Symbol Prefix Multiplier|c m μ n|10 -1 10 -2/i);
  });

  it('uses a clean active-recall prompt instead of internal checkpoint-focus strings', async () => {
    const prompt = await buildMemoryDumpPrompt(
      prefixSection,
      decision,
      '',
      undefined,
      '',
      {
        checkpointFocus: [
          "Recall: What is the multiplier for the 'nan...",
          'Application (Prefixes): How many meters are...',
        ],
      } as any,
    );

    expect(prompt).toBe(
      'Active recall: Without checking your notes, explain the main rule or idea from this section in your own words, then give one correct example or application you remember.',
    );
    expect(prompt).not.toMatch(/nan\.\.\.|Application \(Prefixes\)|Memory Dump:/i);
  });

  it('scores a non-answer memory dump at zero without inventing partial mastery', async () => {
    const result = await evaluateMemoryDump(prefixSection, 'Hmmm');
    expect(result.score).toBe(0);
    expect(result.failedConcepts).toEqual([
      'using metric-prefix multipliers correctly in unit conversions',
    ]);
    expect(result.evaluation).not.toContain('?');
  });

  it('removes incomplete example tails and robotic acknowledgement wording', () => {
    const cleaned = sanitizeTutorStyle(
      "Yes, you are correct that milli is 10^-3. Let's simplify it. Simple Example: To convert 5 millimeters to meters:\n1.",
    );

    expect(cleaned).toMatch(/^Correct —/);
    expect(cleaned).not.toMatch(/Yes, you are correct/i);
    expect(cleaned).not.toMatch(/Simple Example:[\s\S]*1\.\s*$/i);
  });

  it('does not put raw table text into a failed mastery outcome', async () => {
    const outcome = await buildMasteryOutcome(prefixSection, 65, false, [
      'Symbol Prefix Multiplier Symbol Prefix Multiplier c m μ n Deci centi milli micro nano 10 -1 10 -2 10 -3 10 -6 10 -9',
    ]);

    expect(outcome).toContain(
      'using metric-prefix multipliers correctly in unit conversions',
    );
    expect(outcome).not.toMatch(/Symbol Prefix Multiplier|c m μ n|10 -1 10 -2/i);
    expect(outcome).not.toMatch(/gap is in the process, not in you/i);
  });
});
