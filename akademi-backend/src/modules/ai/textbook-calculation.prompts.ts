// Quantitative/calculation rigor rules for Akademi Generated Textbooks.
//
// Split out from textbook-writing.prompts.ts (which holds the general pedagogy
// contract) so the two concerns can be owned and edited independently — general
// teaching style/structure vs. maths-and-numeric-working rigor are genuinely
// different domains, and different people are likely to be the ones improving each.
//
// Like textbook-writing.prompts.ts, this is deliberately standalone from
// ai.prompts.ts (the AI Tutor's prompt library) rather than importing the tutor's
// calculation rules. See textbook-writing.prompts.ts's header for the full reasoning
// on why textbook generation does not share prompt content with the tutor.

export function buildTextbookCalculationRules(): string {
  return `Calculation Teaching Mode (this section involves an actual calculation, computation, or worked procedure — maths, statistics, physics, economics, accounting, or any other numeric/quantitative reasoning):
- Assume the student has never seen this topic or this type of question before, no matter how advanced the course actually is. Treat a 400-level or postgraduate calculation exactly like you would explain it to someone meeting the idea for the very first time. Do not assume familiarity with notation, jargon, or "obvious" shortcuts.
- Never present a bare line of maths/working on its own. Every step needs a text explanation stating what we are doing right now and why we are doing it, in everyday language, before or alongside the calculation itself.
- Explain every single line of working in full, plain-English text. Do not show a formula, substitution, or computed line without explaining, in text right before or beside it, what we are about to do and why we are doing it. A textbook section always uses this fullest level of explanation — there is no shorter mode to fall back to.
- Do not skip steps to save space, even ones that feel trivial to an expert (e.g. "cross multiply here", "find the LCM first", "convert this to a decimal"). State each move and the reason for it.
- Simplify vocabulary aggressively. Prefer short sentences and everyday words over academic phrasing. If a technical term is unavoidable, explain it in one plain clause the first time it appears.
- Where it genuinely helps make an abstract step click, you may anchor an explanation in something Nigerian students would recognize right now — a trending TikTok/Instagram moment, a popular saying, Naija pidgin phrasing, jollof rice, JAMB/WAEC prep culture, okada fare-splitting, POS/transfer charges, and similar everyday or trending references. Use this only when it fits naturally and stays brief — never force it, and never let it replace the actual maths explanation.
- Never present a tested value, substitution, or example input as if it appeared from nowhere. Whenever you pick a specific number to test or plug in, first show in one short line how a student would find or choose it themselves. The reader must see the hunt for the number, not just receive the number.
- Any secondary tool or formula used mid-solution that is not the main technique being taught (e.g. the discriminant, LCM, log laws, completing the square) must be explained in one plain sentence at the exact moment it first appears. If a simpler route exists that a beginner could verify by eye without recalling a named formula, prefer that simpler route — but if the standard/named route is also commonly used in exams for this topic, show that one too as an alternative, since this is a textbook section a student may return to before an exam that expects the named method.
- This mode applies only to the calculation itself. If part of the same section is theoretical or conceptual (no computation involved), explain that part normally without forcing the calculation-teaching style onto it.
- Where the topic has more than one standard worked case (e.g. a formula with different behavior depending on a condition, or a method with a common special case), work through each case as its own full worked example — do not show only one case and describe the others in prose. A textbook section has room for every case; a chat reply doesn't, and this rule exists specifically because this isn't a chat reply.`;
}

export function buildTextbookSolveOperationGuidance(): string {
  return `Worked Example Structure — use this for every step of every calculation:
- Step title
- What we are doing, in plain English
- Actual substitution of values, symbols, or formula parts
- Result of that step
- Why this step

Worked Example Operation Library:
- substitute_into_formula
  Why: We substitute the known values so the formula stops being abstract and becomes the exact problem in front of us.
  When: Use this when a formula is already known and the task is to plug the given numbers or variables into it.
- simplify_expression
  Why: We simplify to make the expression easier to read and easier to finish correctly.
  When: Use this after substitution or expansion leaves the work looking cluttered.
- collect_like_terms
  Why: We combine like terms so similar quantities are grouped and the equation becomes easier to solve.
  When: Use this when the same variable or type of term appears in more than one place.
- factor_quadratic
  Why: We factor to rewrite the expression into simpler pieces that reveal the roots or structure.
  When: Use this when a polynomial needs solving, simplifying, or comparison to zero.
- cross_multiply
  Why: We cross multiply to clear the fractions and turn the relationship into a simpler equation.
  When: Use this when two ratios or two fractions are set equal to each other.
- differentiate_power_rule
  Why: We differentiate to measure how the quantity changes, and the power rule makes that fast for polynomial terms.
  When: Use this when the problem asks for a derivative, gradient, marginal change, or rate of change.
- integrate_basic_polynomial
  Why: We integrate to recover the accumulated quantity or original function from its rate of change.
  When: Use this when the problem asks for area, accumulation, or an antiderivative of polynomial terms.
- convert_units
  Why: We convert units so every quantity speaks the same measurement language before we calculate.
  When: Use this when the values are given in different units or the required answer unit is different from the input.
- apply_probability_formula
  Why: We use the probability relationship to organize outcomes into a form we can calculate clearly.
  When: Use this when the question asks for chance, expected value, combinations of events, or conditional outcomes.
- rearrange_equation
  Why: We rearrange to isolate the quantity we are trying to find.
  When: Use this when the target variable is buried inside a larger equation.
  How: Never jump straight from the starting equation to the rearranged result. When you move a
  term across the equals sign or apply an operation to cancel a term (subtracting, adding,
  multiplying, or dividing), first show that exact operation applied identically to both sides as
  its own line, then show the simplified result as the next line. For example, to clear the "11"
  from \\(4x^2 + 3x = 11\\), show \\(4x^2 + 3x - 11 = 11 - 11\\) first, then \\(4x^2 + 3x - 11 = 0\\) on
  the line after it — do not skip straight to the second line.
- check_final_answer
  Why: We verify the result so we catch sign errors, unreasonable magnitudes, or mismatch with the question.
  When: Use this after obtaining a final answer, especially in maths, physics, economics, chemistry, or statistics.

Library usage rules:
- Prefer these explanation patterns whenever the current step matches one of them.
- You may adjust the wording slightly to fit the exact question, but keep the explanation clear and student-friendly.
- If a step does not match any library item well, generate a fresh "why this step" line.
- Always use the fuller level of explanation from this library — a textbook section has room for both the plain-English reason and the "when this applies" idea on every step; there is no shorter mode to switch to.
- Whenever you balance an equation (moving a term across the equals sign, or applying the same operation to both sides to cancel something out), always show the "apply the operation to both sides" line before the simplified result line. Never present only the simplified result — the student needs to see the operation actually happening on both sides, not just its outcome.`;
}
