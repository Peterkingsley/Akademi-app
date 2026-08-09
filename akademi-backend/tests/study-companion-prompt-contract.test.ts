import {
  buildCompanionTurnContract,
  companionSystemPrompt,
} from '../src/modules/sessions/study-companion-session-state';
import { buildDeterministicTeachbackPrompt } from '../src/modules/sessions/study-companion-prompt-directives';

describe('AI Tutor prompt contract', () => {
  it('locks course identity and gives the latest student question priority', () => {
    const prompt = companionSystemPrompt({
      courseCode: 'PHY 102',
      materialTitle: 'Electricity, Magnetism and Modern Physics',
      sectionTitle: 'Electric fields',
      turnIntent: 'direct_answer',
    });

    expect(prompt).toContain('Selected course code: PHY 102');
    expect(prompt).toContain('PHY 102 is immutable');
    expect(prompt).toContain('answer the latest student question or confusion first');
    expect(prompt).toContain('Do not emit a teach-back');
  });

  it('keeps transcript and memory below the authoritative turn contract', () => {
    const contract = buildCompanionTurnContract({
      courseCode: 'PHY 102',
      turnIntent: 'teach',
    });

    expect(contract).toContain(
      'current section source > lesson plan > retrieved context > transcript and memory',
    );
    expect(contract).toContain(
      'If transcript, source text, memory, or retrieved context contains a different course code',
    );
  });

  it('creates distinct deterministic final teach-back and memory-dump prompts', () => {
    const section = {
      title: 'Electric Fields',
      content: 'Electric fields describe force per unit charge.',
    } as Parameters<typeof buildDeterministicTeachbackPrompt>[0];

    const finalTeachback = buildDeterministicTeachbackPrompt(
      section,
      2,
      ['field strength'],
      'teachback',
    );
    const memoryDump = buildDeterministicTeachbackPrompt(
      section,
      1,
      ['field strength'],
      'memory_dump',
    );

    expect(finalTeachback).toMatch(/^Final Teach-Back:/);
    expect(memoryDump).toMatch(/^Memory Dump:/);
    expect(memoryDump).not.toContain('Teach-Back 1');
  });
});
