# Archetype Extraction Experiment v6 — MTH 102

Captured 2026-07-26T23:56:58.866Z. Standalone experiment, not wired into any job/queue. No database writes (vocabulary cache and this report are the only file artifacts besides the reused v3/v4/v5 caches).

## Methodology

- **v5 -> v6 change:** v5's vocabulary SPLITS are kept exactly as-is (same 84 entries/aliases). Its Step 2 classification is discarded entirely — that AI-judged empirical reclassification flipped 8 well-established techniques (apply power rule, apply chain rule, apply product rule, apply u-substitution, apply trigonometric identity, apply fundamental theorem of calculus, apply absolute value definition, apply quadratic formula) to GENERIC because it read superficial problem-statement variety as solution-form variety.
- Step 1 reclassifies by fixed rule, zero model calls: an entry untouched by v5's split keeps its v4 classification verbatim (Rule 1); a new entry naming a specific technique is DISCRIMINATING (Rule 2); a new entry that is a residual/leftover bucket from a split is GENERIC (Rule 3). Per-entry judgment is a hardcoded lookup in the script, reviewed by hand against each entry's full alias list.
- Steps 2-3 (rebuilding archetypes) are unchanged in mechanism from v4/v5 — deterministic exact-signature grouping — except an empty discriminating-only signature is no longer excluded: it becomes its own real archetype, `DIRECT_EVALUATION`, applied identically to the cached examples (Step 3) and the hold-out questions (Step 4).
- Step 4 hold-out read "MTH 102 TUTORIAL 2026" fresh, extracted its questions (1 call), then labeled each in batches of at most 5, hard-constrained to vocabulary-v3 or "UNMAPPED". Closed-vocabulary violations coerced in code: 0.
- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.
- Model usage per phase:
  - step4-extract-questions: gemini-3.1-flash-lite x1
  - step4-label-holdout: gemini-3.1-flash-lite x8

## Step 1 — deterministic reclassification

**84 entries** (unchanged from v5's split), **42 DISCRIMINATING, 42 GENERIC**.

### Entries whose class differs from v5 (21)

- `apply chain rule`: v5=GENERIC -> v6=DISCRIMINATING
- `apply u-substitution`: v5=GENERIC -> v6=DISCRIMINATING
- `apply power rule`: v5=GENERIC -> v6=DISCRIMINATING
- `apply product rule`: v5=GENERIC -> v6=DISCRIMINATING
- `apply trigonometric identity`: v5=GENERIC -> v6=DISCRIMINATING
- `apply fundamental theorem of calculus`: v5=GENERIC -> v6=DISCRIMINATING
- `apply absolute value definition`: v5=GENERIC -> v6=DISCRIMINATING
- `apply quadratic formula`: v5=GENERIC -> v6=DISCRIMINATING
- `identify asymptotes`: v5=DISCRIMINATING -> v6=GENERIC
- `evaluate trigonometric functions`: v5=DISCRIMINATING -> v6=GENERIC
- `analyze function range`: v5=GENERIC -> v6=DISCRIMINATING
- `analyze growth behavior`: v5=GENERIC -> v6=DISCRIMINATING
- `calculate ratio`: v5=DISCRIMINATING -> v6=GENERIC
- `evaluate numerator`: v5=DISCRIMINATING -> v6=GENERIC
- `express as interval`: v5=DISCRIMINATING -> v6=GENERIC
- `extract roots`: v5=DISCRIMINATING -> v6=GENERIC
- `interpret definition`: v5=DISCRIMINATING -> v6=GENERIC
- `differentiate quotient component`: v5=DISCRIMINATING -> v6=GENERIC
- `algebraic manipulation of derivatives`: v5=DISCRIMINATING -> v6=GENERIC
- `construct linear equations`: v5=GENERIC -> v6=DISCRIMINATING
- `rewrite integrand`: v5=DISCRIMINATING -> v6=GENERIC

## Step 2-3 — rebuilt archetypes

**87 archetypes**, 54 singletons. `DIRECT_EVALUATION` covers **132** of 356 examples (across 120 v3 archetypes).

### Top 15 archetypes by member count

- **[memberCount=132]** `DIRECT_EVALUATION`
  - canonicalStem: _(represents many different trivial problems, no single representative)_
- **[memberCount=40]** `apply power rule`
  - canonicalStem: Find d dx (x−2).
- **[memberCount=19]** `cancel common factors`
  - canonicalStem: Find lim x→0 √1 + x − 1 x .
- **[memberCount=12]** `apply chain rule`
  - canonicalStem: Find y′ for y = ex2 .
- **[memberCount=12]** `apply power rule -> apply power rule`
  - canonicalStem: Example 4.11. Find R √x + 1 √x dx.
- **[memberCount=7]** `apply trigonometric identity`
  - canonicalStem: Example 4.27. Find R sin2 x dx.
- **[memberCount=5]** `apply fundamental theorem of calculus`
  - canonicalStem: 4.5. Find R cos x dx.
- **[memberCount=4]** `apply absolute value definition`
  - canonicalStem: olve the inequality |2x + 1| < 7.
- **[memberCount=4]** `swap variables`
  - canonicalStem: Example 1.91. Find the inverse of f (x) = 2x + 3.
- **[memberCount=4]** `apply L'Hôpital's rule`
  - canonicalStem: Find limx→∞ ln x x .
- **[memberCount=4]** `define interval and endpoint parameters`
  - canonicalStem: Example 1.37. Graph f (x) = ⌊x⌋ for −3 ≤ x ≤ 3.
- **[memberCount=4]** `apply ceiling definition`
  - canonicalStem: Example 1.40. Solve the equation ⌈x⌉ = 3.
- **[memberCount=4]** `apply quadratic formula`
  - canonicalStem: Example 3.71. A  rm has R(q) = 80q and C(q) = 2000 + 30q + 0.05q2. Find the
break-even points and the pro t-maximizing quantity.
- **[memberCount=4]** `apply intermediate value theorem`
  - canonicalStem: Show that f (x) = cos x − x has a root in (0, 1).
- **[memberCount=4]** `apply implicit differentiation`
  - canonicalStem: Example 3.43. Find dy
dx for x2 + y2 = 25.

## Step 4 — hold-out test (MTH 102 TUTORIAL 2026)

36 questions extracted.

**coverageScore = 29 / 36 = 0.806**

Of the 29 fits, **7** matched `DIRECT_EVALUATION`.

Total UNMAPPED step labels: 0.

Differentiation-related questions (12 identified) produced **9 distinct signature(s)**.

### Full per-question results

- Q0 (FIT, 0 UNMAPPED): "1. (a) Evaluate lim x→4 (2x^2 − 11x + 12) / (x − 4)"
  - signature: `cancel common factors`
- Q1 (FIT, 0 UNMAPPED): "(b) Evaluate lim x→0 (√x + 4 − 2) / x"
  - signature: `cancel common factors`
- Q2 (FIT, 0 UNMAPPED): "2. Evaluate the following using limits law (a) lim x→2 (5x^3 − 3x^2 + 5x − 4)"
  - signature: `DIRECT_EVALUATION`
- Q3 (FIT, 0 UNMAPPED): "(b) lim x→−1 (6x^4 + 9x^2 − 5x − 3) / (7x^2 + 4x)"
  - signature: `DIRECT_EVALUATION`
- Q4 (FIT, 0 UNMAPPED): "3. Evaluate the following (a) lim x→3 (2x^5 − 7x^3 + 5x − 6) / (7x^2 − 4x − 5)"
  - signature: `DIRECT_EVALUATION`
- Q5 (FIT, 0 UNMAPPED): "(b) lim θ→ π/6 (sin θ − cos 2θ) / (2 cos θ + sin 2θ)"
  - signature: `DIRECT_EVALUATION`
- Q6 (FIT, 0 UNMAPPED): "4. Evaluate lim x→0 (sin 7x) / (sin 3x)"
  - signature: `evaluate standard limit`
- Q7 (FIT, 0 UNMAPPED): "5. Evaluate lim x→3 (2x^2 − 5x − 3) / (x − 3)"
  - signature: `cancel common factors`
- Q8 (NO FIT, 0 UNMAPPED): "6. Given that f (x) = { 8 − 2x if x > 4, √4 − x if x ≤ 4. Show whether the lim x→4 f (x) exists"
  - signature: `evaluate one-sided limits -> evaluate one-sided limits`
- Q9 (NO FIT, 0 UNMAPPED): "Exercise 1 1. Show whether lim x→0 (9|x| − 5x) / x exists."
  - signature: `apply absolute value definition -> evaluate one-sided limits -> evaluate one-sided limits`
- Q10 (FIT, 0 UNMAPPED): "2. Evaluate lim x→0 (√x + 81 − 9) / 6x"
  - signature: `DIRECT_EVALUATION`
- Q11 (FIT, 0 UNMAPPED): "3. Evaluate lim x→−3 (6x^4 − x^3 + 4x^2 − 18) / (5x^2 + 3x + 9)"
  - signature: `DIRECT_EVALUATION`
- Q12 (FIT, 0 UNMAPPED): "4. Evaluate without calculator or Mathematical table lim x→ 3π/4 (sin x − 2 cos 1/3 x) / (2 cos x + sin 1/3 x)"
  - signature: `DIRECT_EVALUATION`
- Q13 (FIT, 0 UNMAPPED): "Example: Evaluate lim x→∞ (x^3 − x)"
  - signature: `analyze growth behavior`
- Q14 (FIT, 0 UNMAPPED): "Examples: Evaluate the following 1. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (2x^4 − 7x^3 − 2x + 6)"
  - signature: `analyze growth behavior`
- Q15 (FIT, 0 UNMAPPED): "2. lim x→∞ (5x^2 + 2x + 9) / (3x^2 − 2x + 8)"
  - signature: `evaluate standard limit`
- Q16 (NO FIT, 0 UNMAPPED): "3. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (3x^2 + 4x + 1)"
  - signature: `evaluate standard limit -> analyze growth behavior`
- Q17 (FIT, 0 UNMAPPED): "Example: Evaluate lim x→∞ (√4x^4 + 6x^3 − 7x + 8) / (2x^2 + 7x + 5)"
  - signature: `evaluate standard limit`
- Q18 (FIT, 0 UNMAPPED): "1. Find dy/dx if (a) y = x^2"
  - signature: `apply power rule`
- Q19 (FIT, 0 UNMAPPED): "(b) y = 3x^3 + 5"
  - signature: `apply power rule -> differentiate polynomial`
- Q20 (FIT, 0 UNMAPPED): "(c) y = √2x − 7"
  - signature: `apply chain rule -> apply power rule`
- Q21 (FIT, 0 UNMAPPED): "(d) y = sin 2x"
  - signature: `apply chain rule`
- Q22 (NO FIT, 0 UNMAPPED): "Exercise 2 1. Prove that if y = x^n, then dy/dx = nx^(n−1)"
  - signature: `apply limit definition -> cancel common factors`
- Q23 (FIT, 0 UNMAPPED): "2. Find dy/dx if y = √5x + 8"
  - signature: `apply chain rule -> apply power rule`
- Q24 (FIT, 0 UNMAPPED): "3. Find dy/dx given that y = cos 1/3x"
  - signature: `apply chain rule`
- Q25 (FIT, 0 UNMAPPED): "Example: If y = x^5, then dy/dx = 5x^4"
  - signature: `apply power rule`
- Q26 (FIT, 0 UNMAPPED): "Example: If y = 8x^6, then dy/dx = d/dx(8x^6) = 8 d/dx(x^6) = 8(6x^5) = 48x^5"
  - signature: `apply power rule`
- Q27 (NO FIT, 0 UNMAPPED): "Example: If y = x^4 + 5x^3 − 3x^2 + 7x − 9, find dy/dx."
  - signature: `differentiate polynomial`
- Q28 (FIT, 0 UNMAPPED): "Example: If y = x^3 sin x, find dy/dx."
  - signature: `apply product rule`
- Q29 (FIT, 0 UNMAPPED): "Example: If y = (2x^3 − 5) / (x^2 + 6)"
  - signature: `apply quotient rule`
- Q30 (FIT, 0 UNMAPPED): "Example: Find dy/dx if (a) y = sin (4x^2 + 5)"
  - signature: `apply chain rule`
- Q31 (FIT, 0 UNMAPPED): "(b) y = sin^2 x"
  - signature: `apply chain rule -> apply power rule`
- Q32 (FIT, 0 UNMAPPED): "(c) y = e^(6x^4)"
  - signature: `apply chain rule`
- Q33 (FIT, 0 UNMAPPED): "Exercise 2 1. Find dy/dx if y = e^(3x^5) cos(7x^2 − 4x)"
  - signature: `apply product rule -> apply chain rule`
- Q34 (NO FIT, 0 UNMAPPED): "2. Find dy/dx if y = (5x^6 − 2x^3 + 4) / (15x^5 − 6)"
  - signature: `apply quotient rule -> differentiate polynomial`
- Q35 (NO FIT, 0 UNMAPPED): "3. Find dy/dx if y = (4x^3 − 5)^16"
  - signature: `apply chain rule -> apply power rule -> differentiate polynomial`
