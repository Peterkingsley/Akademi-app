# Archetype Extraction Experiment v5 — MTH 102

Captured 2026-07-26T23:41:07.118Z. Standalone experiment, not wired into any job/queue. No database writes (vocabulary cache and this report are the only file artifacts besides the reused v3/v4 caches).

## Methodology

- **v4 -> v5 change:** matching logic is UNCHANGED (exact ordered discriminating-only signature, same as v3/v4). Only the vocabulary changes: Step 1 splits v4's 6 catch-all GENERIC entries (`evaluate limit`, `evaluate integral`, `calculate derivative`, `assign variables`, `simplify expression`, `miscellaneous operations`) into real named techniques; `miscellaneous operations` is deleted outright, every one of its aliases reassigned to a genuinely-fitting entry. Step 2 reclassifies EVERY entry (touched or not) as DISCRIMINATING/GENERIC using empirical evidence — real example problems where the operation appears — rather than how the label sounds, fixing v4's tendency to call bookkeeping-sounding-but-actually-diagnostic operations (like direct substitution) GENERIC by default.
- Step 0 (implicit) reused the same cached v3 archetype data as v4 — no re-extraction, no re-labeling of the 356 examples.
- Step 1 split summary: `evaluate limit` -> 6 sub-operations; `evaluate integral` -> 9 sub-operations; `calculate derivative` -> 5 sub-operations; `assign variables` -> 8 sub-operations; `simplify expression` -> 12 sub-operations.
- Step 2 reclassification used up to 5 real example problems per entry (drawn from the cached v3 archetype data) as evidence, batched in groups of 6, temperature=0.2.
- Step 4 hold-out read "MTH 102 TUTORIAL 2026" fresh, extracted its questions (1 call), then labeled each in batches of at most 5, hard-constrained to the new frozen vocabulary or "UNMAPPED". Closed-vocabulary violations coerced in code: 0.
- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.
- Model usage per phase:
  - step1-split[evaluate limit]: gemini-3.1-flash-lite x1
  - step1-split[evaluate integral]: gemini-3.1-flash-lite x1
  - step1-split[calculate derivative]: gemini-3.1-flash-lite x1
  - step1-split[assign variables]: gemini-3.1-flash-lite x1
  - step1-split[simplify expression]: gemini-3.1-flash-lite x1
  - step1-reassign-misc: gemini-3.1-flash-lite x1
  - step2-reclassify: gemini-3.1-flash-lite x14
  - step4-extract-questions: gemini-3.1-flash-lite x1
  - step4-label-holdout: gemini-3.1-flash-lite x8

## Step 1-2 — vocabulary

**84 entries** (41 DISCRIMINATING, 43 GENERIC). 0 raw label(s) needed post-hoc recovery.

### DISCRIMINATING entries

- `apply L'Hôpital's rule` (1 alias)
- `apply integration by parts` (3 aliases)
- `apply quotient rule` (1 alias)
- `apply implicit differentiation` (1 alias)
- `apply signum definition` (2 aliases)
- `apply floor definition` (3 aliases)
- `apply ceiling definition` (5 aliases)
- `apply squeeze theorem` (1 alias)
- `apply intermediate value theorem` (1 alias)
- `complete the square` (1 alias)
- `perform polynomial division` (1 alias)
- `compute cartesian product` (2 aliases)
- `apply injective/surjective definition` (6 aliases)
- `identify asymptotes` (4 aliases)
- `evaluate trigonometric functions` (10 aliases)
- `analyze denominator sign` (1 alias)
- `apply power rule for integration` (2 aliases)
- `calculate ratio` (1 alias)
- `evaluate numerator` (1 alias)
- `express as interval` (2 aliases)
- `extract roots` (2 aliases)
- `interpret definition` (5 aliases)
- `apply limit definition` (1 alias)
- `evaluate one-sided limits` (3 aliases)
- `evaluate standard limit` (1 alias)
- `integrate trigonometric function` (2 aliases)
- `integrate exponential function` (1 alias)
- `integrate reciprocal function` (1 alias)
- `set up sum of integrals` (1 alias)
- `split integral` (1 alias)
- `split integral at discontinuity` (1 alias)
- `calculate higher-order derivative` (1 alias)
- `differentiate polynomial` (1 alias)
- `differentiate quotient component` (2 aliases)
- `algebraic manipulation of derivatives` (1 alias)
- `define substitution and shell variables` (2 aliases)
- `define interval and endpoint parameters` (4 aliases)
- `swap variables` (1 alias)
- `cancel common factors` (2 aliases)
- `rewrite trigonometric expression` (4 aliases)
- `rewrite integrand` (3 aliases)

### GENERIC entries

- `apply chain rule` (2 aliases)
- `apply u-substitution` (6 aliases)
- `apply power rule` (2 aliases)
- `apply product rule` (1 alias)
- `apply trigonometric identity` (5 aliases)
- `apply fundamental theorem of calculus` (1 alias)
- `apply absolute value definition` (4 aliases)
- `apply quadratic formula` (1 alias)
- `arithmetic evaluation` (47 aliases)
- `substitute value` (38 aliases)
- `solve equation` (39 aliases)
- `define domain and range` (13 aliases)
- `evaluate logarithm` (11 aliases)
- `evaluate exponential` (10 aliases)
- `analyze inequality` (8 aliases)
- `set conditions` (10 aliases)
- `identify features` (29 aliases)
- `analyze function range` (5 aliases)
- `analyze growth behavior` (4 aliases)
- `compare values` (10 aliases)
- `evaluate denominator` (1 alias)
- `identify components` (1 alias)
- `apply limit laws` (3 aliases)
- `evaluate limit of components` (3 aliases)
- `general limit evaluation` (4 aliases)
- `apply fundamental integration formula` (7 aliases)
- `evaluate definite integral` (1 alias)
- `set up integral` (1 alias)
- `calculate first derivative` (6 aliases)
- `assign variables` (1 alias)
- `define functions` (5 aliases)
- `define specific mathematical functions` (7 aliases)
- `define sets and subsets` (4 aliases)
- `construct linear equations` (2 aliases)
- `combine like terms` (2 aliases)
- `distribute terms` (9 aliases)
- `expand polynomial` (4 aliases)
- `factor expression` (13 aliases)
- `rewrite using exponent rules` (11 aliases)
- `rewrite using radical rules` (6 aliases)
- `simplify fraction` (5 aliases)
- `simplify arithmetic and coefficients` (10 aliases)
- `general algebraic manipulation` (7 aliases)

## Step 3 — rebuilt archetypes

**67 archetypes**, 37 singletons. 207 of 356 examples still have an empty discriminating-only signature (down from 178 in v4) — across 188 v3 archetypes.

### Top 15 archetypes by member count

- **[memberCount=207]** `(empty)`
  - canonicalStem: Find d dx (x−2).
- **[memberCount=22]** `cancel common factors`
  - canonicalStem: Find lim x→0 √1 + x − 1 x .
- **[memberCount=9]** `evaluate trigonometric functions`
  - canonicalStem: Example 4.37. Find R √1 − x2 dx.
- **[memberCount=7]** `rewrite integrand`
  - canonicalStem: Example 4.27. Find R sin2 x dx.
- **[memberCount=5]** `apply quotient rule`
  - canonicalStem: Find y′ for y = x2 ex .
- **[memberCount=4]** `apply ceiling definition`
  - canonicalStem: Example 1.40. Solve the equation ⌈x⌉ = 3.
- **[memberCount=4]** `identify asymptotes`
  - canonicalStem: Example 1.56. Find the vertical asymptotes of f (x) = x x2−4 .
- **[memberCount=4]** `rewrite trigonometric expression`
  - canonicalStem: Find y′ for y = ln(sin x).
- **[memberCount=4]** `interpret definition -> define interval and endpoint parameters`
  - canonicalStem: Example 2.4. Prove that limx→3 x2 = 9 using the epsilon-delta de nition.
- **[memberCount=4]** `apply intermediate value theorem`
  - canonicalStem: Show that f (x) = cos x − x has a root in (0, 1).
- **[memberCount=3]** `express as interval`
  - canonicalStem: olve the inequality |2x + 1| < 7.
- **[memberCount=3]** `interpret definition -> interpret definition`
  - canonicalStem: Example 2.14. For f (x) =
(
3, x ≤ 2
x + 1, x > 2 ,  nd limx→2 f (x).
- **[memberCount=3]** `apply L'Hôpital's rule`
  - canonicalStem: Find limx→∞ ln x x .
- **[memberCount=3]** `compute cartesian product`
  - canonicalStem: Example 4: Let \(A = \{a, b\}\), \(B = \{c, d\}\). Find some relations from A to B.
- **[memberCount=3]** `evaluate trigonometric functions -> evaluate trigonometric functions`
  - canonicalStem: Example 1.115. Given V (t) = 100 sin(200πt),  nd: (a) The peak voltage. (b) The
frequency f . (c) The period. (d) The voltage at t = 0.0025 seconds.

## Step 4 — hold-out test (MTH 102 TUTORIAL 2026)

36 questions extracted.

**coverageScore = 13 / 36 = 0.361**

Total UNMAPPED step labels: 0.

Differentiation-related questions (17 identified) produced **14 distinct signature(s)** (matching logic unchanged from v4 — exact ordered match only).

### Full per-question results

- Q0 (FIT, 0 UNMAPPED): "1. (a) Evaluate lim x→4 (2x^2 − 11x + 12) / (x − 4)"
  - signature: `cancel common factors`
- Q1 (FIT, 0 UNMAPPED): "1. (b) Evaluate lim x→0 (√x + 4 − 2) / x"
  - signature: `cancel common factors`
- Q2 (NO FIT, 0 UNMAPPED): "2. Evaluate the following using limits law (a) lim x→2 (5x^3 − 3x^2 + 5x − 4)"
  - signature: `(empty)`
- Q3 (NO FIT, 0 UNMAPPED): "2. (b) Evaluate the following using limits law: lim x→−1 (6x^4 + 9x^2 − 5x − 3) / (7x^2 + 4x)"
  - signature: `(empty)`
- Q4 (NO FIT, 0 UNMAPPED): "3. Evaluate the following (a) lim x→3 (2x^5 − 7x^3 + 5x − 6) / (7x^2 − 4x − 5)"
  - signature: `(empty)`
- Q5 (FIT, 0 UNMAPPED): "3. (b) Evaluate the following: lim θ→π/6 (sin θ − cos 2θ) / (2 cos θ + sin 2θ)"
  - signature: `evaluate trigonometric functions`
- Q6 (NO FIT, 0 UNMAPPED): "4. Evaluate lim x→0 (sin 7x) / (sin 3x)"
  - signature: `evaluate standard limit -> calculate ratio`
- Q7 (FIT, 0 UNMAPPED): "5. Evaluate lim x→3 (2x^2 − 5x − 3) / (x − 3)"
  - signature: `cancel common factors`
- Q8 (FIT, 0 UNMAPPED): "6. Given that f(x) = { 8 − 2x if x > 4; √4 − x if x ≤ 4 }. Show whether the lim x→4 f(x) exists"
  - signature: `evaluate one-sided limits -> evaluate one-sided limits`
- Q9 (FIT, 0 UNMAPPED): "Exercise 1: 1. Show whether lim x→0 (9|x| − 5x) / x exists."
  - signature: `evaluate one-sided limits -> evaluate one-sided limits`
- Q10 (NO FIT, 0 UNMAPPED): "Exercise 1: 2. Evaluate lim x→0 (√x + 81 − 9) / 6x"
  - signature: `(empty)`
- Q11 (NO FIT, 0 UNMAPPED): "Exercise 1: 3. Evaluate lim x→−3 (6x^4 − x^3 + 4x^2 − 18) / (5x^2 + 3x + 9)"
  - signature: `evaluate numerator -> calculate ratio`
- Q12 (NO FIT, 0 UNMAPPED): "Exercise 1: 4. Evaluate without calculator or Mathematical table lim x→3π/4 (sin x − 2 cos 1/3 x) / (2 cos x + sin 1/3 x"
  - signature: `evaluate trigonometric functions -> evaluate numerator -> calculate ratio`
- Q13 (NO FIT, 0 UNMAPPED): "Example: Evaluate lim x→∞ (x^3 − x)"
  - signature: `(empty)`
- Q14 (FIT, 0 UNMAPPED): "Examples: Evaluate the following 1. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (2x^4 − 7x^3 − 2x + 6)"
  - signature: `calculate ratio`
- Q15 (NO FIT, 0 UNMAPPED): "Examples: Evaluate the following 2. lim x→∞ (5x^2 + 2x + 9) / (3x^2 − 2x + 8)"
  - signature: `(empty)`
- Q16 (NO FIT, 0 UNMAPPED): "Examples: Evaluate the following 3. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (3x^2 + 4x + 1)"
  - signature: `(empty)`
- Q17 (NO FIT, 0 UNMAPPED): "Example: Evaluate lim x→∞ (√(4x^4 + 6x^3 − 7x + 8)) / (2x^2 + 7x + 5)"
  - signature: `(empty)`
- Q18 (NO FIT, 0 UNMAPPED): "1. Find dy/dx if (a) y = x^2"
  - signature: `(empty)`
- Q19 (FIT, 0 UNMAPPED): "1. Find dy/dx if (b) y = 3x^3 + 5"
  - signature: `differentiate polynomial`
- Q20 (NO FIT, 0 UNMAPPED): "1. Find dy/dx if (c) y = √(2x − 7)"
  - signature: `(empty)`
- Q21 (FIT, 0 UNMAPPED): "1. Find dy/dx if (d) y = sin 2x"
  - signature: `evaluate trigonometric functions`
- Q22 (NO FIT, 0 UNMAPPED): "Exercise 2: 1. Prove that if y = x^n, then dy/dx = nx^n−1"
  - signature: `apply limit definition -> algebraic manipulation of derivatives -> evaluate standard limit`
- Q23 (NO FIT, 0 UNMAPPED): "Exercise 2: 2. Find dy/dx if y = √(5x + 8)"
  - signature: `(empty)`
- Q24 (FIT, 0 UNMAPPED): "Exercise 2: 3. Find dy/dx given that y = cos 1/3 x"
  - signature: `evaluate trigonometric functions`
- Q25 (NO FIT, 0 UNMAPPED): "Example: If y = x^5, then dy/dx = 5x^4"
  - signature: `(empty)`
- Q26 (NO FIT, 0 UNMAPPED): "Example: If y = 8x^6, then dy/dx = d/dx(8x^6) = 8 d/dx(x^6) = 8(6x^5) = 48x^5"
  - signature: `(empty)`
- Q27 (FIT, 0 UNMAPPED): "Example: If y = x^4 + 5x^3 − 3x^2 + 7x − 9, find dy/dx."
  - signature: `differentiate polynomial`
- Q28 (NO FIT, 0 UNMAPPED): "Example: If y = x^3 sin x, find dy/dx."
  - signature: `(empty)`
- Q29 (FIT, 0 UNMAPPED): "Example: If y = (2x^3 − 5) / (x^2 + 6)"
  - signature: `apply quotient rule`
- Q30 (NO FIT, 0 UNMAPPED): "Example: Find dy/dx if (a) y = sin (4x^2 + 5)"
  - signature: `(empty)`
- Q31 (NO FIT, 0 UNMAPPED): "Example: Find dy/dx if (b) y = sin^2 x"
  - signature: `(empty)`
- Q32 (NO FIT, 0 UNMAPPED): "Example: Find dy/dx if (c) y = e^(6x^4)"
  - signature: `(empty)`
- Q33 (NO FIT, 0 UNMAPPED): "Exercise 2: 1. Find dy/dx if y = e^(3x^5) cos(7x^2 − 4x)"
  - signature: `(empty)`
- Q34 (NO FIT, 0 UNMAPPED): "Exercise 2: 2. Find dy/dx if y = (5x^6 − 2x^3 + 4) / (15x^5 − 6)"
  - signature: `apply quotient rule -> differentiate quotient component -> algebraic manipulation of derivatives`
- Q35 (FIT, 0 UNMAPPED): "Exercise 2: 3. Find dy/dx if y = (4x^3 − 5)^16"
  - signature: `differentiate polynomial`
