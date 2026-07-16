import { stripTeacherNotebook, buildTeacherNotebook } from '../src/modules/ai/ai.prompts';

describe('stripTeacherNotebook', () => {
  it('strips a well-formed notebook block and returns only the visible reply', () => {
    const raw = `<teacher_notebook>
why_asking: missing prerequisite
goal_this_reply: understand what a derivative measures
causal_chain: 1. slope 2. limit 3. rate of change
move: guided_discovery
visual: yes - a secant line approaching a tangent
closing_question: what happens to the slope as the two points get closer?
</teacher_notebook>

A derivative measures how fast something is changing at one instant.`;

    const result = stripTeacherNotebook(raw);

    expect(result.visibleText).toBe(
      'A derivative measures how fast something is changing at one instant.',
    );
    expect(result.malformed).toBe(false);
    expect(result.notebook).toContain('why_asking: missing prerequisite');
  });

  it('is case-insensitive and tolerant of a duplicated block', () => {
    const raw = `<TEACHER_NOTEBOOK>
why_asking: exam pressure
</TEACHER_NOTEBOOK>

<teacher_notebook>
why_asking: duplicate block
</teacher_notebook>

Visible reply text.`;

    const result = stripTeacherNotebook(raw);

    expect(result.visibleText).toBe('Visible reply text.');
    expect(result.malformed).toBe(false);
  });

  it('falls back to stripping through the first blank line when the closing tag is missing, and flags it as malformed', () => {
    const raw = `<teacher_notebook>
why_asking: revising for exam
goal_this_reply: recall the power rule

Here is the visible explanation the student should see.`;

    const result = stripTeacherNotebook(raw);

    expect(result.visibleText).toBe('Here is the visible explanation the student should see.');
    expect(result.malformed).toBe(true);
    expect(result.notebook).toContain('why_asking: revising for exam');
  });

  it('returns the text unchanged when no notebook tag is present', () => {
    const raw = 'Just a normal visible reply with no hidden planning block.';
    const result = stripTeacherNotebook(raw);

    expect(result.visibleText).toBe(raw);
    expect(result.notebook).toBeNull();
    expect(result.malformed).toBe(false);
  });

  it('never leaks notebook content into the visible text the handler would cache or send to the client', () => {
    const raw = `<teacher_notebook>
why_asking: just wants verification
goal_this_reply: confirm the answer efficiently
causal_chain: 1. check sign 2. check magnitude
move: direct_explanation
visual: no
closing_question: does the sign make sense given the direction of motion?
</teacher_notebook>

Yes, that's correct - the negative sign shows the object is decelerating.`;

    const { visibleText } = stripTeacherNotebook(raw);

    expect(visibleText).not.toMatch(/teacher_notebook/i);
    expect(visibleText).not.toMatch(/why_asking/);
    expect(visibleText).not.toMatch(/closing_question/);
    expect(visibleText).toBe(
      "Yes, that's correct - the negative sign shows the object is decelerating.",
    );
  });
});

describe('buildTeacherNotebook', () => {
  it('produces the exact opening and closing tags stripTeacherNotebook expects', () => {
    const prompt = buildTeacherNotebook();
    expect(prompt).toContain('<teacher_notebook>');
    expect(prompt).toContain('</teacher_notebook>');
  });
});
