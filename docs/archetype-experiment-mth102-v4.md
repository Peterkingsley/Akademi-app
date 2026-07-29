# Archetype Extraction Experiment v4 — MTH 102

Captured 2026-07-26T23:05:00.162Z. Standalone experiment, not wired into any job/queue. No database writes (label/vocabulary caches and this report are the only file artifacts).

## Methodology

- **v3 -> v4 change:** v3's failure was exact-match brittleness caused by step-labeling granularity drift between the original labeling pass and the hold-out pass. v4 removes that source of noise by classifying every canonical operation as DISCRIMINATING (identifies the solution form) or GENERIC (bookkeeping shared across many forms), then building signatures from DISCRIMINATING operations only.
- Step 0 reused v3's output with **no re-extraction and no re-labeling of the 356 examples**. v3 never persisted per-example labels to disk, so this step reconstructed archetype-level aggregates (signature/memberCount/canonicalStem for all 325 v3 archetypes) from its markdown report and cached them to `docs\mth102-labels-v3.json` (already present from an earlier run of this script). This is a lossless-enough input for Steps 1-2: those steps only need each distinct full signature and its member count, both of which the v3 archetype list already provides directly.
- Step 1 (model) consolidated 444 distinct raw v3 canonical labels into a closed vocabulary, chunked in batches of 40 with repeated AI-merge rounds until small enough for one final pass explicitly targeting 40-80 entries. Vocabulary consolidation tiers: tier1=325, tier2=259, tier3=256, tier4=254, tier5=252, tier6=250, final=50. The result is FROZEN — no later step adds to it.
- Step 2 (no AI call) rebuilt every v3 archetype's signature using only its DISCRIMINATING-classified labels (GENERIC ones dropped), then regrouped by exact string match on that shorter signature — purely deterministic.
- Step 3 (model) read "MTH 102 TUTORIAL 2026" fresh (the designated hold-out phase), extracted its questions (1 call), then labeled each question's solution steps in batches of at most 5 (hard cap), hard-constrained to the frozen vocabulary or the literal sentinel "UNMAPPED" — no new labels permitted. Any label the model returned outside the frozen vocabulary and not literally "UNMAPPED" was coerced to "UNMAPPED" in code (count: 0).
- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.
- Model usage per phase (so it's traceable which calls came from the primary model vs. its fallback):
  - vocab-tier1: gemini-3.1-flash-lite x12
  - vocab-tier2: gemini-3.1-flash-lite x9
  - vocab-tier3: gemini-3.1-flash-lite x7
  - vocab-tier4: gemini-3.1-flash-lite x7
  - vocab-tier5: gemini-3.1-flash-lite x7
  - vocab-tier6: gemini-3.1-flash-lite x7
  - vocab-final: gemini-3.1-flash-lite x1
  - step3-extract-questions: gemini-3.1-flash-lite x1
  - step3-label-holdout: gemini-3.1-flash-lite x8

## Step 1 — closed vocabulary

**50 entries** (25 DISCRIMINATING, 25 GENERIC). 23 raw label(s) were dropped by the model mid-merge and auto-recovered as singleton entries. 0 raw label(s) remain unmapped after recovery.

### DISCRIMINATING entries

- `apply L'Hôpital's rule` (1 alias)
- `apply chain rule` (2 aliases)
- `apply integration by parts` (3 aliases)
- `apply u-substitution` (5 aliases)
- `apply power rule` (2 aliases)
- `apply quotient rule` (1 alias)
- `apply product rule` (1 alias)
- `apply implicit differentiation` (1 alias)
- `apply trigonometric identity` (5 aliases)
- `apply fundamental theorem of calculus` (1 alias)
- `apply signum definition` (2 aliases)
- `apply absolute value definition` (4 aliases)
- `apply floor definition` (3 aliases)
- `apply ceiling definition` (5 aliases)
- `apply squeeze theorem` (1 alias)
- `apply intermediate value theorem` (1 alias)
- `apply quadratic formula` (1 alias)
- `complete the square` (1 alias)
- `perform polynomial division` (1 alias)
- `compute cartesian product` (2 aliases)
- `apply injective/surjective definition` (4 aliases)
- `analyze denominator sign` (1 alias)
- `analyze function range` (1 alias)
- `analyze growth behavior` (2 aliases)
- `apply power rule for integration` (2 aliases)

### GENERIC entries

- `simplify expression` (63 aliases)
- `arithmetic evaluation` (46 aliases)
- `substitute value` (38 aliases)
- `solve equation` (38 aliases)
- `evaluate limit` (13 aliases)
- `calculate derivative` (10 aliases)
- `evaluate integral` (15 aliases)
- `define domain and range` (12 aliases)
- `identify asymptotes` (3 aliases)
- `evaluate trigonometric functions` (9 aliases)
- `evaluate logarithm` (11 aliases)
- `evaluate exponential` (8 aliases)
- `analyze inequality` (8 aliases)
- `set conditions` (9 aliases)
- `assign variables` (20 aliases)
- `identify features` (25 aliases)
- `miscellaneous operations` (49 aliases)
- `calculate ratio` (1 alias)
- `compare values` (9 aliases)
- `evaluate denominator` (1 alias)
- `evaluate numerator` (1 alias)
- `express as interval` (1 alias)
- `extract roots` (1 alias)
- `identify components` (1 alias)
- `interpret definition` (2 aliases)

### Unmapped raw labels

_None — every v3 label mapped to a vocabulary entry._

## Step 2 — discriminating-only archetypes

**56 archetypes**, 30 singletons (from 325 v3 archetypes covering 356 examples).

178 examples across 162 v3 archetypes collapsed to an EMPTY discriminating-only signature (every one of their v3 labels was GENERIC or unmapped) — excluded from the reference set used for Step 3 matching.

### Top 15 archetypes by member count

- **[memberCount=178]** `(empty)`
  - canonicalStem: Find limx→0 ex−1 x .
- **[memberCount=46]** `apply power rule`
  - canonicalStem: Find d dx (x−2).
- **[memberCount=14]** `apply chain rule`
  - canonicalStem: Find y′ for y = ex2 .
- **[memberCount=12]** `apply power rule -> apply power rule`
  - canonicalStem: Example 4.11. Find R √x + 1 √x dx.
- **[memberCount=9]** `apply trigonometric identity`
  - canonicalStem: Example 4.27. Find R sin2 x dx.
- **[memberCount=8]** `apply fundamental theorem of calculus`
  - canonicalStem: 4.5. Find R cos x dx.
- **[memberCount=4]** `apply absolute value definition`
  - canonicalStem: olve the inequality |2x + 1| < 7.
- **[memberCount=4]** `apply L'Hôpital's rule`
  - canonicalStem: Find limx→∞ ln x x .
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
- **[memberCount=4]** `apply integration by parts -> apply integration by parts`
  - canonicalStem: Example 4.17. Find R xex dx.
- **[memberCount=3]** `apply quotient rule`
  - canonicalStem: Find y′ for y = x2 ex .
- **[memberCount=3]** `compute cartesian product`
  - canonicalStem: Example 4: Let \(A = \{a, b\}\), \(B = \{c, d\}\). Find some relations from A to B.

## Step 3 — hold-out test (MTH 102 TUTORIAL 2026)

36 questions extracted.

**coverageScore = 21 / 36 = 0.583**

Total UNMAPPED step labels across all questions: 1.

Differentiation-related questions (12 identified) produced **7 distinct discriminating-only signature(s)**.

### Unmatched questions (with closest archetype)

- Q1: "(b) Evaluate lim x→0 (sqrt(x + 4) − 2) / x"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q2: "2. Evaluate the following using limits law (a) lim x→2 (5x^3 − 3x^2 + 5x − 4)"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q3: "(b) lim x→−1 (6x^4 + 9x^2 − 5x − 3) / (7x^2 + 4x)"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q4: "3. Evaluate the following (a) lim x→3 (2x^5 − 7x^3 + 5x − 6) / (7x^2 − 4x − 5)"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q5: "(b) lim θ→π/6 (sin θ − cos 2θ) / (2 cos θ + sin 2θ)"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q7: "5. Evaluate lim x→3 (2x^2 − 5x − 3) / (x − 3)"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q8: "6. Given that f(x) = { 8 − 2x if x > 4; sqrt(4 − x) if x ≤ 4 } Show whether the lim x→4 f(x) exists"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q10: "2. Evaluate lim x→0 (sqrt(x + 81) − 9) / 6x"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q11: "3. Evaluate lim x→−3 (6x^4 − x^3 + 4x^2 − 18) / (5x^2 + 3x + 9)"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q12: "4. Evaluate without calculator or Mathematical table lim x→3π/4 (sin x − 2 cos(1/3 x)) / (2 cos x + sin(1/3 x))"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q15: "2. lim x→∞ (5x^2 + 2x + 9) / (3x^2 − 2x + 8)"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q16: "3. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (3x^2 + 4x + 1)"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q17: "Example: Evaluate lim x→∞ (sqrt(4x^4 + 6x^3 − 7x + 8)) / (2x^2 + 7x + 5)"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q25: "Example: If y = x^5, then dy/dx = 5x^4"
  - signature: `(empty)`
  - closest archetype: `apply power rule` (overlap=0.00)
- Q31: "(b) y = sin^2 x"
  - signature: `apply chain rule -> apply power rule -> apply trigonometric identity`
  - closest archetype: `apply chain rule -> apply trigonometric identity` (overlap=0.67)

### Full per-question results

- Q0 (FIT, 0 UNMAPPED): "1. (a) Evaluate lim x→4 (2x^2 − 11x + 12) / (x − 4)"
  - signature: `perform polynomial division`
- Q1 (NO FIT, 0 UNMAPPED): "(b) Evaluate lim x→0 (sqrt(x + 4) − 2) / x"
  - signature: `(empty)`
- Q2 (NO FIT, 0 UNMAPPED): "2. Evaluate the following using limits law (a) lim x→2 (5x^3 − 3x^2 + 5x − 4)"
  - signature: `(empty)`
- Q3 (NO FIT, 0 UNMAPPED): "(b) lim x→−1 (6x^4 + 9x^2 − 5x − 3) / (7x^2 + 4x)"
  - signature: `(empty)`
- Q4 (NO FIT, 0 UNMAPPED): "3. Evaluate the following (a) lim x→3 (2x^5 − 7x^3 + 5x − 6) / (7x^2 − 4x − 5)"
  - signature: `(empty)`
- Q5 (NO FIT, 0 UNMAPPED): "(b) lim θ→π/6 (sin θ − cos 2θ) / (2 cos θ + sin 2θ)"
  - signature: `(empty)`
- Q6 (FIT, 0 UNMAPPED): "4. Evaluate lim x→0 (sin 7x) / (sin 3x)"
  - signature: `apply L'Hôpital's rule`
- Q7 (NO FIT, 0 UNMAPPED): "5. Evaluate lim x→3 (2x^2 − 5x − 3) / (x − 3)"
  - signature: `(empty)`
- Q8 (NO FIT, 0 UNMAPPED): "6. Given that f(x) = { 8 − 2x if x > 4; sqrt(4 − x) if x ≤ 4 } Show whether the lim x→4 f(x) exists"
  - signature: `(empty)`
- Q9 (FIT, 0 UNMAPPED): "Exercise 1: 1. Show whether lim x→0 (9|x| − 5x) / x exists."
  - signature: `apply absolute value definition`
- Q10 (NO FIT, 0 UNMAPPED): "2. Evaluate lim x→0 (sqrt(x + 81) − 9) / 6x"
  - signature: `(empty)`
- Q11 (NO FIT, 0 UNMAPPED): "3. Evaluate lim x→−3 (6x^4 − x^3 + 4x^2 − 18) / (5x^2 + 3x + 9)"
  - signature: `(empty)`
- Q12 (NO FIT, 0 UNMAPPED): "4. Evaluate without calculator or Mathematical table lim x→3π/4 (sin x − 2 cos(1/3 x)) / (2 cos x + sin(1/3 x))"
  - signature: `(empty)`
- Q13 (FIT, 0 UNMAPPED): "Example: Evaluate lim x→∞ (x^3 − x)"
  - signature: `analyze growth behavior`
- Q14 (FIT, 0 UNMAPPED): "Examples: Evaluate the following 1. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (2x^4 − 7x^3 − 2x + 6)"
  - signature: `analyze growth behavior`
- Q15 (NO FIT, 0 UNMAPPED): "2. lim x→∞ (5x^2 + 2x + 9) / (3x^2 − 2x + 8)"
  - signature: `(empty)`
- Q16 (NO FIT, 0 UNMAPPED): "3. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (3x^2 + 4x + 1)"
  - signature: `(empty)`
- Q17 (NO FIT, 0 UNMAPPED): "Example: Evaluate lim x→∞ (sqrt(4x^4 + 6x^3 − 7x + 8)) / (2x^2 + 7x + 5)"
  - signature: `(empty)`
- Q18 (FIT, 0 UNMAPPED): "1. Find dy/dx if (a) y = x^2"
  - signature: `apply power rule`
- Q19 (FIT, 0 UNMAPPED): "(b) y = 3x^3 + 5"
  - signature: `apply power rule`
- Q20 (FIT, 0 UNMAPPED): "(c) y = sqrt(2x − 7)"
  - signature: `apply chain rule -> apply power rule`
- Q21 (FIT, 0 UNMAPPED): "(d) y = sin 2x"
  - signature: `apply chain rule`
- Q22 (FIT, 1 UNMAPPED): "Exercise 2: 1. Prove that if y = x^n, then dy/dx = nx^(n−1)"
  - signature: `apply power rule`
- Q23 (FIT, 0 UNMAPPED): "2. Find dy/dx if y = sqrt(5x + 8)"
  - signature: `apply chain rule -> apply power rule`
- Q24 (FIT, 0 UNMAPPED): "3. Find dy/dx given that y = cos(1/3 x)"
  - signature: `apply chain rule`
- Q25 (NO FIT, 0 UNMAPPED): "Example: If y = x^5, then dy/dx = 5x^4"
  - signature: `(empty)`
- Q26 (FIT, 0 UNMAPPED): "Example: If y = 8x^6, then dy/dx = d/dx(8x^6) = 8 d/dx(x^6) = 8(6x^5) = 48x^5"
  - signature: `apply power rule`
- Q27 (FIT, 0 UNMAPPED): "Example: If y = x^4 + 5x^3 − 3x^2 + 7x − 9, find dy/dx."
  - signature: `apply power rule`
- Q28 (FIT, 0 UNMAPPED): "Example: If y = x^3 sin x, find dy/dx."
  - signature: `apply product rule`
- Q29 (FIT, 0 UNMAPPED): "Example: If y = (2x^3 − 5) / (x^2 + 6)."
  - signature: `apply quotient rule`
- Q30 (FIT, 0 UNMAPPED): "Example: Find dy/dx if (a) y = sin (4x^2 + 5)"
  - signature: `apply chain rule`
- Q31 (NO FIT, 0 UNMAPPED): "(b) y = sin^2 x"
  - signature: `apply chain rule -> apply power rule -> apply trigonometric identity`
- Q32 (FIT, 0 UNMAPPED): "(c) y = e^(6x^4)"
  - signature: `apply chain rule`
- Q33 (FIT, 0 UNMAPPED): "Exercise 2: 1. Find dy/dx if y = e^(3x^5) cos(7x^2 − 4x)"
  - signature: `apply product rule -> apply chain rule`
- Q34 (FIT, 0 UNMAPPED): "2. Find dy/dx if y = (5x^6 − 2x^3 + 4) / (15x^5 − 6)"
  - signature: `apply quotient rule`
- Q35 (FIT, 0 UNMAPPED): "3. Find dy/dx if y = (4x^3 − 5)^16"
  - signature: `apply chain rule -> apply power rule`

## Follow-up A — empty-signature audit

Captured 2026-07-26T23:26:48.155Z.

162 distinct v3 archetypes produced an empty discriminating-only signature, covering 178 of the 356 cached examples. Per-example sampling isn't possible — v3 never persisted per-example labels (see Step 0's methodology note), so this audit samples 30 of the **162 distinct archetypes** (each backed by a real, verbatim member problemText as its canonicalStem) rather than 30 of the 178 raw examples.

**Split: 16 TRIVIAL, 14 MISLABELLED** (of 30 sampled).

### Vocabulary entries implicated in MISLABELLED cases

- `calculate derivative`
- `miscellaneous operations`
- `evaluate limit`
- `evaluate integral`
- `assign variables`
- `simplify expression`

### Full sample

- [TRIVIAL] "Example 2.17. Find limx→2(x2 − 3x + 5)."
- [TRIVIAL] "Example 1.97. A company manufactures widgets. The cost function is C(q) = 8000 +
40q and each widget sells for $80. Find: (a) The revenue function. (b"
- [MISLABELLED] "Find f ′(x) for f (x) = √x."
  - technique: Power Rule for differentiation
  - wrongly absorbed by: `calculate derivative`
- [TRIVIAL] "Example 5: Let \(A = \{1, 2, 3, 4, 5\}\), \(B = \{6, 7, 8\}\). If \(f: A \to B\) is such that \(f(1) = 6, f(2) = 7, f(3) = 7, f(4) = 8, f(5) = 7\). Th"
- [MISLABELLED] "Find f ′(3) for f (x) = 2x2 − 3x + 1 using the limit de nition."
  - technique: First Principles / Limit Definition of Derivative
  - wrongly absorbed by: `calculate derivative`
- [TRIVIAL] "Example 1.25. Verify the reverse triangle inequality for a = 7 and b = 2."
- [TRIVIAL] "Example 4.10. Find R 2 x + 3 sin x − 4ex dx."
- [TRIVIAL] "Find limx→4
√x · (x + 2)."
- [MISLABELLED] "Example 1.117. A drug is administered orally. The absorption rate is ka = 2 per hour
and the elimination rate is ke = 0.5 per hour. C0 = 10 mg/L. Find"
  - technique: Bateman equation / First-order linear differential equation system
  - wrongly absorbed by: `miscellaneous operations`
- [MISLABELLED] "Example 2.14. For f (x) =
(
3, x ≤ 2
x + 1, x > 2 ,  nd limx→2 f (x)."
  - technique: One-sided limit analysis
  - wrongly absorbed by: `evaluate limit`
- [TRIVIAL] "Example 1.24. Verify the triangle inequality for a = 5 and b = −3."
- [TRIVIAL] "Example 1.99. A book publisher has  xed costs of $50,000 for a new book. The variable
cost per book is $8, and the book sells for $20. Find: (a) The c"
- [TRIVIAL] "An investment of $1000 earns interest at an annual rate of 5% compounded n times per year. The amount after t years is An(t) = 1000 1 + 0.05 n nt. As "
- [MISLABELLED] "Example 2.8. Find limx→2 x2−4
x−2 ."
  - technique: algebraic factorization and cancellation of removable singularity
  - wrongly absorbed by: `evaluate limit`
- [MISLABELLED] "Example 4.38. Find R 1 √4−x2 dx."
  - technique: trigonometric substitution
  - wrongly absorbed by: `evaluate integral`
- [MISLABELLED] "Example 4.25. Find R 3x+5 (x+1)(x+2) dx."
  - technique: Partial Fraction Decomposition
  - wrongly absorbed by: `evaluate integral`
- [TRIVIAL] "Example 2.39 (Accounting: Present Value with Continuous Compounding). The present
value of a future payment P received after t years with continuous c"
- [TRIVIAL] "Example 1.87. Find the domain of f (x) = ln(x2 − 9)."
- [TRIVIAL] "Example: suppose \(f, g, h: \mathbb{R} \to \mathbb{R}\) are defined by \(f(x) = 4x+3\), \(g(x) = x^2-2\), \(h(x) = e^x\). Find (i) \(g \circ h\) (ii) "
- [MISLABELLED] "Example 1.46. A courier company charges $8 for the rst kilogram or fraction thereof, and $4 for each additional kilogram or fraction thereof. Find the"
  - technique: Piecewise Function Modeling
  - wrongly absorbed by: `assign variables`
- [MISLABELLED] "Example 2.41. Find lim
x→0
sin2 x
x2 ."
  - technique: L'Hôpital's Rule or Fundamental Trigonometric Limit
  - wrongly absorbed by: `evaluate limit`
- [MISLABELLED] "Example 4.12. Find R 2xex2 dx."
  - technique: u-substitution
  - wrongly absorbed by: `evaluate integral`
- [TRIVIAL] "Example 2.38 (Business: Marginal Cost as Limit of Average Rate of Change). The
marginal cost is de ned as M C(x) = limh→0 C(x+h)−C(x)
h . For a cost f"
- [MISLABELLED] "Example 4.24. Find R 2x+3 x2+3x+2 dx."
  - technique: u-substitution (logarithmic integration)
  - wrongly absorbed by: `evaluate integral`
- [TRIVIAL] "Example 1.93. A manufacturing company has  xed costs of $10,000 per month and
variable costs of $25 per unit produced. Write the cost function and  nd"
- [TRIVIAL] "Find f ′(x) for f (x) = √x."
- [MISLABELLED] "Example 2.15. Find limx→0 1
x2 using one-sided limits."
  - technique: Infinite Limit Analysis
  - wrongly absorbed by: `evaluate limit`
- [MISLABELLED] "Example 1.31. Express f (x) = |x| using the signum function."
  - technique: Piecewise Function Decomposition
  - wrongly absorbed by: `simplify expression`
- [MISLABELLED] "Example 2.37 (Business: Average Cost as Production Increases). A company's total
cost function is C(x) = 5000 + 30x where x is the number of units pro"
  - technique: Horizontal Asymptote Analysis
  - wrongly absorbed by: `evaluate limit`
- [TRIVIAL] "Find f ′(2) for f (x) = x2."

### Model usage (Part A)

  - partA-classify: gemini-3.1-flash-lite x6

## Follow-up B — order-tolerant matching

Captured 2026-07-26T23:26:48.155Z. Recomputed entirely from cached data (`docs\mth102-labels-v3.json`, `docs\mth102-operation-vocabulary.json`, and this report's own Step 3 per-question signatures). Zero AI calls.

- **Exact ordered signature match**: the Step 3 baseline — two examples are the same archetype only if their discriminating-only label sequences are identical, in order.
- **Set match**: order-insensitive — same set of discriminating operations, any order.
- **Subset match**: a question fits an archetype if its operation set is a subset of the archetype's, or vice versa.
- An empty discriminating-only signature never counts as a meaningful match under any strategy (an empty set is trivially a subset of everything, which would otherwise let every "no distinctive technique" question falsely match every archetype) — and for the differentiation-split counts, an empty-signature question is always its own isolated group rather than merging with other empty-signature questions or anything else, under all three strategies.

### exact ordered signature match

**coverageScore = 21 / 36 = 0.583**

Differentiation split: **7** distinct group(s) among 12 differentiation-related questions.

### set match (order ignored)

**coverageScore = 21 / 36 = 0.583**

Differentiation split: **7** distinct group(s) among 12 differentiation-related questions.

### subset match

**coverageScore = 22 / 36 = 0.611**

Differentiation split: **3** distinct group(s) among 12 differentiation-related questions.

### Q31 (sin^2 x)

- signature: `apply chain rule -> apply power rule -> apply trigonometric identity`
- exact ordered match: NO FIT
- set match: NO FIT
- subset match: FIT (`apply power rule`, `apply chain rule`, `apply power rule -> apply power rule`, `apply trigonometric identity`, `apply chain rule -> apply chain rule`, `apply trigonometric identity -> apply trigonometric identity`, `apply chain rule -> apply trigonometric identity`, `apply chain rule -> apply power rule`, `apply chain rule -> apply chain rule -> apply chain rule`, `apply trigonometric identity -> apply trigonometric identity -> apply trigonometric identity`, `apply power rule -> apply power rule -> apply power rule`)
