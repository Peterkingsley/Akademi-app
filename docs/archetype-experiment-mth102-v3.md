# Archetype Extraction Experiment v3 — MTH 102

Captured 2026-07-26T22:35:21.233Z. Standalone experiment, not wired into any job/queue. No database writes (extraction cache is the only file artifact besides this report).

## Methodology

- **v2 -> v3 change:** clustering is no longer a model judgment call. Step 1 labels individual solution steps with short operation phrases (model). Step 2 normalizes the label vocabulary, merging only exact-same-operation synonyms (model). Step 3 groups examples by exact string match of their ordered canonical-label signature (deterministic, zero AI calls).
- Extraction (Step 0) is unchanged from v2 and is cached to `docs\mth102-extracted-examples.json` on first run; every later run of this script reads the cache and never re-extracts. That cache was populated this run — every single Step 0 call hit the primary model's 429 (confirmed still exhausted from prior sessions today) and fell back successfully to the secondary model.
- **Scope reduced to 1 stability run** (from the original design's 3): the full 3-run design needs ~228 model calls, all of which would route through the fallback model since the primary is exhausted for today. Step 4's stabilityScore is therefore NOT measured this run — see Step 4.
- Source (extraction ONLY, already cached): "MTH 102 CALCULUS LECTURE NOTES", "MTH 102 LECTURE 1", "MTH 102 LECTURE 1 CONT.".
- Held out (never read until Step 5): "MTH 102 TUTORIAL 2026".
- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.
- Step 1 labeling ran in batches of at most 5 examples per call (hard cap), temperature=0.7.
- Step 2 normalization: a single call over every distinct raw label timed out in practice (too many distinct phrasings for one prompt), so it runs as two chunked tiers instead — tier 1 normalizes within batches of 40, tier 2 makes one more pass over the resulting tier-1 canonical labels to catch merges spanning batch boundaries. temperature=0.2.
- Step 4 stability comparison was not performed (only 1 run — nothing to compare across runs).
- Step 5 hold-out reuses run 1's vocabulary and archetype set as the frozen reference.
- Model usage per phase (so it's traceable which calls came from the primary model vs. its fallback):
  - run1:label: gemini-3.1-flash-lite x72
  - run1:normalize-tier1: gemini-3.1-flash-lite x13
  - run1:normalize-tier2: gemini-3.1-flash-lite x12
  - step5-extract-questions: gemini-3.1-flash-lite x1
  - step5-label-holdout: gemini-3.1-flash-lite x8

## Step 1-3 — per stability run

### Run 1: vocabulary 512 -> 444, 325 archetypes, 299 singletons

- **[memberCount=5]** `apply fundamental theorem of calculus`
  - canonicalStem: 4.5. Find R cos x dx.
- **[memberCount=3]** `divide by highest power -> apply limit laws -> evaluate limit`
  - canonicalStem: Example 2.28. Find lim
x→∞
2x2 + 1
5x3 − 3x.
- **[memberCount=3]** `apply power rule -> evaluate expression`
  - canonicalStem: Example 3.58. For C(q) = 5000 + 30q + 0.05q2,  nd the marginal cost function and
evaluate at q = 200.
- **[memberCount=2]** `remove absolute value -> subtract constant -> divide by coefficient -> express as interval`
  - canonicalStem: olve the inequality |2x + 1| < 7.
- **[memberCount=2]** `identify degree -> identify leading coefficient`
  - canonicalStem: Example 1.52. Describe the end behavior of f (x) = −2x3 + 4x2 − 1.
- **[memberCount=2]** `set numerator to zero -> solve for x -> evaluate denominator -> set x to zero -> evaluate expression`
  - canonicalStem: Example 1.63. Find the x-intercepts and y-intercept of f (x) = x2−4 x2−1 .
- **[memberCount=2]** `substitute y for f(x) -> subtract -> divide -> swap variables`
  - canonicalStem: Example 1.91. Find the inverse of f (x) = 2x + 3.
- **[memberCount=2]** `substitute y for f(x) -> take square root -> swap variables`
  - canonicalStem: Example 1.92. For f (x) = x2 with domain [0, ∞),  nd the inverse.
- **[memberCount=2]** `define function -> substitute value -> multiply -> add -> substitute value -> multiply -> add -> set equation to constant -> subtract constant -> divide by coefficient`
  - canonicalStem: Example 1.96. A utility company charges a  xed monthly connection fee of $15 plus
$0.12 per kilowatt-hour (kWh) of electricity used. Find: (a) The cost function. (b) The
cost for using 400 kWh. (c) The cost for using 800 kWh. (d) How many kWh were used
if the bill is $75?
- **[memberCount=2]** `define function -> subtract -> distribute negative sign -> combine like terms -> set equation to zero -> add constants -> divide by coefficient -> substitute value -> multiply -> subtract`
  - canonicalStem: Example 1.97. A company manufactures widgets. The cost function is C(q) = 8000 +
40q and each widget sells for $80. Find: (a) The revenue function. (b) The pro t
function. (c) The break-even point. (d) The pro t when 300 widgets are sold.
- **[memberCount=2]** `factor numerator -> cancel common factors -> evaluate limit`
  - canonicalStem: Example 2.9. Find limx→3 x2−9
x−3 .
- **[memberCount=2]** `select piece -> evaluate limit -> select piece -> evaluate limit -> compare limits`
  - canonicalStem: Example 2.14. For f (x) =
(
3, x ≤ 2
x + 1, x > 2 ,  nd limx→2 f (x).
- **[memberCount=2]** `apply root law`
  - canonicalStem: Example 2.20. Find limx→27 3
√x.
- **[memberCount=2]** `divide by highest power -> evaluate limit`
  - canonicalStem: Find lim x→∞ 3x2 + 2x + 1 x2 − 1 .
- **[memberCount=2]** `multiply by conjugate -> simplify numerator -> cancel common factors -> evaluate limit`
  - canonicalStem: Find lim x→0 √1 + x − 1 x .
- **[memberCount=2]** `divide by x3 -> evaluate limit`
  - canonicalStem: Find lim x→∞ 5x3 − 2x + 1 2x3 + x2 − 4 .
- **[memberCount=2]** `evaluate function -> evaluate limit -> compare values`
  - canonicalStem: Is f (x) = x2 + 3x − 2 continuous at x = 1?
- **[memberCount=2]** `apply power rule -> apply constant multiple rule -> simplify`
  - canonicalStem: Find d dx (4x6 − 2x4 + 5x2 − 8).
- **[memberCount=2]** `identify components -> calculate derivatives -> apply quotient rule -> factor expression -> simplify exponent`
  - canonicalStem: Find y′ for y = x2 ex .
- **[memberCount=2]** `substitute u -> apply chain rule`
  - canonicalStem: Find y′ for y = ex2 .
- **[memberCount=2]** `identify indeterminate form -> apply L'Hôpital's rule -> simplify fraction -> evaluate limit`
  - canonicalStem: Find limx→∞ ln x x .
- **[memberCount=2]** `apply power rule -> apply power rule -> evaluate inequality`
  - canonicalStem: Example 3.90. For a cost function C(q) = 1000+20q +0.05q2,  nd C′′(q) and interpret.
- **[memberCount=2]** `apply power rule -> apply trigonometric rule -> apply exponential rule -> combine terms`
  - canonicalStem: Example 4.7. Find R (3x2 − 2 sin x + ex) dx.
- **[memberCount=2]** `apply trigonometric identity -> distribute integral -> evaluate integral -> simplify`
  - canonicalStem: Example 4.27. Find R sin2 x dx.
- **[memberCount=2]** `identify trigonometric antiderivative -> evaluate boundaries -> substitute trigonometric values -> simplify arithmetic`
  - canonicalStem: Example 5.5. Compute R π 0 sin x dx.
- **[memberCount=2]** `compute cartesian product -> compute cartesian product`
  - canonicalStem: Example 3: If \(A = \{a_1, a_2\}\). Then
- **[memberCount=1]** `compute cartesian product -> calculate cardinality`
  - canonicalStem: Example 1.2. Let A = {1, 2, 3} and B = {x, y}. Then A × B = {(1, x), (1, y), (2, x), (2, y), (3, x), (3, y)}. The cardinality is |A| · |B| = 3 × 2 = 6.
- **[memberCount=1]** `evaluate relation condition`
  - canonicalStem: Example 1.4. Let A = {1, 2, 3, 4}, B = {2, 4, 6, 8}. De ne R = {(a, b) ∈ A × B | b = 2a}. Then R = {(1, 2), (2, 4), (3, 6), (4, 8)}.
- **[memberCount=1]** `set output equality -> simplify equation`
  - canonicalStem: Example 1.7. f (x) = 3x − 2 is injective because 3x1 − 2 = 3x2 − 2 implies x1 = x2.
- **[memberCount=1]** `evaluate function at positive value -> evaluate function at negative value -> compare inputs`
  - canonicalStem: Example 1.8. f (x) = x2 is NOT injective because f (2) = f (−2) = 4 but 2̸ = −2.
- **[memberCount=1]** `invert function`
  - canonicalStem: Example 1.10. f (x) = 3x − 2 is surjective because for any y, x = (y + 2)/3 works.
- **[memberCount=1]** `identify range constraint`
  - canonicalStem: Example 1.11. f (x) = x2 is NOT surjective onto R because negative numbers have no preimage.
- **[memberCount=1]** `verify bijective property -> verify bijective property`
  - canonicalStem: Example 1.13. f (x) = 3x − 2 is bijective. f (x) = x3 is also bijective.
- **[memberCount=1]** `equate expressions -> subtract constant -> divide by coefficient -> solve for x -> verify real domain -> conclude bijection`
  - canonicalStem: Example 1.14. Determine if f : R → R, f (x) = 2x + 3 is injective, surjective, or bijective.
- **[memberCount=1]** `provide counterexample`
  - canonicalStem: Example 1.15. Determine if f : Z → Z, f (n) = n2 is injective.
- **[memberCount=1]** `solve for preimage`
  - canonicalStem: Example 1.16. Determine if f : R → [0, ∞), f (x) = x2 is surjective.
- **[memberCount=1]** `evaluate constant function`
  - canonicalStem: Example 1.18. Let f (x) = 5. Find f (0), f (10), and f (−3).
- **[memberCount=1]** `define function -> define domain -> define range`
  - canonicalStem: Example 1.19. A taxi company charges a  at fee of $3 per ride regardless of distance. Write the cost function and state its domain and range.
- **[memberCount=1]** `evaluate identity function -> evaluate identity function -> evaluate identity function`
  - canonicalStem: Example 1.21. For f (x) = x, compute f (5), f (−2), and f (0).
- **[memberCount=1]** `apply injective definition -> apply surjective definition -> conclude bijection`
  - canonicalStem: Example 1.22. Show that the identity function is bijective.
- **[memberCount=1]** `add terms -> evaluate absolute value -> evaluate absolute value -> add terms -> compare values`
  - canonicalStem: Example 1.24. Verify the triangle inequality for a = 5 and b = −3.
- **[memberCount=1]** `evaluate absolute value -> evaluate absolute value -> compare values`
  - canonicalStem: Example 1.25. Verify the reverse triangle inequality for a = 7 and b = 2.
- **[memberCount=1]** `interpret definition -> split into cases -> solve linear equations`
  - canonicalStem: Example 1.26. Solve the equation |x − 3| = 5 using the properties of absolute value.
- **[memberCount=1]** `state inequality properties -> add inequalities -> apply absolute value definition`
  - canonicalStem: Example 1.28. Prove the triangle inequality: |a + b| ≤ |a| + |b|.
- **[memberCount=1]** `define inequality bounds -> add inequalities -> apply absolute value definition`
  - canonicalStem: Example 1.28. Prove the triangle inequality: |a + b| ≤ |a| + |b|.
- **[memberCount=1]** `apply signum definition -> apply signum definition -> apply signum definition`
  - canonicalStem: Example 1.30. Evaluate sgn(10), sgn(−5), and sgn(0).
- **[memberCount=1]** `define piecewise function -> substitute positive value -> substitute negative value -> evaluate boundary condition`
  - canonicalStem: Example 1.31. Express f (x) = |x| using the signum function.
- **[memberCount=1]** `multiply arguments -> apply signum definition -> evaluate signum factors -> multiply results -> compare values`
  - canonicalStem: Example 1.32. Verify the multiplicativity property: sgn(xy) = sgn(x) · sgn(y) for x = 2 and y = −3.
- **[memberCount=1]** `apply square property`
  - canonicalStem: Example 1.33. Simplify the expression sgn(x2) for x̸ = 0.
- **[memberCount=1]** `apply floor definition -> apply floor definition -> apply floor definition`
  - canonicalStem: Example 1.35. Evaluate ⌊3.7⌋, ⌊−2.3⌋, and ⌊5⌋.
- **[memberCount=1]** `convert floor to inequality`
  - canonicalStem: Example 1.36. Solve ⌊x⌋ = 4.
- **[memberCount=1]** `identify segment intervals -> define endpoint markers`
  - canonicalStem: Example 1.37. Graph f (x) = ⌊x⌋ for −3 ≤ x ≤ 3.
- **[memberCount=1]** `apply ceiling definition -> apply ceiling definition -> apply ceiling definition`
  - canonicalStem: Example 1.39. Evaluate ⌈3.2⌉, ⌈−2.7⌉, and ⌈5⌉.
- **[memberCount=1]** `convert ceiling to inequality`
  - canonicalStem: Example 1.40. Solve the equation ⌈x⌉ = 3.
- **[memberCount=1]** `interpret inequality -> apply ceiling definition`
  - canonicalStem: Example 1.41. Solve the inequality ⌈x⌉ ≤ 2.
- **[memberCount=1]** `define interval mapping -> specify endpoint conditions`
  - canonicalStem: Example 1.42. Graph f (x) = ⌈x⌉ for −3 ≤ x ≤ 3.
- **[memberCount=1]** `approximate value -> apply ceiling definition -> approximate value -> apply ceiling definition`
  - canonicalStem: Example 1.43. Find ⌈π⌉ and ⌈−π⌉.
- **[memberCount=1]** `evaluate ceiling -> evaluate floor -> negate result -> evaluate ceiling -> evaluate floor -> negate result`
  - canonicalStem: Example 1.44. Verify the relationship ⌈x⌉ = −⌊−x⌋ for x = 2.3 and x = −1.5.
- **[memberCount=1]** `model piecewise cost -> construct ceiling expression -> algebraic simplification`
  - canonicalStem: Example 1.45. A parking garage charges $5 for the rst hour or any part of an hour, and $3 for each additional hour or part thereof. Write the cost function C(t) for parking time t hours (where t > 0).
- **[memberCount=1]** `define piecewise function -> distribute constant`
  - canonicalStem: Example 1.46. A courier company charges $8 for the rst kilogram or fraction thereof, and $4 for each additional kilogram or fraction thereof. Find the cost to ship a package weighing w kilograms, where w > 0.
- **[memberCount=1]** `interpret ceiling inequality -> evaluate boundary condition`
  - canonicalStem: Example 1.47. Solve the inequality ⌈x⌉ > 2.
- **[memberCount=1]** `determine polynomial domain -> complete the square -> apply inequality property -> determine range`
  - canonicalStem: Example 1.50. Find the domain and range of f (x) = x2 − 4x + 7.
- **[memberCount=1]** `factor expression -> apply zero product property`
  - canonicalStem: Example 1.51. Find the zeros (roots) of f (x) = x2 − 5x + 6.
- **[memberCount=1]** `set denominator to zero -> factor expression -> solve for x -> exclude values from domain -> convert to interval notation`
  - canonicalStem: Example 1.54. Find the domain of f (x) = x+2 x2−9 .
- **[memberCount=1]** `analyze denominator sign -> conclude domain`
  - canonicalStem: Example 1.55. Find the domain of f (x) = 2x+1 x2+4 .
- **[memberCount=1]** `factor denominator -> solve for x -> compare factors -> identify asymptotes`
  - canonicalStem: Example 1.56. Find the vertical asymptotes of f (x) = x x2−4 .
- **[memberCount=1]** `factor numerator -> simplify fraction -> cancel common factors -> identify hole`
  - canonicalStem: Example 1.57. Find the vertical asymptotes of f (x) = x2−4 x−2 .
- **[memberCount=1]** `compare degrees -> identify leading coefficients -> calculate ratio`
  - canonicalStem: Example 1.58. Find the horizontal asymptote of f (x) = 3x2+2 x2−1 .
- **[memberCount=1]** `compare degrees -> assign horizontal asymptote`
  - canonicalStem: Example 1.59. Find the horizontal asymptote of f (x) = 5x+2 x3−1 .
- **[memberCount=1]** `compare degrees -> perform polynomial division`
  - canonicalStem: Example 1.60. Find the horizontal asymptote of f (x) = 2x3−4x+1 x2+3 .
- **[memberCount=1]** `factor numerator -> cancel common factors -> substitute x-value`
  - canonicalStem: Example 1.61. Identify any holes in the graph of f (x) = x2−4 x−2 .
- **[memberCount=1]** `factor numerator -> factor denominator -> simplify expression -> identify common factor -> substitute x-value -> evaluate expression`
  - canonicalStem: Example 1.62. Identify any holes in the graph of f (x) = x2−3x+2 x2−1 .
- **[memberCount=1]** `factor numerator -> factor denominator -> cancel common factors -> identify hole -> substitute x-value -> evaluate expression -> set denominator to zero -> solve for x -> compare degrees -> identify leading coefficients`
  - canonicalStem: Example 1.65. Find all asymptotes of f (x) = 2x2+3x−2 x2−x−6 .
- **[memberCount=1]** `set denominator to zero -> identify vertical asymptote -> compare degrees -> set numerator to zero -> set x to zero -> evaluate expression -> evaluate limit`
  - canonicalStem: Example 1.66. Sketch the graph of f (x) = 1 x−2 by identifying its asymptotes and intercepts.
- **[memberCount=1]** `factor numerator -> factor denominator -> cancel common factors -> identify hole -> substitute x-value -> evaluate expression -> identify domain restrictions -> set denominator to zero -> compare degrees -> identify leading coefficients`
  - canonicalStem: Example 1.67. Find the domain, vertical asymptotes, and horizontal asymptote of
f (x) = x2−9
x2+4x+3 .
- **[memberCount=1]** `identify factors -> compare degrees -> construct function -> substitute point -> simplify expression -> solve for constant -> substitute constant`
  - canonicalStem: Example 1.68. A rational function has vertical asymptotes at x = 2 and x = −3,
a horizontal asymptote at y = 0, and passes through the point (0, 1). Find a possible
equation.
- **[memberCount=1]** `distribute division -> evaluate limit -> identify asymptotes -> interpret result`
  - canonicalStem: Example 1.69. A company's average cost per unit when producing x units is given by
C(x) = 5000+30x
x . Find the horizontal asymptote and interpret its meaning.
- **[memberCount=1]** `evaluate power -> evaluate power -> evaluate power`
  - canonicalStem: Example 1.71. Evaluate 23, 1
2
 4, and e0.
- **[memberCount=1]** `analyze growth -> apply reflection -> identify intercept`
  - canonicalStem: Example 1.72. Graph f (x) = 2x and g(x) = 1
2
 x on the same axes.
- **[memberCount=1]** `express as common base -> equate exponents`
  - canonicalStem: Example 1.73. Solve the equation 2x = 8.
- **[memberCount=1]** `define exponential function`
  - canonicalStem: Example 1.74. A population of bacteria doubles every hour. If the initial population is
100, write the population as a function of time t (in hours).
- **[memberCount=1]** `rewrite base -> rewrite base -> apply identity property`
  - canonicalStem: Example 1.76. Evaluate log2 8, log3 1
9 , and ln e5.
- **[memberCount=1]** `apply quotient rule -> apply product rule -> apply power rule`
  - canonicalStem: Example 1.77. Expand ln
 x2y
z3
 .
- **[memberCount=1]** `convert to exponential form -> subtract constant -> substitute value`
  - canonicalStem: Example 1.78. Solve log2(x + 1) = 4.
- **[memberCount=1]** `apply product rule -> equate arguments -> expand binomial -> factor quadratic -> extract roots -> check domain constraints`
  - canonicalStem: Example 1.79. Solve ln x + ln(x − 2) = ln 8.
- **[memberCount=1]** `evaluate trigonometric functions`
  - canonicalStem: Example 1.81. Evaluate sin π
6 , cos π
3 , and tan π
4 .
- **[memberCount=1]** `identify reference angle -> apply quadrant identity`
  - canonicalStem: Example 1.82. Solve sin x = 1
2 for 0 ≤ x < 2π.
- **[memberCount=1]** `rewrite tangent as quotient -> set denominator to zero -> solve trigonometric equation -> define domain`
  - canonicalStem: Example 1.83. Find the domain of f (x) = tan x.
- **[memberCount=1]** `apply sine range bounds -> scale range -> shift range`
  - canonicalStem: Example 1.84. A Ferris wheel of radius 10 meters rotates once every 60 seconds. The
height of a passenger above the ground is given by h(t) = 15 + 10 sin πt
30 − π
2
 . Find the
maximum and minimum heights.
- **[memberCount=1]** `set radicand non-negative -> solve inequality -> determine domain -> evaluate function monotonicity -> determine range`
  - canonicalStem: Example 1.85. Find the domain and range of f (x) = √x − 3.
- **[memberCount=1]** `set denominator unequal to zero -> solve inequality`
  - canonicalStem: Example 1.86. Find the domain of f (x) = 1
x2−4 .
- **[memberCount=1]** `set argument positive -> isolate variable -> solve inequality`
  - canonicalStem: Example 1.87. Find the domain of f (x) = ln(x2 − 9).
- **[memberCount=1]** `assume equality -> apply cube root`
  - canonicalStem: Example 1.88. Determine if f (x) = x3 is injective.
- **[memberCount=1]** `test counterexample`
  - canonicalStem: Example 1.89. Determine if f (x) = x2 is surjective onto R.
- **[memberCount=1]** `analyze function range`
  - canonicalStem: Example 1.90. Determine if f (x) = ex is surjective onto R.
- **[memberCount=1]** `define linear function -> substitute value -> multiply -> add -> substitute value -> multiply -> add -> substitute value -> multiply -> add`
  - canonicalStem: Example 1.93. A manufacturing company has  xed costs of $10,000 per month and
variable costs of $25 per unit produced. Write the cost function and  nd the total cost for
producing 200 units, 500 units, and 1000 units.
- **[memberCount=1]** `define function -> substitute value -> multiply -> add -> substitute value -> multiply -> add`
  - canonicalStem: Example 1.95. A car rental company charges a  at fee of $50 per day plus $0.20 per
mile driven. Write the cost function and  nd the cost for a 3-day rental with 150 miles
driven.
- **[memberCount=1]** `define cost function -> define revenue function -> define profit function -> simplify expression -> set equation to zero -> add constants -> divide by coefficient -> approximate decimal -> substitute value -> multiply -> subtract constants -> set equation to constant -> add constants -> divide by coefficient -> approximate decimal`
  - canonicalStem: Example 1.99. A book publisher has  xed costs of $50,000 for a new book. The variable
cost per book is $8, and the book sells for $20. Find: (a) The cost, revenue, and pro t
functions. (b) The break-even point. (c) The pro t if 10,000 books are sold. (d) How
many books must be sold to make a pro t of $30,000?
- **[memberCount=1]** `define revenue function -> define profit function -> simplify expression -> set equation to zero -> add constants -> divide by coefficient -> substitute value -> multiply -> subtract constants -> set equation to constant -> add constants -> divide by coefficient`
  - canonicalStem: Example 1.100. A toy company produces a game. The cost to produce q games is
C(q) = 2500 + 15q. The company sells each game for $25. Find: (a) The pro t function.
(b) The break-even point. (c) The pro t when 400 games are sold. (d) How many games
must be sold to achieve a pro t of $5,000?
- **[memberCount=1]** `define height function`
  - canonicalStem: Example 1.101. A ball is thrown upward from ground level (h0 = 0) with an initial
velocity of 20 m/s. Use g = 9.8 m/s2. Find: (a) The height function. (b) The time at
which the ball reaches its maximum height. (c) The maximum height reached. (d) The
time when the ball hits the ground.
- **[memberCount=1]** `define height function -> identify vertex formula -> substitute values -> simplify quotient -> approximate decimal -> substitute values -> square term -> multiply -> subtract constants -> approximate decimal -> set equation to zero -> factor expression -> solve for variable -> add constants -> divide by coefficient -> approximate decimal`
  - canonicalStem: Example 1.101. A ball is thrown upward from ground level (h0 = 0) with an initial
velocity of 20 m/s. Use g = 9.8 m/s2. Find: (a) The height function. (b) The time at
which the ball reaches its maximum height. (c) The maximum height reached. (d) The
time when the ball hits the ground.
- **[memberCount=1]** `define height function -> identify vertex formula -> substitute values -> simplify quotient -> approximate decimal -> substitute values -> square term -> multiply -> add constants -> subtract constants -> approximate decimal -> set equation to zero -> multiply by constant -> apply quadratic formula -> square term -> multiply constants -> add constants -> calculate square root -> add terms -> divide by coefficient -> approximate decimal`
  - canonicalStem: Example 1.102. A rock is thrown upward from a cli  that is 50 meters high, with an
initial velocity of 15 m/s. Find: (a) The height function. (b) The maximum height
reached above ground. (c) The time when the rock reaches its maximum height. (d) The
time when the rock hits the ground below the cli .
- **[memberCount=1]** `define height function -> calculate vertex -> evaluate function -> set equation to zero -> multiply by constant -> apply quadratic formula -> calculate square root -> calculate final times`
  - canonicalStem: Example 1.103. An arrow is shot straight upward from a height of 2 meters with an
initial velocity of 30 m/s. Find: (a) The height function. (b) The time to reach maximum
height. (c) The maximum height. (d) The total time the arrow is in the air.
- **[memberCount=1]** `define height function -> calculate vertex -> evaluate function -> set equation to constant -> rearrange equation -> multiply by constant -> apply quadratic formula -> calculate square root -> calculate final times`
  - canonicalStem: Example 1.104. A water balloon is launched upward from a platform 10 meters high
with an initial velocity of 12 m/s. Find: (a) The height function. (b) The time when the
balloon reaches its peak. (c) The peak height. (d) When does the balloon pass the height
of 15 meters on the way up and on the way down?
- **[memberCount=1]** `define population function -> evaluate function -> calculate doubling time -> set equation to constant -> divide by constant -> apply natural logarithm -> divide by constant`
  - canonicalStem: Example 1.105. A bacterial culture starts with 100 bacteria and grows at a rate of
k = 0.3 per hour. Find: (a) The population function. (b) The population after 5 hours.
(c) The doubling time. (d) The time when the population reaches 10,000.
- **[memberCount=1]** `substitute values -> divide by constant -> apply natural logarithm -> divide by constant -> define population function -> evaluate function -> calculate doubling time`
  - canonicalStem: Example 1.106. A population of 500 rabbits grows exponentially. After 3 years, the
population is 800. Find: (a) The growth rate k. (b) The population function. (c) The
population after 6 years. (d) The doubling time.
- **[memberCount=1]** `convert units -> rearrange equation -> define population function -> evaluate function -> set equation to constant -> divide by constant -> apply natural logarithm -> divide by constant`
  - canonicalStem: Example 1.107. A certain strain of bacteria doubles every 45 minutes. Find: (a) The
growth rate k (in hours). (b) The population function if initial population is 200. (c) The
population after 3 hours. (d) The time to reach 10,000 bacteria.
- **[memberCount=1]** `substitute values -> divide by constant -> apply natural logarithm -> evaluate logarithm -> solve for variable -> define function -> evaluate function -> set equation -> divide by constant -> apply natural logarithm -> solve for variable`
  - canonicalStem: Example 1.108. A mold culture starts with 50 spores and grows to 200 spores in 2 hours.
Find: (a) The growth rate k. (b) The population function. (c) The population after 5
hours. (d) The time to reach 5000 spores.
- **[memberCount=1]** `solve for variable -> evaluate constant -> define function -> evaluate function -> set equation -> divide by constant -> apply natural logarithm -> solve for variable`
  - canonicalStem: Example 1.109. A sample of radioactive material has a half-life of 100 years. Initial
amount is 500 grams. Find: (a) The decay constant λ. (b) The decay function. (c) The
amount remaining after 200 years. (d) The time when only 50 grams remain.
- **[memberCount=1]** `solve for variable -> evaluate constant -> substitute values -> divide by constant -> apply natural logarithm -> apply log properties -> solve for variable -> multiply by constant`
  - canonicalStem: Example 1.110. Carbon-14 has a half-life of 5730 years. A fossil contains 25% of its
original Carbon-14. Find the age of the fossil.
- **[memberCount=1]** `evaluate half-life -> evaluate function -> set equation -> divide by constant -> apply natural logarithm -> solve for variable -> set equation -> divide by constant -> apply natural logarithm -> solve for variable`
  - canonicalStem: Example 1.111. A radioactive isotope has a decay constant λ = 0.02 per year. Initial
amount is 1000 grams. Find: (a) The half-life. (b) The amount after 50 years. (c) The
time when 100 grams remain. (d) The time when 1 gram remains.
- **[memberCount=1]** `substitute values -> divide by constant -> apply natural logarithm -> solve for variable -> evaluate half-life -> evaluate function -> set equation -> divide by constant -> apply natural logarithm -> solve for variable`
  - canonicalStem: Example 1.112. A sample originally contains 200 mg of a radioactive substance. After
80 years, only 50 mg remains. Find: (a) The decay constant λ. (b) The half-life. (c)
The amount after 120 years. (d) The time when 10 mg remains.
- **[memberCount=1]** `substitute values -> simplify coefficient -> substitute variable -> simplify product -> convert to degrees -> apply trigonometric identity -> evaluate sine -> multiply constants`
  - canonicalStem: Example 1.113. A standard US household outlet supplies 120 V RMS (root mean square)
at 60 Hz. The peak voltage is V0 = 120√2 ≈ 169.7 V. Find: (a) The voltage function.
(b) The voltage at t = 0.005 seconds. (c) The period. (d) The frequency in radians per
second (ω).
- **[memberCount=1]** `substitute values -> simplify product -> substitute variable -> simplify product -> evaluate sine -> multiply constants -> set equation -> isolate sine -> apply inverse sine -> convert to degrees -> divide by coefficient`
  - canonicalStem: Example 1.114. In a European country, AC voltage has frequency 50 Hz and peak voltage
325 V. Find: (a) The voltage function. (b) The voltage at t = 0.01 seconds. (c) The
period. (d) The time when the voltage  rst reaches 300 V.
- **[memberCount=1]** `identify peak amplitude -> equate angular frequency -> divide by coefficient -> calculate reciprocal -> substitute variable -> simplify product -> convert to degrees -> evaluate sine -> multiply constants`
  - canonicalStem: Example 1.115. Given V (t) = 100 sin(200πt),  nd: (a) The peak voltage. (b) The
frequency f . (c) The period. (d) The voltage at t = 0.0025 seconds.
- **[memberCount=1]** `equate angular frequency -> divide by coefficient -> calculate reciprocal -> substitute variable -> simplify product -> evaluate sine -> multiply constants -> set equation -> isolate sine -> apply inverse sine -> divide by coefficient`
  - canonicalStem: Example 1.116. An AC voltage is given by V (t) = 150 sin(60πt). Find: (a) The fre-
quency and period. (b) The voltage at t = 0.00833 seconds. (c) The  rst two times when
V (t) = 75 V. (d) The root mean square voltage (RMS = V0/√2).
- **[memberCount=1]** `substitute constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply by coefficient -> substitute variable -> evaluate exponents -> subtract terms -> multiply by coefficient -> evaluate limits`
  - canonicalStem: Example 1.117. A drug is administered orally. The absorption rate is ka = 2 per hour
and the elimination rate is ke = 0.5 per hour. C0 = 10 mg/L. Find: (a) The concentration
function. (b) The concentration at t = 1 hour. (c) The concentration at t = 2 hours. (d)
What happens to the concentration as t becomes very large?
- **[memberCount=1]** `define function -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants`
  - canonicalStem: Example 1.118. For a certain drug, ka = 1.5 per hour, ke = 0.3 per hour, and the peak
concentration occurs at t = ln(ka/ke) ka−ke = ln(1.5/0.3) 1.2 = ln 5 1.2 ≈ 1.6094 1.2 ≈ 1.34 hours. If C0 = 8
mg/L,  nd: (a) The concentration function. (b) The concentration at peak time. (c) The
concentration at t = 3 hours.
- **[memberCount=1]** `substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> assign variables -> substitute variable -> evaluate logarithm -> divide constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants`
  - canonicalStem: Example 1.119. A patient takes a medication. The concentration function is C(t) =
5(e−0.2t − e−1.0t). Find: (a) The concentration at t = 2 hours. (b) The concentration at
t = 5 hours. (c) The time when concentration is maximum (given by tmax = ln(ka/ke) ka−ke ).
(d) The maximum concentration.
- **[memberCount=1]** `define function -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate logarithm -> divide constants`
  - canonicalStem: Example 1.120. For a drug with ka = 2.5 per hour, ke = 0.4 per hour, and C0 = 12
mg/L,  nd: (a) The concentration function. (b) The concentration at t = 0.5 hours. (c)
The concentration at t = 4 hours. (d) The peak time and peak concentration.
- **[memberCount=1]** `define function -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate logarithm -> divide constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants`
  - canonicalStem: hour, and C0 = 12
mg/L,  nd: (a) The concentration function. (b) The concentration at t = 0.5 hours. (c)
The concentration at t = 4 hours. (d) The peak time and peak concentration.
- **[memberCount=1]** `state definition -> simplify expression -> factor expression -> set inequality -> isolate term -> assign delta -> substitute delta -> simplify expression`
  - canonicalStem: Example 2.2. Use the epsilon-delta de nition to prove that limx→2(3x + 1) = 7.
- **[memberCount=1]** `state definition -> simplify expression -> isolate term -> assign delta -> verify inequality`
  - canonicalStem: Example 2.3. Prove that limx→1(2x + 3) = 5 using the epsilon-delta de nition.
- **[memberCount=1]** `state definition -> factor expression -> bound term -> assign delta -> verify inequality`
  - canonicalStem: Example 2.4. Prove that limx→3 x2 = 9 using the epsilon-delta de nition.
- **[memberCount=1]** `state definition -> multiply by conjugate -> apply inequality -> isolate term -> assign delta -> verify inequality`
  - canonicalStem: Example 2.5. Prove that limx→4
√x = 2 using the epsilon-delta de nition.
- **[memberCount=1]** `substitute value`
  - canonicalStem: Example 2.7. Find limx→2(3x + 1).
- **[memberCount=1]** `factor numerator -> cancel common factors -> substitute value`
  - canonicalStem: Example 2.8. Find limx→2 x2−4
x−2 .
- **[memberCount=1]** `define absolute value -> simplify fraction -> evaluate limit -> define absolute value -> simplify fraction -> evaluate limit -> compare limits`
  - canonicalStem: Example 2.13. Find limx→0 |x|
x .
- **[memberCount=1]** `evaluate one-sided limits -> conclude limit`
  - canonicalStem: Example 2.15. Find limx→0 1
x2 using one-sided limits.
- **[memberCount=1]** `apply limit laws -> evaluate terms -> calculate sum`
  - canonicalStem: Example 2.17. Find limx→2(x2 − 3x + 5).
- **[memberCount=1]** `evaluate limit of denominator -> evaluate limit of numerator -> evaluate limit of denominator -> analyze growth behavior -> evaluate right-hand limit -> evaluate left-hand limit`
  - canonicalStem: Example 2.18. Find limx→1 x2+2
x−1 if it exists.
- **[memberCount=1]** `evaluate individual limits -> apply product law`
  - canonicalStem: Example 2.19. Find limx→4
√x · (x + 2).
- **[memberCount=1]** `apply limit laws -> apply product law`
  - canonicalStem: Find limx→4
√x · (x + 2).
- **[memberCount=1]** `multiply by constant -> substitute u -> apply limit laws`
  - canonicalStem: Example 2.21. Find limx→0 sin 3x
x .
- **[memberCount=1]** `expand trigonometric identity -> apply product law`
  - canonicalStem: Example 2.22. Find limx→0 tan x
x .
- **[memberCount=1]** `apply trigonometric identity -> algebraic simplification -> substitute value -> apply limit laws`
  - canonicalStem: Example 2.23. Find limx→0 1−cos x
x2 .
- **[memberCount=1]** `multiply by constant -> substitute value -> apply limit laws -> evaluate standard limit -> multiply by constant`
  - canonicalStem: Example 2.24. Find limx→0 e2x−1
x .
- **[memberCount=1]** `factor x squared from radical -> simplify fraction -> evaluate limit`
  - canonicalStem: Example 2.30. Find lim
x→∞
√4x2 + 1
x .
- **[memberCount=1]** `multiply by conjugate -> simplify numerator -> divide numerator and denominator by x -> evaluate limit`
  - canonicalStem: Example 2.31. Find lim
x→∞(√x2 + 3x − x).
- **[memberCount=1]** `factor x squared from radical -> substitute absolute value definition -> simplify fraction -> evaluate limit`
  - canonicalStem: Example 2.32. Find lim
x→−∞
√4x2 + 1
x .
- **[memberCount=1]** `factor x from radical -> divide numerator and denominator by x -> evaluate limit`
  - canonicalStem: Example 2.33. Find lim
x→∞
√9x2 + 2x
2x + 1 .
- **[memberCount=1]** `bound sine function -> multiply inequality by x squared -> apply squeeze theorem`
  - canonicalStem: Example 2.35. Find lim
x→0 x2 sin
  1
x
  .
- **[memberCount=1]** `apply squeeze theorem -> evaluate limit`
  - canonicalStem: Example 2.36. Find lim
x→0 x cos
  1
x2
  .
- **[memberCount=1]** `apply limit laws -> evaluate limit -> interpret result`
  - canonicalStem: Example 2.37 (Business: Average Cost as Production Increases). A company's total
cost function is C(x) = 5000 + 30x where x is the number of units produced. The average
cost function is A(x) = C(x)
x = 5000
x + 30. Find limx→∞ A(x) and interpret the result.
- **[memberCount=1]** `substitute value -> expand polynomial -> combine like terms -> evaluate function -> subtract -> divide by variable -> apply limit -> interpret result`
  - canonicalStem: Example 2.38 (Business: Marginal Cost as Limit of Average Rate of Change). The
marginal cost is de ned as M C(x) = limh→0 C(x+h)−C(x)
h . For a cost function C(x) =
1000 + 20x + 0.1x2,  nd the marginal cost at x = 100.
- **[memberCount=1]** `evaluate limit -> interpret result`
  - canonicalStem: Example 2.39 (Accounting: Present Value with Continuous Compounding). The present
value of a future payment P received after t years with continuous compounding at annual
interest rate r is P V = P e−rt. As the time until payment approaches 0, what happens to
the present value?
- **[memberCount=1]** `evaluate function -> expand polynomial -> subtract -> divide by variable -> apply limit -> interpret result`
  - canonicalStem: Example 2.40 (Business: Revenue from Very Small Price Change). A company's revenue
function is R(p) = 1000p − 50p2 where p is the price per unit. The average rate of change
of revenue as price changes from p = 10 to p = 10 + h is R(10+h)−R(10)
h . Find the limit as
h → 0.
- **[memberCount=1]** `rewrite expression -> evaluate limit`
  - canonicalStem: Example 2.41. Find lim
x→0
sin2 x
x2 .
- **[memberCount=1]** `factor polynomial -> cancel common factors -> evaluate limit`
  - canonicalStem: Example 2.42. Find lim
x→2
x2 − 4
x2 − 3x + 2.
- **[memberCount=1]** `divide by x4 -> evaluate limit`
  - canonicalStem: Find lim x→∞ 4x3 − 2x 5x4 + 3 .
- **[memberCount=1]** `divide by x -> evaluate limit`
  - canonicalStem: Find lim x→∞ x2 + 1 x + 1 .
- **[memberCount=1]** `divide by x -> simplify exponent -> evaluate limit -> sum terms`
  - canonicalStem: A manufacturing company has a cost function C(x) = 100x0.8 + 5000 for producing x units. Find the average cost function and its limit as production increases inde nitely.
- **[memberCount=1]** `substitute value -> simplify exponent -> evaluate exponential -> multiply constants`
  - canonicalStem: An investment of $1000 earns interest at an annual rate of 5% compounded n times per year. The amount after t years is An(t) = 1000 1 + 0.05 n nt. As n → ∞, we get continuous compounding: A(t) = limn→∞ An(t) = 1000e0.05t. Find the amount after 10 years with continuous compounding.
- **[memberCount=1]** `substitute value -> substitute value -> expand polynomial -> distribute constant -> combine like terms -> subtract functions -> divide by variable -> apply limit`
  - canonicalStem: A company's revenue function is R(q) = 500q − 2q2. Use the limit de nition of the derivative to  nd the marginal revenue at q = 50.
- **[memberCount=1]** `evaluate limit -> multiply constants`
  - canonicalStem: A piece of equipment is purchased for $50,000 and its value after t years is given by V (t) = 50000e−0.1t. As the equipment ages inde nitely, what value does it approach?
- **[memberCount=1]** `evaluate denominator -> identify discontinuity`
  - canonicalStem: Is f (x) = 1 x−3 continuous at x = 3?
- **[memberCount=1]** `factor expression -> cancel terms -> identify undefined point`
  - canonicalStem: Where is f (x) = x2−4 x−2 discontinuous?
- **[memberCount=1]** `define function -> evaluate function -> apply intermediate value theorem`
  - canonicalStem: Show that the equation x3 − 2x − 5 = 0 has a root between 2 and 3.
- **[memberCount=1]** `evaluate function -> apply intermediate value theorem`
  - canonicalStem: Show that f (x) = cos x − x has a root in (0, 1).
- **[memberCount=1]** `evaluate function -> evaluate function -> apply intermediate value theorem`
  - canonicalStem: A company's pro t function is π(q) = −0.01q2 + 10q − 500 for q ≥ 0. Show that there is a production level between 50 and 100 units where pro t is exactly $200.
- **[memberCount=1]** `substitute function -> combine like terms -> evaluate at endpoints -> apply intermediate value theorem`
  - canonicalStem: A company's revenue function is R(q) = 80q and cost function is C(q) = 5000 + 30q. Show that there is a break-even point between 0 and 200 units.
- **[memberCount=1]** `expand binomial -> combine like terms -> factor variable -> cancel terms -> evaluate limit`
  - canonicalStem: Find f ′(2) for f (x) = x2.
- **[memberCount=1]** `multiply by conjugate -> expand numerator -> cancel terms -> simplify fraction -> evaluate limit`
  - canonicalStem: Find f ′(x) for f (x) = √x.
- **[memberCount=1]** `substitute values -> expand binomial -> distribute constant -> combine like terms -> cancel terms -> factor variable -> cancel terms -> evaluate limit`
  - canonicalStem: Find f ′(3) for f (x) = 2x2 − 3x + 1 using the limit de nition.
- **[memberCount=1]** `expand numerator -> cancel terms -> simplify fraction -> evaluate limit`
  - canonicalStem: Find f ′(x) for f (x) = √x.
- **[memberCount=1]** `substitute function -> expand binomial -> distribute constant -> combine like terms -> cancel terms -> divide by variable -> evaluate limit`
  - canonicalStem: Find f ′(3) for f (x) = 2x2 − 3x + 1 using the limit de nition.
- **[memberCount=1]** `find common denominator -> simplify numerator -> cancel terms -> evaluate limit`
  - canonicalStem: Find f ′(x) for f (x) = 1 x using the limit de nition.
- **[memberCount=1]** `expand binomial -> combine like terms -> divide by variable -> evaluate limit`
  - canonicalStem: Find f ′(x) for f (x) = x3 using the limit de nition.
- **[memberCount=1]** `evaluate function -> apply power rule -> evaluate derivative -> apply point-slope form -> rearrange equation -> calculate negative reciprocal -> apply point-slope form -> rearrange equation`
  - canonicalStem: Find the equations of the tangent and normal lines to f (x) = x2 at x = 3.
- **[memberCount=1]** `evaluate function -> apply power rule -> evaluate derivative -> apply point-slope form -> rearrange equation`
  - canonicalStem: Find the equation of the tangent line to f (x) = √x at x = 4.
- **[memberCount=1]** `evaluate function -> apply power rule -> evaluate derivative -> calculate negative reciprocal -> apply point-slope form -> simplify equation`
  - canonicalStem: Find the equation of the normal line to f (x) = x3 − 2x at x = 1.
- **[memberCount=1]** `identify slope -> apply power rule -> equate derivative to slope -> solve for x -> evaluate function`
  - canonicalStem: Find the point on f (x) = x2 where the tangent line is parallel to the line y = 4x − 3.
- **[memberCount=1]** `identify slope -> equate normal slope formula -> solve for derivative -> apply power rule -> solve for x -> evaluate function`
  - canonicalStem: Find the point on f (x) = x3 where the normal line is parallel to the line y = −1 3 x + 2.
- **[memberCount=1]** `rewrite with negative exponent -> apply power rule -> rewrite with positive exponent`
  - canonicalStem: Find d dx ( 1 x3 ) using the power rule.
- **[memberCount=1]** `rewrite as fractional exponent -> apply power rule -> rewrite with radical`
  - canonicalStem: Find d dx (√x) using the power rule.
- **[memberCount=1]** `apply power rule -> rewrite with positive exponent`
  - canonicalStem: Find d dx (x−2).
- **[memberCount=1]** `calculate derivatives -> apply product rule -> simplify expression`
  - canonicalStem: Find y′ for y = x2 sin x.
- **[memberCount=1]** `calculate derivatives -> apply product rule -> factor common term`
  - canonicalStem: Find y′ for y = ex cos x.
- **[memberCount=1]** `assign functions -> apply power rule -> apply product rule -> distribute terms -> combine like terms`
  - canonicalStem: Find y′ for y = (2x + 1)(3x2 − 4).
- **[memberCount=1]** `assign functions -> apply power rule -> apply natural log derivative -> apply product rule -> simplify`
  - canonicalStem: Find y′ for y = x ln x.
- **[memberCount=1]** `assign functions -> apply power rule -> apply exponential derivative -> apply product rule -> factor exponential -> factor polynomial`
  - canonicalStem: Find y′ for y = x2ex.
- **[memberCount=1]** `assign functions -> apply power rule -> apply quotient rule -> expand numerator -> combine like terms`
  - canonicalStem: Find y′ for y = x2+1 x−2 .
- **[memberCount=1]** `assign functions -> apply trigonometric derivative rule -> apply power rule -> apply quotient rule -> rearrange terms`
  - canonicalStem: Find y′ for y = sin x x .
- **[memberCount=1]** `identify components -> calculate derivatives -> apply quotient rule -> simplify expression`
  - canonicalStem: Find y′ for y = ln x x .
- **[memberCount=1]** `substitute u -> apply chain rule -> differentiate inner function -> multiply`
  - canonicalStem: Find y′ for y = (3x2 + 1)5.
- **[memberCount=1]** `substitute u -> apply chain rule -> differentiate inner function`
  - canonicalStem: Find y′ for y = sin(2x).
- **[memberCount=1]** `rewrite expression -> substitute u -> apply chain rule -> apply trigonometric identity`
  - canonicalStem: Find y′ for y = cos2 x.
- **[memberCount=1]** `apply product rule -> apply chain rule -> factor common term`
  - canonicalStem: Find y′ for y = e2x sin(3x).
- **[memberCount=1]** `apply chain rule -> simplify trigonometric expression`
  - canonicalStem: Find y′ for y = ln(sin x).
- **[memberCount=1]** `apply chain rule -> multiply`
  - canonicalStem: Find y′ for y = tan(ex).
- **[memberCount=1]** `apply chain rule -> rearrange terms`
  - canonicalStem: Find y′ for y = esin x.
- **[memberCount=1]** `rewrite as power -> apply chain rule -> simplify expression`
  - canonicalStem: Find y′ for y = √ln x.
- **[memberCount=1]** `differentiate numerator -> differentiate denominator -> evaluate limit -> substitute value`
  - canonicalStem: Find limx→0 sin x x using L'Hôpital's Rule.
- **[memberCount=1]** `differentiate numerator -> differentiate denominator -> substitute value`
  - canonicalStem: Find limx→0 ex−1 x .
- **[memberCount=1]** `identify indeterminate form -> differentiate numerator -> differentiate denominator -> evaluate limit`
  - canonicalStem: Example 3.38. Find limx→0 sin x
x using L'Hôpital's Rule.
- **[memberCount=1]** `identify indeterminate form -> apply L'Hôpital's rule -> differentiate numerator -> differentiate denominator -> evaluate limit`
  - canonicalStem: Example 3.39. Find limx→0 ex−1
x .
- **[memberCount=1]** `identify indeterminate form -> apply L'Hôpital's rule -> identify indeterminate form -> apply L'Hôpital's rule -> evaluate limit`
  - canonicalStem: Example 3.41. Find limx→0 1−cos x
x2 .
- **[memberCount=1]** `rewrite fraction -> apply L'Hôpital's rule -> simplify fraction -> evaluate limit`
  - canonicalStem: Example 3.42. Find limx→0+ x ln x.
- **[memberCount=1]** `apply implicit differentiation -> isolate derivative`
  - canonicalStem: Example 3.43. Find dy
dx for x2 + y2 = 25.
- **[memberCount=1]** `apply implicit differentiation -> collect derivative terms -> factor derivative -> divide by coefficient -> simplify fraction`
  - canonicalStem: Example 3.44. Find dy
dx for x3 + y3 = 6xy.
- **[memberCount=1]** `apply chain rule -> apply power rule -> equate derivatives -> distribute terms -> collect derivative terms -> factor derivative -> divide by coefficient`
  - canonicalStem: Example 3.45. Find dy
dx for exy = x2 + y2.
- **[memberCount=1]** `apply logarithm property -> apply implicit differentiation -> collect derivative terms -> factor derivative -> divide by coefficient -> multiply by reciprocal`
  - canonicalStem: Example 3.46. Find dy
dx for ln(xy) = x + y.
- **[memberCount=1]** `apply implicit differentiation -> collect derivative terms -> factor derivative -> isolate derivative -> substitute point coordinates -> arithmetic evaluation`
  - canonicalStem: Example 3.47. Find the slope of the tangent line to x2 + xy + y2 = 7 at the point (2, 1).
- **[memberCount=1]** `apply power rule -> apply power rule`
  - canonicalStem: Example 3.48. For f (x) = x4 − 3x2,  nd f ′(x) and f ′′(x).
- **[memberCount=1]** `apply trigonometric derivative rule -> apply trigonometric derivative rule -> apply trigonometric derivative rule -> apply trigonometric derivative rule`
  - canonicalStem: Example 3.49. For f (x) = sin x,  nd the  rst four derivatives.
- **[memberCount=1]** `apply chain rule -> apply chain rule -> apply chain rule -> generalize pattern`
  - canonicalStem: Example 3.50. For f (x) = e2x,  nd f ′′(x) and f ′′′(x).
- **[memberCount=1]** `apply reciprocal rule -> rewrite using negative exponent -> apply power rule -> rewrite using negative exponent -> apply power rule -> rewrite using negative exponent`
  - canonicalStem: Example 3.51. For f (x) = ln x,  nd f ′′(x) and f ′′′(x).
- **[memberCount=1]** `apply power rule -> apply power rule -> substitute value -> evaluate expression`
  - canonicalStem: Example 3.52. For f (x) = x5 − 2x3 + 4x,  nd f ′′(x) and evaluate f ′′(2).
- **[memberCount=1]** `apply power rule -> apply power rule -> substitute value -> substitute value`
  - canonicalStem: Example 3.53. A ball is thrown upward with position s(t) = −4.9t2 + 20t + 1. Find the
velocity and acceleration at t = 2 seconds.
- **[memberCount=1]** `apply power rule -> factor constant -> factor quadratic -> apply zero product property`
  - canonicalStem: Example 3.54. A particle moves along a line with position s(t) = t3 − 6t2 + 9t + 2. Find
when the particle is at rest.
- **[memberCount=1]** `apply power rule -> substitute value -> evaluate expression`
  - canonicalStem: Example 3.55. For the particle in the previous example,  nd the acceleration at t = 2.
- **[memberCount=1]** `set equation to zero -> isolate variable -> calculate square root -> apply power rule -> substitute value`
  - canonicalStem: Example 3.56. A falling object has position s(t) = 100 − 4.9t2. Find the velocity when
it hits the ground.
- **[memberCount=1]** `integrate expression -> substitute initial condition -> solve for constant`
  - canonicalStem: Example 3.59. A company  nds that the marginal cost is M C(q) = 50 − 0.2q. If  xed
costs are $2000,  nd the total cost function.
- **[memberCount=1]** `apply power rule -> simplify expression -> substitute value -> evaluate expression`
  - canonicalStem: Example 3.61. For C(q) = 8000 + 25q + 0.5√q,  nd C′(100).
- **[memberCount=1]** `apply power rule -> evaluate function`
  - canonicalStem: Example 3.62. A company's revenue is R(q) = 50q − 0.1q2. Find the marginal revenue
at q = 200.
- **[memberCount=1]** `substitute expression -> distribute variable -> apply power rule`
  - canonicalStem: Example 3.63. If demand is p = 100 − 0.5q,  nd the marginal revenue function.
- **[memberCount=1]** `apply power rule -> set to zero -> solve for variable`
  - canonicalStem: Example 3.64. For R(q) = 200q − 0.2q2,  nd the quantity that makes marginal revenue
zero.
- **[memberCount=1]** `define function -> apply power rule`
  - canonicalStem: Example 3.65. A company sells its product at a constant price of $75. Find the marginal
revenue.
- **[memberCount=1]** `integrate expression -> evaluate constant -> substitute constant`
  - canonicalStem: Example 3.66. If marginal revenue is M R(q) = 80 − 0.4q and  xed costs are $5000,
 nd the revenue function.
- **[memberCount=1]** `subtract polynomials -> combine like terms -> apply power rule -> set equation to zero -> isolate variable -> apply power rule -> evaluate inequality -> round result`
  - canonicalStem: Example 3.67. Given R(q) = 100q − 0.5q2 and C(q) = 5000 + 20q + 0.1q2,  nd the
pro t-maximizing quantity.
- **[memberCount=1]** `subtract polynomials -> combine like terms -> apply power rule -> set equation to zero -> isolate variable -> substitute value -> evaluate power -> perform multiplication -> perform addition and subtraction`
  - canonicalStem: Example 3.68. For R(q) = 120q and C(q) = 3000 + 40q + 0.2q2,  nd the pro t-
maximizing quantity and maximum pro t.
- **[memberCount=1]** `apply power rule -> set equation to zero -> isolate variable -> apply power rule -> evaluate inequality -> substitute value -> evaluate power -> perform multiplication -> perform subtraction`
  - canonicalStem: Example 3.69. A company's pro t function is π(q) = 400q − 2q2 − 10000. Find the
quantity that maximizes pro t.
- **[memberCount=1]** `apply power rule -> set equation to zero -> isolate variable -> substitute value -> evaluate power -> perform multiplication -> perform addition and subtraction`
  - canonicalStem: Example 3.70. If π(q) = −0.01q2 + 10q − 500,  nd the maximum pro t.
- **[memberCount=1]** `subtract polynomials`
  - canonicalStem: Example 3.71. A  rm has R(q) = 80q and C(q) = 2000 + 30q + 0.05q2. Find the
break-even points and the pro t-maximizing quantity.
- **[memberCount=1]** `compute derivative -> set to zero -> solve for q -> compute second derivative -> evaluate function`
  - canonicalStem: Example 3.69. A company's pro t function is π(q) = 400q − 2q2 − 10000. Find the
quantity that maximizes pro t.
- **[memberCount=1]** `compute derivative -> set to zero -> solve for q -> evaluate function`
  - canonicalStem: Example 3.70. If π(q) = −0.01q2 + 10q − 500,  nd the maximum pro t.
- **[memberCount=1]** `subtract functions -> simplify expression -> compute derivative -> set to zero -> solve for q -> set to zero -> multiply equation -> reorder terms -> apply quadratic formula -> simplify radical -> calculate values`
  - canonicalStem: Example 3.71. A  rm has R(q) = 80q and C(q) = 2000 + 30q + 0.05q2. Find the
break-even points and the pro t-maximizing quantity.
- **[memberCount=1]** `apply chain rule -> simplify coefficients -> substitute value -> evaluate exponential -> perform multiplication`
  - canonicalStem: Example 3.72. A car's value is V (t) = 25000e−0.15t. Find the depreciation rate at t = 3
years.
- **[memberCount=1]** `calculate slope -> construct linear equation -> compute derivative`
  - canonicalStem: Example 3.73. Equipment depreciates linearly from $50,000 to $5,000 over 10 years.
Find the depreciation function and rate.
- **[memberCount=1]** `rewrite base -> apply chain rule -> calculate logarithm -> substitute value -> evaluate expression`
  - canonicalStem: Example 3.74. A machine's value is V (t) = 20000(0.8)t. Find the rate of depreciation
at t = 2.
- **[memberCount=1]** `apply chain rule -> calculate logarithm -> substitute value -> evaluate power -> perform multiplication`
  - canonicalStem: Example 3.75. A building depreciates using the declining balance method: V (t) =
100000(0.85)t. Find the depreciation rate at t = 5.
- **[memberCount=1]** `define function -> substitute value -> simplify fraction -> multiply constants`
  - canonicalStem: Example 3.76. A company uses sum-of-years-digits depreciation for a $60,000 asset
with 5-year life. The depreciation in year t is D(t) = 2(5−t+1)
5·6 × 60000. Find the rate of
change of book value at t = 2.
- **[memberCount=1]** `apply chain rule -> simplify constant -> substitute value -> evaluate exponential -> perform multiplication`
  - canonicalStem: Example 3.77. A bacteria population grows as P (t) = 500e0.3t. Find the growth rate at
t = 5 hours.
- **[memberCount=1]** `apply chain rule -> simplify expression -> evaluate exponential -> evaluate denominator -> evaluate square -> evaluate numerator -> calculate quotient`
  - canonicalStem: Example 3.78. A population of deer is modeled by P (t) = 10000
1+9e−0.2t . Find the growth
rate at t = 10 years.
- **[memberCount=1]** `apply power rule -> substitute value`
  - canonicalStem: Example 3.79. A culture of yeast grows according to P (t) = 2000 + 100t2. Find the
instantaneous growth rate at t = 4 hours.
- **[memberCount=1]** `apply chain rule -> simplify constant -> substitute value -> evaluate exponential -> multiply constants`
  - canonicalStem: Example 3.80. The population of a city is P (t) = 250000e0.02t. Find the growth rate at
t = 10 years.
- **[memberCount=1]** `set constant -> equate expression -> isolate term -> isolate exponential -> apply natural logarithm -> define function -> apply chain rule -> substitute value -> evaluate denominator -> evaluate numerator -> calculate quotient`
  - canonicalStem: Example 3.81. A  sh population follows logistic growth: P (t) = 10000
1+4e−0.1t . Find the
maximum growth rate.
- **[memberCount=1]** `compute derivative -> substitute value -> evaluate denominator -> multiply constants -> calculate quotient -> compare magnitude`
  - canonicalStem: Example 3.82. For demand function D(p) = 100 − 2p,  nd the elasticity at p = 30.
- **[memberCount=1]** `compute derivative -> evaluate function -> substitute values -> multiply constants -> calculate quotient -> classify result`
  - canonicalStem: Example 3.83. For D(p) = 200 − 5p,  nd the elasticity at p = 20.
- **[memberCount=1]** `apply chain rule -> simplify coefficient -> substitute expression -> cancel terms -> simplify fraction`
  - canonicalStem: Example 3.84. For D(p) = 500e−0.1p,  nd the elasticity.
- **[memberCount=1]** `rewrite exponent -> apply power rule -> substitute expression -> substitute expression -> multiply fractions -> simplify exponents`
  - canonicalStem: Example 3.85. For D(p) = 1000
p ,  nd the elasticity.
- **[memberCount=1]** `distribute p -> apply power rule -> set derivative to zero -> solve linear equation -> evaluate function -> differentiate polynomial -> substitute expression -> simplify fraction`
  - canonicalStem: Example 3.86. A product has demand D(p) = 300 − 3p. Find the price that maximizes
revenue.
- **[memberCount=1]** `apply power rule -> apply power rule -> evaluate at point -> evaluate at point`
  - canonicalStem: Example 3.87. For s(t) = t3 − 6t2 + 9t,  nd velocity and acceleration at t = 2.
- **[memberCount=1]** `apply product rule -> factor exponential -> apply product rule -> distribute negative -> combine like terms`
  - canonicalStem: Example 3.88. If x(t) = e−t sin t,  nd x′′(t).
- **[memberCount=1]** `apply power rule -> apply power rule -> factor constant -> factor quadratic -> solve equation`
  - canonicalStem: Example 3.91. The position of a particle is s(t) = t4 − 4t3 + 6t2. Find when the
acceleration is zero.
- **[memberCount=1]** `apply reverse power rule`
  - canonicalStem: Example 4.2. Find R x3 dx.
- **[memberCount=1]** `apply logarithmic integration rule`
  - canonicalStem: Example 4.3. Find R 1
x dx.
- **[memberCount=1]** `apply power rule -> apply trigonometric rule -> apply logarithmic rule -> combine terms`
  - canonicalStem: Example 4.8. Find R (4x3 + 5 cos x − 1 x ) dx.
- **[memberCount=1]** `apply logarithmic rule -> apply trigonometric rule -> apply exponential rule -> combine terms`
  - canonicalStem: Example 4.10. Find R 2 x + 3 sin x − 4ex dx.
- **[memberCount=1]** `rewrite as power -> apply power rule -> rewrite as power -> apply power rule -> combine terms`
  - canonicalStem: Example 4.11. Find R √x + 1 √x dx.
- **[memberCount=1]** `substitute u -> calculate differential -> substitute u -> integrate exponential -> substitute back`
  - canonicalStem: Example 4.12. Find R 2xex2 dx.
- **[memberCount=1]** `substitute u -> calculate differential -> substitute u -> integrate sine -> substitute back`
  - canonicalStem: Example 4.13. Find R sin(ln x) x dx.
- **[memberCount=1]** `substitute u -> calculate differential -> isolate differential -> substitute u -> factor constant -> apply power rule -> simplify coefficient -> substitute back`
  - canonicalStem: Example 4.14. Find R x√x2 + 1 dx.
- **[memberCount=1]** `substitute u -> calculate differential -> isolate differential -> substitute u -> factor constant -> integrate reciprocal -> substitute back`
  - canonicalStem: Example 4.15. Find R x x2+1 dx.
- **[memberCount=1]** `substitute u -> calculate differential -> isolate differential -> substitute u -> factor constant -> integrate cosine -> substitute back`
  - canonicalStem: Example 4.16. Find R cos(3x) dx.
- **[memberCount=1]** `assign variables for integration by parts -> apply integration by parts formula -> evaluate integral -> factor expression`
  - canonicalStem: Example 4.17. Find R xex dx.
- **[memberCount=1]** `assign variables for integration by parts -> apply integration by parts formula -> simplify integrand -> evaluate integral`
  - canonicalStem: Example 4.18. Find R ln x dx.
- **[memberCount=1]** `assign variables for integration by parts -> apply integration by parts formula -> substitute known integral result -> distribute constant -> combine like terms`
  - canonicalStem: Example 4.19. Find R x2ex dx.
- **[memberCount=1]** `assign variables for integration by parts -> apply integration by parts formula -> evaluate integral`
  - canonicalStem: Example 4.20. Find R x cos x dx.
- **[memberCount=1]** `assign variables for integration by parts -> apply integration by parts formula -> assign variables for integration by parts -> apply integration by parts formula -> substitute expression -> add integral to both sides -> divide by constant`
  - canonicalStem: Example 4.21. Find R ex sin x dx.
- **[memberCount=1]** `factor denominator -> set partial fraction decomposition -> multiply by common denominator -> expand polynomial -> equate coefficients -> substitute value -> solve for constants -> integrate function`
  - canonicalStem: Example 4.22. Find R 1 x2−4 dx.
- **[memberCount=1]** `factor denominator -> cancel common factors -> integrate function`
  - canonicalStem: Example 4.23. Find R x+2 x2+3x+2 dx.
- **[memberCount=1]** `identify derivative -> substitute u -> integrate reciprocal -> substitute back`
  - canonicalStem: Example 4.24. Find R 2x+3 x2+3x+2 dx.
- **[memberCount=1]** `set partial fraction decomposition -> multiply by common denominator -> expand polynomial -> equate coefficients -> subtract equations -> solve for constants -> integrate function`
  - canonicalStem: Example 4.25. Find R 3x+5 (x+1)(x+2) dx.
- **[memberCount=1]** `factor denominator -> set partial fraction decomposition -> multiply by common denominator -> expand polynomial -> equate coefficients -> substitute value -> solve system of equations -> solve for constants -> integrate function`
  - canonicalStem: Example 4.26. Find R 2x2+3x+4 x3+x2−2x dx.
- **[memberCount=1]** `factor expression -> substitute u -> evaluate integral -> substitute back`
  - canonicalStem: Example 4.29. Find R sin3 x dx.
- **[memberCount=1]** `factor expression -> substitute u -> expand polynomial -> evaluate integral -> substitute back`
  - canonicalStem: Example 4.30. Find R sin2 x cos3 x dx.
- **[memberCount=1]** `apply trigonometric identity -> expand binomial -> apply trigonometric identity -> simplify fraction -> distribute integral -> evaluate integral -> simplify`
  - canonicalStem: Example 4.31. Find R sin4 x dx.
- **[memberCount=1]** `rewrite trigonometric function -> substitute u -> evaluate integral -> substitute back -> apply logarithmic identity`
  - canonicalStem: Example 4.32. Find R tan x dx.
- **[memberCount=1]** `multiply by conjugate -> distribute term -> substitute u -> evaluate integral -> substitute back`
  - canonicalStem: Example 4.33. Find R sec x dx.
- **[memberCount=1]** `apply trigonometric identity -> distribute integral -> evaluate integral`
  - canonicalStem: Example 4.34. Find R tan2 x dx.
- **[memberCount=1]** `apply integration by parts -> substitute identity -> distribute term -> add integral to both sides -> divide by constant`
  - canonicalStem: Example 4.35. Find R sec3 x dx.
- **[memberCount=1]** `factor expression -> substitute identity -> substitute u -> expand polynomial -> evaluate integral -> substitute back`
  - canonicalStem: Example 4.36. Find R tan3 x sec3 x dx.
- **[memberCount=1]** `substitute trigonometric function -> simplify radical -> substitute expression -> apply trigonometric identity -> apply power-reduction identity -> integrate -> apply double angle identity -> apply inverse trigonometric function -> substitute back`
  - canonicalStem: Example 4.37. Find R √1 − x2 dx.
- **[memberCount=1]** `substitute trigonometric function -> simplify radical -> substitute expression -> cancel terms -> integrate -> substitute back`
  - canonicalStem: Example 4.38. Find R 1 √4−x2 dx.
- **[memberCount=1]** `substitute trigonometric function -> substitute expression -> cancel terms -> apply trigonometric identity -> integrate -> convert trigonometric functions -> substitute back`
  - canonicalStem: Example 4.39. Find R 1 x2√4−x2 dx.
- **[memberCount=1]** `substitute trigonometric function -> apply trigonometric identity -> substitute expression -> cancel terms -> integrate -> substitute back`
  - canonicalStem: Example 4.40. Find R 1 x2+9 dx.
- **[memberCount=1]** `substitute trigonometric function -> simplify radical -> substitute expression -> apply trigonometric identity -> distribute terms -> split integral -> apply reduction formula -> apply integral formula -> substitute expression -> simplify expression -> substitute back -> simplify`
  - canonicalStem: Example 4.41. Find R √x2 − 4 dx.
- **[memberCount=1]** `apply power rule for integration -> evaluate boundaries -> simplify arithmetic`
  - canonicalStem: Example 5.4. Compute R 2 0 x3 dx.
- **[memberCount=1]** `identify logarithmic antiderivative -> evaluate boundaries -> apply logarithm property`
  - canonicalStem: Example 5.6. Compute R 4 1 1 x dx.
- **[memberCount=1]** `apply u-substitution rule -> evaluate boundaries -> factor constant`
  - canonicalStem: Example 5.7. Compute R 1 0 e2x dx.
- **[memberCount=1]** `apply power rule -> simplify coefficient -> evaluate boundaries -> apply power rule -> evaluate boundaries -> apply power rule -> evaluate boundaries -> combine terms`
  - canonicalStem: Example 5.9. Use properties to evaluate R 2 0 (3x2 − 2x + 1)dx.
- **[memberCount=1]** `apply linearity property -> substitute values -> multiply constants -> subtract constants`
  - canonicalStem: Example 5.10. If R 2 0 f (x)dx = 5 and R 2 0 g(x)dx = 3, nd R 2 0 (4f (x) − 2g(x))dx.
- **[memberCount=1]** `substitute u -> calculate differential -> isolate differential -> change lower bound -> change upper bound -> substitute variable -> factor constant -> apply fundamental theorem of calculus -> evaluate boundaries`
  - canonicalStem: Example 5.11. Compute R 1 0 xex2 dx.
- **[memberCount=1]** `substitute u -> calculate differential -> change lower bound -> change upper bound -> substitute variable -> apply power rule -> evaluate boundaries`
  - canonicalStem: Example 5.12. Compute R π/2 0 sin x cos x dx.
- **[memberCount=1]** `substitute u -> calculate differential -> isolate differential -> change lower bound -> change upper bound -> substitute variable -> factor constant -> apply natural log integral -> evaluate boundaries`
  - canonicalStem: Example 5.13. Compute R 1 0 x x2+1 dx.
- **[memberCount=1]** `substitute u -> calculate differential -> evaluate limits -> substitute variable -> evaluate integral`
  - canonicalStem: Example 5.14. Compute R π 0 sin2 x cos x dx.
- **[memberCount=1]** `substitute trigonometric function -> calculate differential -> evaluate limits -> substitute variable -> simplify integrand -> cancel terms -> evaluate integral -> apply fundamental theorem of calculus`
  - canonicalStem: Example 5.15. Compute R 2 0 dx √4−x2 .
- **[memberCount=1]** `apply limit definition -> rewrite exponent -> apply power rule -> apply fundamental theorem of calculus -> evaluate limit`
  - canonicalStem: Example 5.16. Compute R ∞ 1 1 x2 dx.
- **[memberCount=1]** `apply limit definition -> apply exponential rule -> apply fundamental theorem of calculus -> evaluate limit`
  - canonicalStem: Example 5.17. Compute R ∞ 0 e−x dx.
- **[memberCount=1]** `apply limit definition -> apply logarithmic rule -> apply fundamental theorem of calculus -> evaluate limit`
  - canonicalStem: Example 5.18. Compute R ∞ 1 1 x dx.
- **[memberCount=1]** `identify discontinuity -> rewrite as limit -> rewrite integrand -> apply power rule -> evaluate limits -> simplify`
  - canonicalStem: Example 5.19. Compute R 1 0 1 √x dx.
- **[memberCount=1]** `split integral at discontinuity -> apply power rule -> evaluate boundaries -> simplify -> evaluate limit -> state divergence`
  - canonicalStem: Example 5.20. Compute R 2 0 1 (x−1)2 dx. (This integral has a discontinuity at x = 1.)
- **[memberCount=1]** `compare functions -> set up integral -> apply power rule -> evaluate boundaries -> subtract fractions`
  - canonicalStem: Example 6.1. Find the area between y = x2 and y = x from x = 0 to x = 1.
- **[memberCount=1]** `equate functions -> solve for x -> compare functions -> set up sum of integrals -> apply trigonometric integration -> evaluate boundaries -> simplify -> apply trigonometric integration -> evaluate boundaries -> simplify -> add results`
  - canonicalStem: Example 6.2. Find the area between y = sin x and y = cos x from x = 0 to x = π/2.
- **[memberCount=1]** `equate functions -> subtract terms -> factor expression -> solve for x -> compare functions -> set up integral -> combine like terms -> apply power rule -> evaluate boundaries -> subtract fractions`
  - canonicalStem: Example 6.3. Find the area enclosed by y = x2 and y = 2x − x2.
- **[memberCount=1]** `compare functions -> set up integral -> apply power rule -> evaluate limits -> simplify arithmetic -> identify symmetry -> apply absolute value -> apply power rule -> evaluate limits -> simplify arithmetic`
  - canonicalStem: Example 6.4. Find the area between y = x3 and y = x from x = −1 to x = 1.
- **[memberCount=1]** `compare functions -> set up integral -> apply integration by parts -> evaluate limits -> simplify arithmetic`
  - canonicalStem: Example 6.5. Find the area bounded by y = ln x, y = 0, x = 1, and x = e.
- **[memberCount=1]** `set up integral -> simplify integrand -> apply power rule -> evaluate limits -> simplify arithmetic`
  - canonicalStem: Example 6.6. Find the volume of the solid obtained by rotating y = √x from x = 0 to x = 4 about the x-axis.
- **[memberCount=1]** `define rotation -> set up integral -> apply power rule -> evaluate limits -> distribute terms -> simplify arithmetic`
  - canonicalStem: Example 6.7. Find the volume of a sphere of radius R.
- **[memberCount=1]** `set up integral -> apply power-reduction identity -> factor constant -> apply integration -> evaluate limits -> simplify arithmetic`
  - canonicalStem: Example 6.8. Find the volume of the solid obtained by rotating y = sin x from x = 0 to x = π about the x-axis.
- **[memberCount=1]** `identify radii -> set up integral -> apply power rule -> evaluate limits -> simplify fraction`
  - canonicalStem: Example 6.9. Find the volume obtained by rotating the region between y = x2 and y = x from x = 0 to x = 1 about the x-axis.
- **[memberCount=1]** `equate functions -> solve for variable -> compare functions -> identify radii -> set up integral -> apply power rule -> evaluate limits -> find common denominator -> simplify fraction`
  - canonicalStem: Example 6.10. Find the volume of the solid obtained by rotating the region bounded by y = x2 and y = 2x about the x-axis.
- **[memberCount=1]** `equate functions -> solve for variable -> compare functions -> identify radii -> set up integral -> apply power rule -> evaluate limits -> simplify fraction`
  - canonicalStem: Example 6.11. Find the volume obtained by rotating the region between y = √x and y = x2 about the x-axis.
- **[memberCount=1]** `set up integral -> simplify integrand -> apply power rule -> evaluate limits -> simplify expression`
  - canonicalStem: Example 6.12. Find the volume obtained by rotating the region under y = x2 from x = 0 to x = 2 about the y-axis.
- **[memberCount=1]** `define shell variables -> set up integral -> distribute variable -> apply power rule -> evaluate limits -> find common denominator -> simplify fraction`
  - canonicalStem: Example 6.13. Find the volume obtained by rotating the region between y = x2 and y = x from x = 0 to x = 1 about the y-axis.
- **[memberCount=1]** `set up integral -> define substitution variables -> apply integration by parts -> evaluate definite integral`
  - canonicalStem: Example 6.14. Find the volume obtained by rotating the region under y = sin x from x = 0 to x = π about the y-axis.
- **[memberCount=1]** `calculate derivative -> simplify expression -> set up integral -> perform u-substitution -> change limits of integration -> evaluate power rule -> evaluate at limits`
  - canonicalStem: Example 6.15. Find the length of y = x3/2 from x = 0 to x = 4.
- **[memberCount=1]** `calculate derivative -> simplify expression -> set up integral -> apply power rule -> evaluate definite integral`
  - canonicalStem: Example 6.16. Find the length of y = 2/3 x3/2 from x = 0 to x = 3.
- **[memberCount=1]** `define function -> calculate derivative -> simplify fraction -> set up integral -> apply symmetry -> evaluate inverse trigonometric integral -> multiply`
  - canonicalStem: Example 6.17. Find the circumference of a circle of radius R using arc length.
- **[memberCount=1]** `set up integral -> apply power rule -> evaluate definite integral`
  - canonicalStem: Example 6.18. A spring obeys Hooke's law: F (x) = kx, where k is the spring constant. Find the work done to stretch the spring from its natural length x = 0 to x = L.
- **[memberCount=1]** `set up integral -> apply power rule -> evaluate boundaries -> arithmetic simplification`
  - canonicalStem: Example 6.19. If a spring has spring constant k = 100 N/m,  nd the work to stretch it from 0.1 m to 0.3 m.
- **[memberCount=1]** `solve algebraic equation -> set up integral -> apply power rule -> evaluate boundaries -> arithmetic simplification`
  - canonicalStem: Example 6.20. A force of 10 N stretches a spring 0.2 m from its natural length. Find the work to stretch it 0.5 m.
- **[memberCount=1]** `equate expressions -> solve for variable -> substitute value -> set up integral -> apply power rule -> evaluate boundaries -> arithmetic simplification -> set up integral -> apply power rule -> evaluate boundaries -> arithmetic simplification`
  - canonicalStem: Example 6.21. If demand is D(q) = 50 − 0.5q and supply is S(q) = 10 + 2q,  nd equilibrium and surpluses.
- **[memberCount=1]** `equate expressions -> solve for variable -> substitute value -> set up integral -> apply power rule -> evaluate boundaries -> arithmetic simplification`
  - canonicalStem: Example 6.22. If D(q) = 100 − 2q and S(q) = 20 + 3q,  nd equilibrium and consumer surplus.
- **[memberCount=1]** `compute derivative -> simplify expression -> set up integral -> cancel terms -> evaluate integral -> evaluate boundaries`
  - canonicalStem: Example 6.23. Find the surface area of a sphere of radius R.
- **[memberCount=1]** `calculate derivative -> simplify radical expression -> set up integral -> evaluate integral`
  - canonicalStem: Example 6.23. Find the surface area of a sphere of radius R.
- **[memberCount=1]** `calculate derivative -> simplify radical -> set up integral -> substitute value -> calculate differential -> change limits of integration -> substitute trigonometric expressions -> apply trigonometric identity -> distribute terms -> apply reduction formula -> apply reduction formula -> combine like terms -> evaluate at limits -> arithmetic simplification -> multiply by constant`
  - canonicalStem: Example 6.24. Find the surface area obtained by rotating y = x2 from x = 0 to x = 1 about the x-axis.
- **[memberCount=1]** `calculate cardinality product`
  - canonicalStem: Example 2: For the two sets A and B given above, we have that \(n(A) = 3\) and \(n(B) = 2\). So
- **[memberCount=1]** `compute cartesian product -> define subset`
  - canonicalStem: Example 4: Let \(A = \{a, b\}\), \(B = \{c, d\}\). Find some relations from A to B.
- **[memberCount=1]** `evaluate function -> verify mapping -> define sets -> compare sets`
  - canonicalStem: Example: Let \(A = \{1, 2, 3, 4, 5\}\), \(B = \{4, 7, 10, 13, 16, 19, 22\}\) and \(f: A \to B\) is defined by \(f(x) = 3x+1\)
(a) find \(f(1), f(2), f(3), f(4)\) and \(f(5)\)
(b) Show that f is a function from A to B
(c) Identify domain, co-domain and range of f.
(d) Verify whether the range is equal to codomain.
- **[memberCount=1]** `extract domain and range -> extract codomain -> compare range and codomain`
  - canonicalStem: Example 5: Let \(A = \{1, 2, 3, 4, 5\}\), \(B = \{6, 7, 8\}\). If \(f: A \to B\) is such that \(f(1) = 6, f(2) = 7, f(3) = 7, f(4) = 8, f(5) = 7\). Then we say that f is an onto function with the domain
- **[memberCount=1]** `set denominator to zero -> solve trigonometric equation -> exclude values from domain`
  - canonicalStem: What is the domain of \(f(x) = \frac{1}{1-2\cos x}\)?
- **[memberCount=1]** `identify domain -> identify domain -> intersect sets`
  - canonicalStem: Example, the domain of \(f(x) = \sqrt{x}\) is \(A = [0, \infty)\) and the domain of \(g(x) = \sqrt{2-x}\) is \(B = (-\infty, 2]\), so the domain of \(f(x)+g(x) = \sqrt{x} + \sqrt{2-x}\) is \(A \cap B = [0, 2]\).
- **[memberCount=1]** `substitute function -> simplify expression -> substitute function -> simplify expression -> substitute function -> simplify expression -> substitute function -> distribute constant -> combine like terms`
  - canonicalStem: Example: suppose \(f, g, h: \mathbb{R} \to \mathbb{R}\) are defined by \(f(x) = 4x+3\), \(g(x) = x^2-2\), \(h(x) = e^x\). Find (i) \(g \circ h\) (ii) \(f \circ h\) (iii) \(h \circ g\) (iv) \(f \circ f\)

## Step 4 — stability

**Not measured this run.** Scope was reduced to 1 stability run (see Methodology) after sizing up the full 3-run design at ~228 calls against an already-exhausted primary model — with only one run, there is nothing to compare across runs.

Singleton archetypes (memberCount=1) in this run: 299 of 325 total archetypes.

## Step 5 — hold-out test (MTH 102 TUTORIAL 2026)

36 questions extracted.

**coverageScore = 1 / 36 = 0.028**

Differentiation-related questions produced **13 distinct signature(s)** (v2 collapsed all 18 into 1 archetype).

### Unmatched questions

- Q0: "1. (a) Evaluate lim x→4 (2x^2 − 11x + 12) / (x − 4)"
  - signature: `factor numerator -> cancel common factors -> apply limit -> substitute x-value -> arithmetic evaluation`
- Q1: "1. (b) Evaluate lim x→0 (√x + 4 − 2) / x"
  - signature: `multiply by conjugate -> simplify numerator -> cancel common factors -> apply limit -> substitute x-value -> arithmetic evaluation`
- Q2: "2. Evaluate the following using limits law (a) lim x→2 (5x^3 − 3x^2 + 5x − 4)"
  - signature: `apply limit laws -> substitute x-value -> evaluate power -> arithmetic evaluation`
- Q3: "2. (b) Evaluate lim x→−1 (6x^4 + 9x^2 − 5x − 3) / (7x^2 + 4x)"
  - signature: `apply limit laws -> substitute x-value -> evaluate power -> arithmetic evaluation`
- Q4: "3. Evaluate the following (a) lim x→3 (2x^5 − 7x^3 + 5x − 6) / (7x^2 − 4x − 5)"
  - signature: `apply limit laws -> substitute x-value -> evaluate power -> arithmetic evaluation`
- Q5: "3. (b) Evaluate lim θ→π/6 (sin θ − cos 2θ) / (2 cos θ + sin 2θ)"
  - signature: `substitute x-value -> evaluate trigonometric functions -> evaluate expression -> simplify expression`
- Q6: "4. Evaluate lim x→0 (sin 7x) / (sin 3x)"
  - signature: `identify indeterminate form -> rewrite expression -> apply standard limit -> evaluate limit`
- Q7: "5. Evaluate lim x→3 (2x^2 − 5x − 3) / (x − 3)"
  - signature: `factor numerator -> cancel common factors -> simplify expression -> substitute x-value -> evaluate limit`
- Q8: "6. Given that f(x) = 8 − 2x if x > 4, √4 − x if x ≤ 4. Show whether the lim x→4 f(x) exists"
  - signature: `evaluate left-hand limit -> evaluate right-hand limit -> compare limits -> conclude limit`
- Q9: "Exercise 1: 1. Show whether lim x→0 (9|x| − 5x) / x exists."
  - signature: `evaluate right-hand limit -> evaluate left-hand limit -> compare limits -> conclude limit`
- Q11: "Exercise 1: 3. Evaluate lim x→−3 (6x^4 − x^3 + 4x^2 − 18) / (5x^2 + 3x + 9)"
  - signature: `substitute x-value -> evaluate numerator -> evaluate denominator -> calculate quotient`
- Q12: "Exercise 1: 4. Evaluate without calculator or Mathematical table lim x→3π/4 (sin x − 2 cos 1/3 x) / (2 cos x + sin 1/3 x)"
  - signature: `substitute x-value -> evaluate trigonometric functions -> simplify expression`
- Q13: "Example: Evaluate lim x→∞ (x^3 − x)"
  - signature: `analyze growth behavior -> evaluate limit`
- Q14: "Examples: Evaluate 1. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (2x^4 − 7x^3 − 2x + 6)"
  - signature: `identify leading coefficients -> compare degrees -> calculate ratio -> evaluate limit`
- Q15: "Examples: Evaluate 2. lim x→∞ (5x^2 + 2x + 9) / (3x^2 − 2x + 8)"
  - signature: `divide numerator and denominator by x -> evaluate limit -> calculate ratio`
- Q16: "Examples: Evaluate 3. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (3x^2 + 4x + 1)"
  - signature: `divide numerator and denominator by x -> evaluate limit -> analyze growth behavior`
- Q17: "Example: Evaluate lim x→∞ (√4x^4 + 6x^3 − 7x + 8) / (2x^2 + 7x + 5)"
  - signature: `factor x squared from radical -> divide numerator and denominator by x -> evaluate limit -> calculate ratio`
- Q18: "1. Find dy/dx if (a) y = x^2"
  - signature: `apply power rule`
- Q19: "1. Find dy/dx if (b) y = 3x^3 + 5"
  - signature: `differentiate polynomial`
- Q20: "1. Find dy/dx if (c) y = √2x − 7"
  - signature: `rewrite as fractional exponent -> apply chain rule -> differentiate inner function -> apply power rule -> simplify`
- Q21: "1. Find dy/dx if (d) y = sin 2x"
  - signature: `apply chain rule -> differentiate inner function -> apply trigonometric derivative rule -> simplify`
- Q22: "Exercise 2: 1. Prove that if y = x^n, then dy/dx = nx^n−1"
  - signature: `apply limit definition -> expand binomial -> subtract terms -> factor variable -> apply limit -> simplify`
- Q23: "Exercise 2: 2. Find dy/dx if y = √5x + 8"
  - signature: `rewrite as fractional exponent -> apply chain rule -> differentiate inner function -> apply power rule -> simplify`
- Q24: "Exercise 2: 3. Find dy/dx given that y = cos 13x"
  - signature: `apply chain rule -> differentiate inner function -> apply trigonometric derivative rule -> simplify`
- Q25: "Example: If y = x^5, then dy/dx = ?"
  - signature: `differentiate polynomial`
- Q26: "Example: If y = 8x^6, then dy/dx = ?"
  - signature: `differentiate polynomial`
- Q27: "Example: If y = x^4 + 5x^3 − 3x^2 + 7x − 9, find dy/dx."
  - signature: `differentiate polynomial`
- Q28: "Example: If y = x^3 sin x, find dy/dx."
  - signature: `apply product rule -> differentiate polynomial -> apply trigonometric derivative rule`
- Q29: "Example: If y = (2x^3 − 5) / (x^2 + 6), find dy/dx."
  - signature: `apply quotient rule -> differentiate polynomial -> simplify expression`
- Q30: "Example: Find dy/dx if (a) y = sin (4x^2 + 5)"
  - signature: `identify components -> apply chain rule -> differentiate inner function -> apply trigonometric derivative rule -> simplify`
- Q31: "Example: Find dy/dx if (b) y = sin^2 x"
  - signature: `rewrite as power -> apply chain rule -> apply power rule -> apply trigonometric derivative rule -> simplify`
- Q32: "Example: Find dy/dx if (c) y = e^6x^4"
  - signature: `apply exponential derivative -> differentiate inner function -> simplify`
- Q33: "Exercise 2: 1. Find dy/dx if y = e^3x^5 / cos(7x^2 − 4x)"
  - signature: `apply quotient rule -> apply exponential derivative -> differentiate inner function -> apply trigonometric derivative rule -> differentiate inner function -> simplify`
- Q34: "Exercise 2: 2. Find dy/dx if y = (5x^6 − 2x^3 + 4) / (15x^5 − 6)"
  - signature: `apply quotient rule -> differentiate polynomial -> differentiate polynomial -> simplify`
- Q35: "Exercise 2: 3. Find dy/dx if y = (4x^3 − 5)^16"
  - signature: `identify components -> apply chain rule -> differentiate inner function -> apply power rule -> simplify`

### Reference archetypes never matched by the tutorial

- `apply fundamental theorem of calculus` (canonicalStem: 4.5. Find R cos x dx.)
- `divide by highest power -> apply limit laws -> evaluate limit` (canonicalStem: Example 2.28. Find lim
x→∞
2x2 + 1
5x3 − 3x.)
- `apply power rule -> evaluate expression` (canonicalStem: Example 3.58. For C(q) = 5000 + 30q + 0.05q2,  nd the marginal cost function and)
- `remove absolute value -> subtract constant -> divide by coefficient -> express as interval` (canonicalStem: olve the inequality |2x + 1| < 7.)
- `identify degree -> identify leading coefficient` (canonicalStem: Example 1.52. Describe the end behavior of f (x) = −2x3 + 4x2 − 1.)
- `set numerator to zero -> solve for x -> evaluate denominator -> set x to zero -> evaluate expression` (canonicalStem: Example 1.63. Find the x-intercepts and y-intercept of f (x) = x2−4 x2−1 .)
- `substitute y for f(x) -> subtract -> divide -> swap variables` (canonicalStem: Example 1.91. Find the inverse of f (x) = 2x + 3.)
- `substitute y for f(x) -> take square root -> swap variables` (canonicalStem: Example 1.92. For f (x) = x2 with domain [0, ∞),  nd the inverse.)
- `define function -> substitute value -> multiply -> add -> substitute value -> multiply -> add -> set equation to constant -> subtract constant -> divide by coefficient` (canonicalStem: Example 1.96. A utility company charges a  xed monthly connection fee of $15 plu)
- `define function -> subtract -> distribute negative sign -> combine like terms -> set equation to zero -> add constants -> divide by coefficient -> substitute value -> multiply -> subtract` (canonicalStem: Example 1.97. A company manufactures widgets. The cost function is C(q) = 8000 +)
- `factor numerator -> cancel common factors -> evaluate limit` (canonicalStem: Example 2.9. Find limx→3 x2−9
x−3 .)
- `select piece -> evaluate limit -> select piece -> evaluate limit -> compare limits` (canonicalStem: Example 2.14. For f (x) =
(
3, x ≤ 2
x + 1, x > 2 ,  nd limx→2 f (x).)
- `apply root law` (canonicalStem: Example 2.20. Find limx→27 3
√x.)
- `divide by highest power -> evaluate limit` (canonicalStem: Find lim x→∞ 3x2 + 2x + 1 x2 − 1 .)
- `divide by x3 -> evaluate limit` (canonicalStem: Find lim x→∞ 5x3 − 2x + 1 2x3 + x2 − 4 .)
- `evaluate function -> evaluate limit -> compare values` (canonicalStem: Is f (x) = x2 + 3x − 2 continuous at x = 1?)
- `apply power rule -> apply constant multiple rule -> simplify` (canonicalStem: Find d dx (4x6 − 2x4 + 5x2 − 8).)
- `identify components -> calculate derivatives -> apply quotient rule -> factor expression -> simplify exponent` (canonicalStem: Find y′ for y = x2 ex .)
- `substitute u -> apply chain rule` (canonicalStem: Find y′ for y = ex2 .)
- `identify indeterminate form -> apply L'Hôpital's rule -> simplify fraction -> evaluate limit` (canonicalStem: Find limx→∞ ln x x .)
- `apply power rule -> apply power rule -> evaluate inequality` (canonicalStem: Example 3.90. For a cost function C(q) = 1000+20q +0.05q2,  nd C′′(q) and interp)
- `apply power rule -> apply trigonometric rule -> apply exponential rule -> combine terms` (canonicalStem: Example 4.7. Find R (3x2 − 2 sin x + ex) dx.)
- `apply trigonometric identity -> distribute integral -> evaluate integral -> simplify` (canonicalStem: Example 4.27. Find R sin2 x dx.)
- `identify trigonometric antiderivative -> evaluate boundaries -> substitute trigonometric values -> simplify arithmetic` (canonicalStem: Example 5.5. Compute R π 0 sin x dx.)
- `compute cartesian product -> compute cartesian product` (canonicalStem: Example 3: If \(A = \{a_1, a_2\}\). Then)
- `compute cartesian product -> calculate cardinality` (canonicalStem: Example 1.2. Let A = {1, 2, 3} and B = {x, y}. Then A × B = {(1, x), (1, y), (2,)
- `evaluate relation condition` (canonicalStem: Example 1.4. Let A = {1, 2, 3, 4}, B = {2, 4, 6, 8}. De ne R = {(a, b) ∈ A × B |)
- `set output equality -> simplify equation` (canonicalStem: Example 1.7. f (x) = 3x − 2 is injective because 3x1 − 2 = 3x2 − 2 implies x1 = )
- `evaluate function at positive value -> evaluate function at negative value -> compare inputs` (canonicalStem: Example 1.8. f (x) = x2 is NOT injective because f (2) = f (−2) = 4 but 2̸ = −2.)
- `invert function` (canonicalStem: Example 1.10. f (x) = 3x − 2 is surjective because for any y, x = (y + 2)/3 work)
- `identify range constraint` (canonicalStem: Example 1.11. f (x) = x2 is NOT surjective onto R because negative numbers have )
- `verify bijective property -> verify bijective property` (canonicalStem: Example 1.13. f (x) = 3x − 2 is bijective. f (x) = x3 is also bijective.)
- `equate expressions -> subtract constant -> divide by coefficient -> solve for x -> verify real domain -> conclude bijection` (canonicalStem: Example 1.14. Determine if f : R → R, f (x) = 2x + 3 is injective, surjective, o)
- `provide counterexample` (canonicalStem: Example 1.15. Determine if f : Z → Z, f (n) = n2 is injective.)
- `solve for preimage` (canonicalStem: Example 1.16. Determine if f : R → [0, ∞), f (x) = x2 is surjective.)
- `evaluate constant function` (canonicalStem: Example 1.18. Let f (x) = 5. Find f (0), f (10), and f (−3).)
- `define function -> define domain -> define range` (canonicalStem: Example 1.19. A taxi company charges a  at fee of $3 per ride regardless of dist)
- `evaluate identity function -> evaluate identity function -> evaluate identity function` (canonicalStem: Example 1.21. For f (x) = x, compute f (5), f (−2), and f (0).)
- `apply injective definition -> apply surjective definition -> conclude bijection` (canonicalStem: Example 1.22. Show that the identity function is bijective.)
- `add terms -> evaluate absolute value -> evaluate absolute value -> add terms -> compare values` (canonicalStem: Example 1.24. Verify the triangle inequality for a = 5 and b = −3.)
- `evaluate absolute value -> evaluate absolute value -> compare values` (canonicalStem: Example 1.25. Verify the reverse triangle inequality for a = 7 and b = 2.)
- `interpret definition -> split into cases -> solve linear equations` (canonicalStem: Example 1.26. Solve the equation |x − 3| = 5 using the properties of absolute va)
- `state inequality properties -> add inequalities -> apply absolute value definition` (canonicalStem: Example 1.28. Prove the triangle inequality: |a + b| ≤ |a| + |b|.)
- `define inequality bounds -> add inequalities -> apply absolute value definition` (canonicalStem: Example 1.28. Prove the triangle inequality: |a + b| ≤ |a| + |b|.)
- `apply signum definition -> apply signum definition -> apply signum definition` (canonicalStem: Example 1.30. Evaluate sgn(10), sgn(−5), and sgn(0).)
- `define piecewise function -> substitute positive value -> substitute negative value -> evaluate boundary condition` (canonicalStem: Example 1.31. Express f (x) = |x| using the signum function.)
- `multiply arguments -> apply signum definition -> evaluate signum factors -> multiply results -> compare values` (canonicalStem: Example 1.32. Verify the multiplicativity property: sgn(xy) = sgn(x) · sgn(y) fo)
- `apply square property` (canonicalStem: Example 1.33. Simplify the expression sgn(x2) for x̸ = 0.)
- `apply floor definition -> apply floor definition -> apply floor definition` (canonicalStem: Example 1.35. Evaluate ⌊3.7⌋, ⌊−2.3⌋, and ⌊5⌋.)
- `convert floor to inequality` (canonicalStem: Example 1.36. Solve ⌊x⌋ = 4.)
- `identify segment intervals -> define endpoint markers` (canonicalStem: Example 1.37. Graph f (x) = ⌊x⌋ for −3 ≤ x ≤ 3.)
- `apply ceiling definition -> apply ceiling definition -> apply ceiling definition` (canonicalStem: Example 1.39. Evaluate ⌈3.2⌉, ⌈−2.7⌉, and ⌈5⌉.)
- `convert ceiling to inequality` (canonicalStem: Example 1.40. Solve the equation ⌈x⌉ = 3.)
- `interpret inequality -> apply ceiling definition` (canonicalStem: Example 1.41. Solve the inequality ⌈x⌉ ≤ 2.)
- `define interval mapping -> specify endpoint conditions` (canonicalStem: Example 1.42. Graph f (x) = ⌈x⌉ for −3 ≤ x ≤ 3.)
- `approximate value -> apply ceiling definition -> approximate value -> apply ceiling definition` (canonicalStem: Example 1.43. Find ⌈π⌉ and ⌈−π⌉.)
- `evaluate ceiling -> evaluate floor -> negate result -> evaluate ceiling -> evaluate floor -> negate result` (canonicalStem: Example 1.44. Verify the relationship ⌈x⌉ = −⌊−x⌋ for x = 2.3 and x = −1.5.)
- `model piecewise cost -> construct ceiling expression -> algebraic simplification` (canonicalStem: Example 1.45. A parking garage charges $5 for the rst hour or any part of an hou)
- `define piecewise function -> distribute constant` (canonicalStem: Example 1.46. A courier company charges $8 for the rst kilogram or fraction ther)
- `interpret ceiling inequality -> evaluate boundary condition` (canonicalStem: Example 1.47. Solve the inequality ⌈x⌉ > 2.)
- `determine polynomial domain -> complete the square -> apply inequality property -> determine range` (canonicalStem: Example 1.50. Find the domain and range of f (x) = x2 − 4x + 7.)
- `factor expression -> apply zero product property` (canonicalStem: Example 1.51. Find the zeros (roots) of f (x) = x2 − 5x + 6.)
- `set denominator to zero -> factor expression -> solve for x -> exclude values from domain -> convert to interval notation` (canonicalStem: Example 1.54. Find the domain of f (x) = x+2 x2−9 .)
- `analyze denominator sign -> conclude domain` (canonicalStem: Example 1.55. Find the domain of f (x) = 2x+1 x2+4 .)
- `factor denominator -> solve for x -> compare factors -> identify asymptotes` (canonicalStem: Example 1.56. Find the vertical asymptotes of f (x) = x x2−4 .)
- `factor numerator -> simplify fraction -> cancel common factors -> identify hole` (canonicalStem: Example 1.57. Find the vertical asymptotes of f (x) = x2−4 x−2 .)
- `compare degrees -> identify leading coefficients -> calculate ratio` (canonicalStem: Example 1.58. Find the horizontal asymptote of f (x) = 3x2+2 x2−1 .)
- `compare degrees -> assign horizontal asymptote` (canonicalStem: Example 1.59. Find the horizontal asymptote of f (x) = 5x+2 x3−1 .)
- `compare degrees -> perform polynomial division` (canonicalStem: Example 1.60. Find the horizontal asymptote of f (x) = 2x3−4x+1 x2+3 .)
- `factor numerator -> cancel common factors -> substitute x-value` (canonicalStem: Example 1.61. Identify any holes in the graph of f (x) = x2−4 x−2 .)
- `factor numerator -> factor denominator -> simplify expression -> identify common factor -> substitute x-value -> evaluate expression` (canonicalStem: Example 1.62. Identify any holes in the graph of f (x) = x2−3x+2 x2−1 .)
- `factor numerator -> factor denominator -> cancel common factors -> identify hole -> substitute x-value -> evaluate expression -> set denominator to zero -> solve for x -> compare degrees -> identify leading coefficients` (canonicalStem: Example 1.65. Find all asymptotes of f (x) = 2x2+3x−2 x2−x−6 .)
- `set denominator to zero -> identify vertical asymptote -> compare degrees -> set numerator to zero -> set x to zero -> evaluate expression -> evaluate limit` (canonicalStem: Example 1.66. Sketch the graph of f (x) = 1 x−2 by identifying its asymptotes an)
- `factor numerator -> factor denominator -> cancel common factors -> identify hole -> substitute x-value -> evaluate expression -> identify domain restrictions -> set denominator to zero -> compare degrees -> identify leading coefficients` (canonicalStem: Example 1.67. Find the domain, vertical asymptotes, and horizontal asymptote of
)
- `identify factors -> compare degrees -> construct function -> substitute point -> simplify expression -> solve for constant -> substitute constant` (canonicalStem: Example 1.68. A rational function has vertical asymptotes at x = 2 and x = −3,
a)
- `distribute division -> evaluate limit -> identify asymptotes -> interpret result` (canonicalStem: Example 1.69. A company's average cost per unit when producing x units is given )
- `evaluate power -> evaluate power -> evaluate power` (canonicalStem: Example 1.71. Evaluate 23, 1
2
 4, and e0.)
- `analyze growth -> apply reflection -> identify intercept` (canonicalStem: Example 1.72. Graph f (x) = 2x and g(x) = 1
2
 x on the same axes.)
- `express as common base -> equate exponents` (canonicalStem: Example 1.73. Solve the equation 2x = 8.)
- `define exponential function` (canonicalStem: Example 1.74. A population of bacteria doubles every hour. If the initial popula)
- `rewrite base -> rewrite base -> apply identity property` (canonicalStem: Example 1.76. Evaluate log2 8, log3 1
9 , and ln e5.)
- `apply quotient rule -> apply product rule -> apply power rule` (canonicalStem: Example 1.77. Expand ln
 x2y
z3
 .)
- `convert to exponential form -> subtract constant -> substitute value` (canonicalStem: Example 1.78. Solve log2(x + 1) = 4.)
- `apply product rule -> equate arguments -> expand binomial -> factor quadratic -> extract roots -> check domain constraints` (canonicalStem: Example 1.79. Solve ln x + ln(x − 2) = ln 8.)
- `evaluate trigonometric functions` (canonicalStem: Example 1.81. Evaluate sin π
6 , cos π
3 , and tan π
4 .)
- `identify reference angle -> apply quadrant identity` (canonicalStem: Example 1.82. Solve sin x = 1
2 for 0 ≤ x < 2π.)
- `rewrite tangent as quotient -> set denominator to zero -> solve trigonometric equation -> define domain` (canonicalStem: Example 1.83. Find the domain of f (x) = tan x.)
- `apply sine range bounds -> scale range -> shift range` (canonicalStem: Example 1.84. A Ferris wheel of radius 10 meters rotates once every 60 seconds. )
- `set radicand non-negative -> solve inequality -> determine domain -> evaluate function monotonicity -> determine range` (canonicalStem: Example 1.85. Find the domain and range of f (x) = √x − 3.)
- `set denominator unequal to zero -> solve inequality` (canonicalStem: Example 1.86. Find the domain of f (x) = 1
x2−4 .)
- `set argument positive -> isolate variable -> solve inequality` (canonicalStem: Example 1.87. Find the domain of f (x) = ln(x2 − 9).)
- `assume equality -> apply cube root` (canonicalStem: Example 1.88. Determine if f (x) = x3 is injective.)
- `test counterexample` (canonicalStem: Example 1.89. Determine if f (x) = x2 is surjective onto R.)
- `analyze function range` (canonicalStem: Example 1.90. Determine if f (x) = ex is surjective onto R.)
- `define linear function -> substitute value -> multiply -> add -> substitute value -> multiply -> add -> substitute value -> multiply -> add` (canonicalStem: Example 1.93. A manufacturing company has  xed costs of $10,000 per month and
va)
- `define function -> substitute value -> multiply -> add -> substitute value -> multiply -> add` (canonicalStem: Example 1.95. A car rental company charges a  at fee of $50 per day plus $0.20 p)
- `define cost function -> define revenue function -> define profit function -> simplify expression -> set equation to zero -> add constants -> divide by coefficient -> approximate decimal -> substitute value -> multiply -> subtract constants -> set equation to constant -> add constants -> divide by coefficient -> approximate decimal` (canonicalStem: Example 1.99. A book publisher has  xed costs of $50,000 for a new book. The var)
- `define revenue function -> define profit function -> simplify expression -> set equation to zero -> add constants -> divide by coefficient -> substitute value -> multiply -> subtract constants -> set equation to constant -> add constants -> divide by coefficient` (canonicalStem: Example 1.100. A toy company produces a game. The cost to produce q games is
C(q)
- `define height function` (canonicalStem: Example 1.101. A ball is thrown upward from ground level (h0 = 0) with an initia)
- `define height function -> identify vertex formula -> substitute values -> simplify quotient -> approximate decimal -> substitute values -> square term -> multiply -> subtract constants -> approximate decimal -> set equation to zero -> factor expression -> solve for variable -> add constants -> divide by coefficient -> approximate decimal` (canonicalStem: Example 1.101. A ball is thrown upward from ground level (h0 = 0) with an initia)
- `define height function -> identify vertex formula -> substitute values -> simplify quotient -> approximate decimal -> substitute values -> square term -> multiply -> add constants -> subtract constants -> approximate decimal -> set equation to zero -> multiply by constant -> apply quadratic formula -> square term -> multiply constants -> add constants -> calculate square root -> add terms -> divide by coefficient -> approximate decimal` (canonicalStem: Example 1.102. A rock is thrown upward from a cli  that is 50 meters high, with )
- `define height function -> calculate vertex -> evaluate function -> set equation to zero -> multiply by constant -> apply quadratic formula -> calculate square root -> calculate final times` (canonicalStem: Example 1.103. An arrow is shot straight upward from a height of 2 meters with a)
- `define height function -> calculate vertex -> evaluate function -> set equation to constant -> rearrange equation -> multiply by constant -> apply quadratic formula -> calculate square root -> calculate final times` (canonicalStem: Example 1.104. A water balloon is launched upward from a platform 10 meters high)
- `define population function -> evaluate function -> calculate doubling time -> set equation to constant -> divide by constant -> apply natural logarithm -> divide by constant` (canonicalStem: Example 1.105. A bacterial culture starts with 100 bacteria and grows at a rate )
- `substitute values -> divide by constant -> apply natural logarithm -> divide by constant -> define population function -> evaluate function -> calculate doubling time` (canonicalStem: Example 1.106. A population of 500 rabbits grows exponentially. After 3 years, t)
- `convert units -> rearrange equation -> define population function -> evaluate function -> set equation to constant -> divide by constant -> apply natural logarithm -> divide by constant` (canonicalStem: Example 1.107. A certain strain of bacteria doubles every 45 minutes. Find: (a) )
- `substitute values -> divide by constant -> apply natural logarithm -> evaluate logarithm -> solve for variable -> define function -> evaluate function -> set equation -> divide by constant -> apply natural logarithm -> solve for variable` (canonicalStem: Example 1.108. A mold culture starts with 50 spores and grows to 200 spores in 2)
- `solve for variable -> evaluate constant -> define function -> evaluate function -> set equation -> divide by constant -> apply natural logarithm -> solve for variable` (canonicalStem: Example 1.109. A sample of radioactive material has a half-life of 100 years. In)
- `solve for variable -> evaluate constant -> substitute values -> divide by constant -> apply natural logarithm -> apply log properties -> solve for variable -> multiply by constant` (canonicalStem: Example 1.110. Carbon-14 has a half-life of 5730 years. A fossil contains 25% of)
- `evaluate half-life -> evaluate function -> set equation -> divide by constant -> apply natural logarithm -> solve for variable -> set equation -> divide by constant -> apply natural logarithm -> solve for variable` (canonicalStem: Example 1.111. A radioactive isotope has a decay constant λ = 0.02 per year. Ini)
- `substitute values -> divide by constant -> apply natural logarithm -> solve for variable -> evaluate half-life -> evaluate function -> set equation -> divide by constant -> apply natural logarithm -> solve for variable` (canonicalStem: Example 1.112. A sample originally contains 200 mg of a radioactive substance. A)
- `substitute values -> simplify coefficient -> substitute variable -> simplify product -> convert to degrees -> apply trigonometric identity -> evaluate sine -> multiply constants` (canonicalStem: Example 1.113. A standard US household outlet supplies 120 V RMS (root mean squa)
- `substitute values -> simplify product -> substitute variable -> simplify product -> evaluate sine -> multiply constants -> set equation -> isolate sine -> apply inverse sine -> convert to degrees -> divide by coefficient` (canonicalStem: Example 1.114. In a European country, AC voltage has frequency 50 Hz and peak vo)
- `identify peak amplitude -> equate angular frequency -> divide by coefficient -> calculate reciprocal -> substitute variable -> simplify product -> convert to degrees -> evaluate sine -> multiply constants` (canonicalStem: Example 1.115. Given V (t) = 100 sin(200πt),  nd: (a) The peak voltage. (b) The
)
- `equate angular frequency -> divide by coefficient -> calculate reciprocal -> substitute variable -> simplify product -> evaluate sine -> multiply constants -> set equation -> isolate sine -> apply inverse sine -> divide by coefficient` (canonicalStem: Example 1.116. An AC voltage is given by V (t) = 150 sin(60πt). Find: (a) The fr)
- `substitute constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply by coefficient -> substitute variable -> evaluate exponents -> subtract terms -> multiply by coefficient -> evaluate limits` (canonicalStem: Example 1.117. A drug is administered orally. The absorption rate is ka = 2 per )
- `define function -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants` (canonicalStem: Example 1.118. For a certain drug, ka = 1.5 per hour, ke = 0.3 per hour, and the)
- `substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> assign variables -> substitute variable -> evaluate logarithm -> divide constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants` (canonicalStem: Example 1.119. A patient takes a medication. The concentration function is C(t) )
- `define function -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate logarithm -> divide constants` (canonicalStem: Example 1.120. For a drug with ka = 2.5 per hour, ke = 0.4 per hour, and C0 = 12)
- `define function -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants -> substitute variable -> evaluate logarithm -> divide constants -> substitute variable -> evaluate exponents -> subtract terms -> multiply constants` (canonicalStem: hour, and C0 = 12
mg/L,  nd: (a) The concentration function. (b) The concentrati)
- `state definition -> simplify expression -> factor expression -> set inequality -> isolate term -> assign delta -> substitute delta -> simplify expression` (canonicalStem: Example 2.2. Use the epsilon-delta de nition to prove that limx→2(3x + 1) = 7.)
- `state definition -> simplify expression -> isolate term -> assign delta -> verify inequality` (canonicalStem: Example 2.3. Prove that limx→1(2x + 3) = 5 using the epsilon-delta de nition.)
- `state definition -> factor expression -> bound term -> assign delta -> verify inequality` (canonicalStem: Example 2.4. Prove that limx→3 x2 = 9 using the epsilon-delta de nition.)
- `state definition -> multiply by conjugate -> apply inequality -> isolate term -> assign delta -> verify inequality` (canonicalStem: Example 2.5. Prove that limx→4
√x = 2 using the epsilon-delta de nition.)
- `substitute value` (canonicalStem: Example 2.7. Find limx→2(3x + 1).)
- `factor numerator -> cancel common factors -> substitute value` (canonicalStem: Example 2.8. Find limx→2 x2−4
x−2 .)
- `define absolute value -> simplify fraction -> evaluate limit -> define absolute value -> simplify fraction -> evaluate limit -> compare limits` (canonicalStem: Example 2.13. Find limx→0 |x|
x .)
- `evaluate one-sided limits -> conclude limit` (canonicalStem: Example 2.15. Find limx→0 1
x2 using one-sided limits.)
- `apply limit laws -> evaluate terms -> calculate sum` (canonicalStem: Example 2.17. Find limx→2(x2 − 3x + 5).)
- `evaluate limit of denominator -> evaluate limit of numerator -> evaluate limit of denominator -> analyze growth behavior -> evaluate right-hand limit -> evaluate left-hand limit` (canonicalStem: Example 2.18. Find limx→1 x2+2
x−1 if it exists.)
- `evaluate individual limits -> apply product law` (canonicalStem: Example 2.19. Find limx→4
√x · (x + 2).)
- `apply limit laws -> apply product law` (canonicalStem: Find limx→4
√x · (x + 2).)
- `multiply by constant -> substitute u -> apply limit laws` (canonicalStem: Example 2.21. Find limx→0 sin 3x
x .)
- `expand trigonometric identity -> apply product law` (canonicalStem: Example 2.22. Find limx→0 tan x
x .)
- `apply trigonometric identity -> algebraic simplification -> substitute value -> apply limit laws` (canonicalStem: Example 2.23. Find limx→0 1−cos x
x2 .)
- `multiply by constant -> substitute value -> apply limit laws -> evaluate standard limit -> multiply by constant` (canonicalStem: Example 2.24. Find limx→0 e2x−1
x .)
- `factor x squared from radical -> simplify fraction -> evaluate limit` (canonicalStem: Example 2.30. Find lim
x→∞
√4x2 + 1
x .)
- `multiply by conjugate -> simplify numerator -> divide numerator and denominator by x -> evaluate limit` (canonicalStem: Example 2.31. Find lim
x→∞(√x2 + 3x − x).)
- `factor x squared from radical -> substitute absolute value definition -> simplify fraction -> evaluate limit` (canonicalStem: Example 2.32. Find lim
x→−∞
√4x2 + 1
x .)
- `factor x from radical -> divide numerator and denominator by x -> evaluate limit` (canonicalStem: Example 2.33. Find lim
x→∞
√9x2 + 2x
2x + 1 .)
- `bound sine function -> multiply inequality by x squared -> apply squeeze theorem` (canonicalStem: Example 2.35. Find lim
x→0 x2 sin
  1
x
  .)
- `apply squeeze theorem -> evaluate limit` (canonicalStem: Example 2.36. Find lim
x→0 x cos
  1
x2
  .)
- `apply limit laws -> evaluate limit -> interpret result` (canonicalStem: Example 2.37 (Business: Average Cost as Production Increases). A company's total)
- `substitute value -> expand polynomial -> combine like terms -> evaluate function -> subtract -> divide by variable -> apply limit -> interpret result` (canonicalStem: Example 2.38 (Business: Marginal Cost as Limit of Average Rate of Change). The
m)
- `evaluate limit -> interpret result` (canonicalStem: Example 2.39 (Accounting: Present Value with Continuous Compounding). The presen)
- `evaluate function -> expand polynomial -> subtract -> divide by variable -> apply limit -> interpret result` (canonicalStem: Example 2.40 (Business: Revenue from Very Small Price Change). A company's reven)
- `rewrite expression -> evaluate limit` (canonicalStem: Example 2.41. Find lim
x→0
sin2 x
x2 .)
- `factor polynomial -> cancel common factors -> evaluate limit` (canonicalStem: Example 2.42. Find lim
x→2
x2 − 4
x2 − 3x + 2.)
- `divide by x4 -> evaluate limit` (canonicalStem: Find lim x→∞ 4x3 − 2x 5x4 + 3 .)
- `divide by x -> evaluate limit` (canonicalStem: Find lim x→∞ x2 + 1 x + 1 .)
- `divide by x -> simplify exponent -> evaluate limit -> sum terms` (canonicalStem: A manufacturing company has a cost function C(x) = 100x0.8 + 5000 for producing )
- `substitute value -> simplify exponent -> evaluate exponential -> multiply constants` (canonicalStem: An investment of $1000 earns interest at an annual rate of 5% compounded n times)
- `substitute value -> substitute value -> expand polynomial -> distribute constant -> combine like terms -> subtract functions -> divide by variable -> apply limit` (canonicalStem: A company's revenue function is R(q) = 500q − 2q2. Use the limit de nition of th)
- `evaluate limit -> multiply constants` (canonicalStem: A piece of equipment is purchased for $50,000 and its value after t years is giv)
- `evaluate denominator -> identify discontinuity` (canonicalStem: Is f (x) = 1 x−3 continuous at x = 3?)
- `factor expression -> cancel terms -> identify undefined point` (canonicalStem: Where is f (x) = x2−4 x−2 discontinuous?)
- `define function -> evaluate function -> apply intermediate value theorem` (canonicalStem: Show that the equation x3 − 2x − 5 = 0 has a root between 2 and 3.)
- `evaluate function -> apply intermediate value theorem` (canonicalStem: Show that f (x) = cos x − x has a root in (0, 1).)
- `evaluate function -> evaluate function -> apply intermediate value theorem` (canonicalStem: A company's pro t function is π(q) = −0.01q2 + 10q − 500 for q ≥ 0. Show that th)
- `substitute function -> combine like terms -> evaluate at endpoints -> apply intermediate value theorem` (canonicalStem: A company's revenue function is R(q) = 80q and cost function is C(q) = 5000 + 30)
- `expand binomial -> combine like terms -> factor variable -> cancel terms -> evaluate limit` (canonicalStem: Find f ′(2) for f (x) = x2.)
- `multiply by conjugate -> expand numerator -> cancel terms -> simplify fraction -> evaluate limit` (canonicalStem: Find f ′(x) for f (x) = √x.)
- `substitute values -> expand binomial -> distribute constant -> combine like terms -> cancel terms -> factor variable -> cancel terms -> evaluate limit` (canonicalStem: Find f ′(3) for f (x) = 2x2 − 3x + 1 using the limit de nition.)
- `expand numerator -> cancel terms -> simplify fraction -> evaluate limit` (canonicalStem: Find f ′(x) for f (x) = √x.)
- `substitute function -> expand binomial -> distribute constant -> combine like terms -> cancel terms -> divide by variable -> evaluate limit` (canonicalStem: Find f ′(3) for f (x) = 2x2 − 3x + 1 using the limit de nition.)
- `find common denominator -> simplify numerator -> cancel terms -> evaluate limit` (canonicalStem: Find f ′(x) for f (x) = 1 x using the limit de nition.)
- `expand binomial -> combine like terms -> divide by variable -> evaluate limit` (canonicalStem: Find f ′(x) for f (x) = x3 using the limit de nition.)
- `evaluate function -> apply power rule -> evaluate derivative -> apply point-slope form -> rearrange equation -> calculate negative reciprocal -> apply point-slope form -> rearrange equation` (canonicalStem: Find the equations of the tangent and normal lines to f (x) = x2 at x = 3.)
- `evaluate function -> apply power rule -> evaluate derivative -> apply point-slope form -> rearrange equation` (canonicalStem: Find the equation of the tangent line to f (x) = √x at x = 4.)
- `evaluate function -> apply power rule -> evaluate derivative -> calculate negative reciprocal -> apply point-slope form -> simplify equation` (canonicalStem: Find the equation of the normal line to f (x) = x3 − 2x at x = 1.)
- `identify slope -> apply power rule -> equate derivative to slope -> solve for x -> evaluate function` (canonicalStem: Find the point on f (x) = x2 where the tangent line is parallel to the line y = )
- `identify slope -> equate normal slope formula -> solve for derivative -> apply power rule -> solve for x -> evaluate function` (canonicalStem: Find the point on f (x) = x3 where the normal line is parallel to the line y = −)
- `rewrite with negative exponent -> apply power rule -> rewrite with positive exponent` (canonicalStem: Find d dx ( 1 x3 ) using the power rule.)
- `rewrite as fractional exponent -> apply power rule -> rewrite with radical` (canonicalStem: Find d dx (√x) using the power rule.)
- `apply power rule -> rewrite with positive exponent` (canonicalStem: Find d dx (x−2).)
- `calculate derivatives -> apply product rule -> simplify expression` (canonicalStem: Find y′ for y = x2 sin x.)
- `calculate derivatives -> apply product rule -> factor common term` (canonicalStem: Find y′ for y = ex cos x.)
- `assign functions -> apply power rule -> apply product rule -> distribute terms -> combine like terms` (canonicalStem: Find y′ for y = (2x + 1)(3x2 − 4).)
- `assign functions -> apply power rule -> apply natural log derivative -> apply product rule -> simplify` (canonicalStem: Find y′ for y = x ln x.)
- `assign functions -> apply power rule -> apply exponential derivative -> apply product rule -> factor exponential -> factor polynomial` (canonicalStem: Find y′ for y = x2ex.)
- `assign functions -> apply power rule -> apply quotient rule -> expand numerator -> combine like terms` (canonicalStem: Find y′ for y = x2+1 x−2 .)
- `assign functions -> apply trigonometric derivative rule -> apply power rule -> apply quotient rule -> rearrange terms` (canonicalStem: Find y′ for y = sin x x .)
- `identify components -> calculate derivatives -> apply quotient rule -> simplify expression` (canonicalStem: Find y′ for y = ln x x .)
- `substitute u -> apply chain rule -> differentiate inner function -> multiply` (canonicalStem: Find y′ for y = (3x2 + 1)5.)
- `substitute u -> apply chain rule -> differentiate inner function` (canonicalStem: Find y′ for y = sin(2x).)
- `rewrite expression -> substitute u -> apply chain rule -> apply trigonometric identity` (canonicalStem: Find y′ for y = cos2 x.)
- `apply product rule -> apply chain rule -> factor common term` (canonicalStem: Find y′ for y = e2x sin(3x).)
- `apply chain rule -> simplify trigonometric expression` (canonicalStem: Find y′ for y = ln(sin x).)
- `apply chain rule -> multiply` (canonicalStem: Find y′ for y = tan(ex).)
- `apply chain rule -> rearrange terms` (canonicalStem: Find y′ for y = esin x.)
- `rewrite as power -> apply chain rule -> simplify expression` (canonicalStem: Find y′ for y = √ln x.)
- `differentiate numerator -> differentiate denominator -> evaluate limit -> substitute value` (canonicalStem: Find limx→0 sin x x using L'Hôpital's Rule.)
- `differentiate numerator -> differentiate denominator -> substitute value` (canonicalStem: Find limx→0 ex−1 x .)
- `identify indeterminate form -> differentiate numerator -> differentiate denominator -> evaluate limit` (canonicalStem: Example 3.38. Find limx→0 sin x
x using L'Hôpital's Rule.)
- `identify indeterminate form -> apply L'Hôpital's rule -> differentiate numerator -> differentiate denominator -> evaluate limit` (canonicalStem: Example 3.39. Find limx→0 ex−1
x .)
- `identify indeterminate form -> apply L'Hôpital's rule -> identify indeterminate form -> apply L'Hôpital's rule -> evaluate limit` (canonicalStem: Example 3.41. Find limx→0 1−cos x
x2 .)
- `rewrite fraction -> apply L'Hôpital's rule -> simplify fraction -> evaluate limit` (canonicalStem: Example 3.42. Find limx→0+ x ln x.)
- `apply implicit differentiation -> isolate derivative` (canonicalStem: Example 3.43. Find dy
dx for x2 + y2 = 25.)
- `apply implicit differentiation -> collect derivative terms -> factor derivative -> divide by coefficient -> simplify fraction` (canonicalStem: Example 3.44. Find dy
dx for x3 + y3 = 6xy.)
- `apply chain rule -> apply power rule -> equate derivatives -> distribute terms -> collect derivative terms -> factor derivative -> divide by coefficient` (canonicalStem: Example 3.45. Find dy
dx for exy = x2 + y2.)
- `apply logarithm property -> apply implicit differentiation -> collect derivative terms -> factor derivative -> divide by coefficient -> multiply by reciprocal` (canonicalStem: Example 3.46. Find dy
dx for ln(xy) = x + y.)
- `apply implicit differentiation -> collect derivative terms -> factor derivative -> isolate derivative -> substitute point coordinates -> arithmetic evaluation` (canonicalStem: Example 3.47. Find the slope of the tangent line to x2 + xy + y2 = 7 at the poin)
- `apply power rule -> apply power rule` (canonicalStem: Example 3.48. For f (x) = x4 − 3x2,  nd f ′(x) and f ′′(x).)
- `apply trigonometric derivative rule -> apply trigonometric derivative rule -> apply trigonometric derivative rule -> apply trigonometric derivative rule` (canonicalStem: Example 3.49. For f (x) = sin x,  nd the  rst four derivatives.)
- `apply chain rule -> apply chain rule -> apply chain rule -> generalize pattern` (canonicalStem: Example 3.50. For f (x) = e2x,  nd f ′′(x) and f ′′′(x).)
- `apply reciprocal rule -> rewrite using negative exponent -> apply power rule -> rewrite using negative exponent -> apply power rule -> rewrite using negative exponent` (canonicalStem: Example 3.51. For f (x) = ln x,  nd f ′′(x) and f ′′′(x).)
- `apply power rule -> apply power rule -> substitute value -> evaluate expression` (canonicalStem: Example 3.52. For f (x) = x5 − 2x3 + 4x,  nd f ′′(x) and evaluate f ′′(2).)
- `apply power rule -> apply power rule -> substitute value -> substitute value` (canonicalStem: Example 3.53. A ball is thrown upward with position s(t) = −4.9t2 + 20t + 1. Fin)
- `apply power rule -> factor constant -> factor quadratic -> apply zero product property` (canonicalStem: Example 3.54. A particle moves along a line with position s(t) = t3 − 6t2 + 9t +)
- `apply power rule -> substitute value -> evaluate expression` (canonicalStem: Example 3.55. For the particle in the previous example,  nd the acceleration at )
- `set equation to zero -> isolate variable -> calculate square root -> apply power rule -> substitute value` (canonicalStem: Example 3.56. A falling object has position s(t) = 100 − 4.9t2. Find the velocit)
- `integrate expression -> substitute initial condition -> solve for constant` (canonicalStem: Example 3.59. A company  nds that the marginal cost is M C(q) = 50 − 0.2q. If  x)
- `apply power rule -> simplify expression -> substitute value -> evaluate expression` (canonicalStem: Example 3.61. For C(q) = 8000 + 25q + 0.5√q,  nd C′(100).)
- `apply power rule -> evaluate function` (canonicalStem: Example 3.62. A company's revenue is R(q) = 50q − 0.1q2. Find the marginal reven)
- `substitute expression -> distribute variable -> apply power rule` (canonicalStem: Example 3.63. If demand is p = 100 − 0.5q,  nd the marginal revenue function.)
- `apply power rule -> set to zero -> solve for variable` (canonicalStem: Example 3.64. For R(q) = 200q − 0.2q2,  nd the quantity that makes marginal reve)
- `define function -> apply power rule` (canonicalStem: Example 3.65. A company sells its product at a constant price of $75. Find the m)
- `integrate expression -> evaluate constant -> substitute constant` (canonicalStem: Example 3.66. If marginal revenue is M R(q) = 80 − 0.4q and  xed costs are $5000)
- `subtract polynomials -> combine like terms -> apply power rule -> set equation to zero -> isolate variable -> apply power rule -> evaluate inequality -> round result` (canonicalStem: Example 3.67. Given R(q) = 100q − 0.5q2 and C(q) = 5000 + 20q + 0.1q2,  nd the
p)
- `subtract polynomials -> combine like terms -> apply power rule -> set equation to zero -> isolate variable -> substitute value -> evaluate power -> perform multiplication -> perform addition and subtraction` (canonicalStem: Example 3.68. For R(q) = 120q and C(q) = 3000 + 40q + 0.2q2,  nd the pro t-
maxi)
- `apply power rule -> set equation to zero -> isolate variable -> apply power rule -> evaluate inequality -> substitute value -> evaluate power -> perform multiplication -> perform subtraction` (canonicalStem: Example 3.69. A company's pro t function is π(q) = 400q − 2q2 − 10000. Find the
)
- `apply power rule -> set equation to zero -> isolate variable -> substitute value -> evaluate power -> perform multiplication -> perform addition and subtraction` (canonicalStem: Example 3.70. If π(q) = −0.01q2 + 10q − 500,  nd the maximum pro t.)
- `subtract polynomials` (canonicalStem: Example 3.71. A  rm has R(q) = 80q and C(q) = 2000 + 30q + 0.05q2. Find the
brea)
- `compute derivative -> set to zero -> solve for q -> compute second derivative -> evaluate function` (canonicalStem: Example 3.69. A company's pro t function is π(q) = 400q − 2q2 − 10000. Find the
)
- `compute derivative -> set to zero -> solve for q -> evaluate function` (canonicalStem: Example 3.70. If π(q) = −0.01q2 + 10q − 500,  nd the maximum pro t.)
- `subtract functions -> simplify expression -> compute derivative -> set to zero -> solve for q -> set to zero -> multiply equation -> reorder terms -> apply quadratic formula -> simplify radical -> calculate values` (canonicalStem: Example 3.71. A  rm has R(q) = 80q and C(q) = 2000 + 30q + 0.05q2. Find the
brea)
- `apply chain rule -> simplify coefficients -> substitute value -> evaluate exponential -> perform multiplication` (canonicalStem: Example 3.72. A car's value is V (t) = 25000e−0.15t. Find the depreciation rate )
- `calculate slope -> construct linear equation -> compute derivative` (canonicalStem: Example 3.73. Equipment depreciates linearly from $50,000 to $5,000 over 10 year)
- `rewrite base -> apply chain rule -> calculate logarithm -> substitute value -> evaluate expression` (canonicalStem: Example 3.74. A machine's value is V (t) = 20000(0.8)t. Find the rate of depreci)
- `apply chain rule -> calculate logarithm -> substitute value -> evaluate power -> perform multiplication` (canonicalStem: Example 3.75. A building depreciates using the declining balance method: V (t) =)
- `define function -> substitute value -> simplify fraction -> multiply constants` (canonicalStem: Example 3.76. A company uses sum-of-years-digits depreciation for a $60,000 asse)
- `apply chain rule -> simplify constant -> substitute value -> evaluate exponential -> perform multiplication` (canonicalStem: Example 3.77. A bacteria population grows as P (t) = 500e0.3t. Find the growth r)
- `apply chain rule -> simplify expression -> evaluate exponential -> evaluate denominator -> evaluate square -> evaluate numerator -> calculate quotient` (canonicalStem: Example 3.78. A population of deer is modeled by P (t) = 10000
1+9e−0.2t . Find )
- `apply power rule -> substitute value` (canonicalStem: Example 3.79. A culture of yeast grows according to P (t) = 2000 + 100t2. Find t)
- `apply chain rule -> simplify constant -> substitute value -> evaluate exponential -> multiply constants` (canonicalStem: Example 3.80. The population of a city is P (t) = 250000e0.02t. Find the growth )
- `set constant -> equate expression -> isolate term -> isolate exponential -> apply natural logarithm -> define function -> apply chain rule -> substitute value -> evaluate denominator -> evaluate numerator -> calculate quotient` (canonicalStem: Example 3.81. A  sh population follows logistic growth: P (t) = 10000
1+4e−0.1t )
- `compute derivative -> substitute value -> evaluate denominator -> multiply constants -> calculate quotient -> compare magnitude` (canonicalStem: Example 3.82. For demand function D(p) = 100 − 2p,  nd the elasticity at p = 30.)
- `compute derivative -> evaluate function -> substitute values -> multiply constants -> calculate quotient -> classify result` (canonicalStem: Example 3.83. For D(p) = 200 − 5p,  nd the elasticity at p = 20.)
- `apply chain rule -> simplify coefficient -> substitute expression -> cancel terms -> simplify fraction` (canonicalStem: Example 3.84. For D(p) = 500e−0.1p,  nd the elasticity.)
- `rewrite exponent -> apply power rule -> substitute expression -> substitute expression -> multiply fractions -> simplify exponents` (canonicalStem: Example 3.85. For D(p) = 1000
p ,  nd the elasticity.)
- `distribute p -> apply power rule -> set derivative to zero -> solve linear equation -> evaluate function -> differentiate polynomial -> substitute expression -> simplify fraction` (canonicalStem: Example 3.86. A product has demand D(p) = 300 − 3p. Find the price that maximize)
- `apply power rule -> apply power rule -> evaluate at point -> evaluate at point` (canonicalStem: Example 3.87. For s(t) = t3 − 6t2 + 9t,  nd velocity and acceleration at t = 2.)
- `apply product rule -> factor exponential -> apply product rule -> distribute negative -> combine like terms` (canonicalStem: Example 3.88. If x(t) = e−t sin t,  nd x′′(t).)
- `apply power rule -> apply power rule -> factor constant -> factor quadratic -> solve equation` (canonicalStem: Example 3.91. The position of a particle is s(t) = t4 − 4t3 + 6t2. Find when the)
- `apply reverse power rule` (canonicalStem: Example 4.2. Find R x3 dx.)
- `apply logarithmic integration rule` (canonicalStem: Example 4.3. Find R 1
x dx.)
- `apply power rule -> apply trigonometric rule -> apply logarithmic rule -> combine terms` (canonicalStem: Example 4.8. Find R (4x3 + 5 cos x − 1 x ) dx.)
- `apply logarithmic rule -> apply trigonometric rule -> apply exponential rule -> combine terms` (canonicalStem: Example 4.10. Find R 2 x + 3 sin x − 4ex dx.)
- `rewrite as power -> apply power rule -> rewrite as power -> apply power rule -> combine terms` (canonicalStem: Example 4.11. Find R √x + 1 √x dx.)
- `substitute u -> calculate differential -> substitute u -> integrate exponential -> substitute back` (canonicalStem: Example 4.12. Find R 2xex2 dx.)
- `substitute u -> calculate differential -> substitute u -> integrate sine -> substitute back` (canonicalStem: Example 4.13. Find R sin(ln x) x dx.)
- `substitute u -> calculate differential -> isolate differential -> substitute u -> factor constant -> apply power rule -> simplify coefficient -> substitute back` (canonicalStem: Example 4.14. Find R x√x2 + 1 dx.)
- `substitute u -> calculate differential -> isolate differential -> substitute u -> factor constant -> integrate reciprocal -> substitute back` (canonicalStem: Example 4.15. Find R x x2+1 dx.)
- `substitute u -> calculate differential -> isolate differential -> substitute u -> factor constant -> integrate cosine -> substitute back` (canonicalStem: Example 4.16. Find R cos(3x) dx.)
- `assign variables for integration by parts -> apply integration by parts formula -> evaluate integral -> factor expression` (canonicalStem: Example 4.17. Find R xex dx.)
- `assign variables for integration by parts -> apply integration by parts formula -> simplify integrand -> evaluate integral` (canonicalStem: Example 4.18. Find R ln x dx.)
- `assign variables for integration by parts -> apply integration by parts formula -> substitute known integral result -> distribute constant -> combine like terms` (canonicalStem: Example 4.19. Find R x2ex dx.)
- `assign variables for integration by parts -> apply integration by parts formula -> evaluate integral` (canonicalStem: Example 4.20. Find R x cos x dx.)
- `assign variables for integration by parts -> apply integration by parts formula -> assign variables for integration by parts -> apply integration by parts formula -> substitute expression -> add integral to both sides -> divide by constant` (canonicalStem: Example 4.21. Find R ex sin x dx.)
- `factor denominator -> set partial fraction decomposition -> multiply by common denominator -> expand polynomial -> equate coefficients -> substitute value -> solve for constants -> integrate function` (canonicalStem: Example 4.22. Find R 1 x2−4 dx.)
- `factor denominator -> cancel common factors -> integrate function` (canonicalStem: Example 4.23. Find R x+2 x2+3x+2 dx.)
- `identify derivative -> substitute u -> integrate reciprocal -> substitute back` (canonicalStem: Example 4.24. Find R 2x+3 x2+3x+2 dx.)
- `set partial fraction decomposition -> multiply by common denominator -> expand polynomial -> equate coefficients -> subtract equations -> solve for constants -> integrate function` (canonicalStem: Example 4.25. Find R 3x+5 (x+1)(x+2) dx.)
- `factor denominator -> set partial fraction decomposition -> multiply by common denominator -> expand polynomial -> equate coefficients -> substitute value -> solve system of equations -> solve for constants -> integrate function` (canonicalStem: Example 4.26. Find R 2x2+3x+4 x3+x2−2x dx.)
- `factor expression -> substitute u -> evaluate integral -> substitute back` (canonicalStem: Example 4.29. Find R sin3 x dx.)
- `factor expression -> substitute u -> expand polynomial -> evaluate integral -> substitute back` (canonicalStem: Example 4.30. Find R sin2 x cos3 x dx.)
- `apply trigonometric identity -> expand binomial -> apply trigonometric identity -> simplify fraction -> distribute integral -> evaluate integral -> simplify` (canonicalStem: Example 4.31. Find R sin4 x dx.)
- `rewrite trigonometric function -> substitute u -> evaluate integral -> substitute back -> apply logarithmic identity` (canonicalStem: Example 4.32. Find R tan x dx.)
- `multiply by conjugate -> distribute term -> substitute u -> evaluate integral -> substitute back` (canonicalStem: Example 4.33. Find R sec x dx.)
- `apply trigonometric identity -> distribute integral -> evaluate integral` (canonicalStem: Example 4.34. Find R tan2 x dx.)
- `apply integration by parts -> substitute identity -> distribute term -> add integral to both sides -> divide by constant` (canonicalStem: Example 4.35. Find R sec3 x dx.)
- `factor expression -> substitute identity -> substitute u -> expand polynomial -> evaluate integral -> substitute back` (canonicalStem: Example 4.36. Find R tan3 x sec3 x dx.)
- `substitute trigonometric function -> simplify radical -> substitute expression -> apply trigonometric identity -> apply power-reduction identity -> integrate -> apply double angle identity -> apply inverse trigonometric function -> substitute back` (canonicalStem: Example 4.37. Find R √1 − x2 dx.)
- `substitute trigonometric function -> simplify radical -> substitute expression -> cancel terms -> integrate -> substitute back` (canonicalStem: Example 4.38. Find R 1 √4−x2 dx.)
- `substitute trigonometric function -> substitute expression -> cancel terms -> apply trigonometric identity -> integrate -> convert trigonometric functions -> substitute back` (canonicalStem: Example 4.39. Find R 1 x2√4−x2 dx.)
- `substitute trigonometric function -> apply trigonometric identity -> substitute expression -> cancel terms -> integrate -> substitute back` (canonicalStem: Example 4.40. Find R 1 x2+9 dx.)
- `substitute trigonometric function -> simplify radical -> substitute expression -> apply trigonometric identity -> distribute terms -> split integral -> apply reduction formula -> apply integral formula -> substitute expression -> simplify expression -> substitute back -> simplify` (canonicalStem: Example 4.41. Find R √x2 − 4 dx.)
- `apply power rule for integration -> evaluate boundaries -> simplify arithmetic` (canonicalStem: Example 5.4. Compute R 2 0 x3 dx.)
- `identify logarithmic antiderivative -> evaluate boundaries -> apply logarithm property` (canonicalStem: Example 5.6. Compute R 4 1 1 x dx.)
- `apply u-substitution rule -> evaluate boundaries -> factor constant` (canonicalStem: Example 5.7. Compute R 1 0 e2x dx.)
- `apply power rule -> simplify coefficient -> evaluate boundaries -> apply power rule -> evaluate boundaries -> apply power rule -> evaluate boundaries -> combine terms` (canonicalStem: Example 5.9. Use properties to evaluate R 2 0 (3x2 − 2x + 1)dx.)
- `apply linearity property -> substitute values -> multiply constants -> subtract constants` (canonicalStem: Example 5.10. If R 2 0 f (x)dx = 5 and R 2 0 g(x)dx = 3, nd R 2 0 (4f (x) − 2g(x)
- `substitute u -> calculate differential -> isolate differential -> change lower bound -> change upper bound -> substitute variable -> factor constant -> apply fundamental theorem of calculus -> evaluate boundaries` (canonicalStem: Example 5.11. Compute R 1 0 xex2 dx.)
- `substitute u -> calculate differential -> change lower bound -> change upper bound -> substitute variable -> apply power rule -> evaluate boundaries` (canonicalStem: Example 5.12. Compute R π/2 0 sin x cos x dx.)
- `substitute u -> calculate differential -> isolate differential -> change lower bound -> change upper bound -> substitute variable -> factor constant -> apply natural log integral -> evaluate boundaries` (canonicalStem: Example 5.13. Compute R 1 0 x x2+1 dx.)
- `substitute u -> calculate differential -> evaluate limits -> substitute variable -> evaluate integral` (canonicalStem: Example 5.14. Compute R π 0 sin2 x cos x dx.)
- `substitute trigonometric function -> calculate differential -> evaluate limits -> substitute variable -> simplify integrand -> cancel terms -> evaluate integral -> apply fundamental theorem of calculus` (canonicalStem: Example 5.15. Compute R 2 0 dx √4−x2 .)
- `apply limit definition -> rewrite exponent -> apply power rule -> apply fundamental theorem of calculus -> evaluate limit` (canonicalStem: Example 5.16. Compute R ∞ 1 1 x2 dx.)
- `apply limit definition -> apply exponential rule -> apply fundamental theorem of calculus -> evaluate limit` (canonicalStem: Example 5.17. Compute R ∞ 0 e−x dx.)
- `apply limit definition -> apply logarithmic rule -> apply fundamental theorem of calculus -> evaluate limit` (canonicalStem: Example 5.18. Compute R ∞ 1 1 x dx.)
- `identify discontinuity -> rewrite as limit -> rewrite integrand -> apply power rule -> evaluate limits -> simplify` (canonicalStem: Example 5.19. Compute R 1 0 1 √x dx.)
- `split integral at discontinuity -> apply power rule -> evaluate boundaries -> simplify -> evaluate limit -> state divergence` (canonicalStem: Example 5.20. Compute R 2 0 1 (x−1)2 dx. (This integral has a discontinuity at x)
- `compare functions -> set up integral -> apply power rule -> evaluate boundaries -> subtract fractions` (canonicalStem: Example 6.1. Find the area between y = x2 and y = x from x = 0 to x = 1.)
- `equate functions -> solve for x -> compare functions -> set up sum of integrals -> apply trigonometric integration -> evaluate boundaries -> simplify -> apply trigonometric integration -> evaluate boundaries -> simplify -> add results` (canonicalStem: Example 6.2. Find the area between y = sin x and y = cos x from x = 0 to x = π/2)
- `equate functions -> subtract terms -> factor expression -> solve for x -> compare functions -> set up integral -> combine like terms -> apply power rule -> evaluate boundaries -> subtract fractions` (canonicalStem: Example 6.3. Find the area enclosed by y = x2 and y = 2x − x2.)
- `compare functions -> set up integral -> apply power rule -> evaluate limits -> simplify arithmetic -> identify symmetry -> apply absolute value -> apply power rule -> evaluate limits -> simplify arithmetic` (canonicalStem: Example 6.4. Find the area between y = x3 and y = x from x = −1 to x = 1.)
- `compare functions -> set up integral -> apply integration by parts -> evaluate limits -> simplify arithmetic` (canonicalStem: Example 6.5. Find the area bounded by y = ln x, y = 0, x = 1, and x = e.)
- `set up integral -> simplify integrand -> apply power rule -> evaluate limits -> simplify arithmetic` (canonicalStem: Example 6.6. Find the volume of the solid obtained by rotating y = √x from x = 0)
- `define rotation -> set up integral -> apply power rule -> evaluate limits -> distribute terms -> simplify arithmetic` (canonicalStem: Example 6.7. Find the volume of a sphere of radius R.)
- `set up integral -> apply power-reduction identity -> factor constant -> apply integration -> evaluate limits -> simplify arithmetic` (canonicalStem: Example 6.8. Find the volume of the solid obtained by rotating y = sin x from x )
- `identify radii -> set up integral -> apply power rule -> evaluate limits -> simplify fraction` (canonicalStem: Example 6.9. Find the volume obtained by rotating the region between y = x2 and )
- `equate functions -> solve for variable -> compare functions -> identify radii -> set up integral -> apply power rule -> evaluate limits -> find common denominator -> simplify fraction` (canonicalStem: Example 6.10. Find the volume of the solid obtained by rotating the region bound)
- `equate functions -> solve for variable -> compare functions -> identify radii -> set up integral -> apply power rule -> evaluate limits -> simplify fraction` (canonicalStem: Example 6.11. Find the volume obtained by rotating the region between y = √x and)
- `set up integral -> simplify integrand -> apply power rule -> evaluate limits -> simplify expression` (canonicalStem: Example 6.12. Find the volume obtained by rotating the region under y = x2 from )
- `define shell variables -> set up integral -> distribute variable -> apply power rule -> evaluate limits -> find common denominator -> simplify fraction` (canonicalStem: Example 6.13. Find the volume obtained by rotating the region between y = x2 and)
- `set up integral -> define substitution variables -> apply integration by parts -> evaluate definite integral` (canonicalStem: Example 6.14. Find the volume obtained by rotating the region under y = sin x fr)
- `calculate derivative -> simplify expression -> set up integral -> perform u-substitution -> change limits of integration -> evaluate power rule -> evaluate at limits` (canonicalStem: Example 6.15. Find the length of y = x3/2 from x = 0 to x = 4.)
- `calculate derivative -> simplify expression -> set up integral -> apply power rule -> evaluate definite integral` (canonicalStem: Example 6.16. Find the length of y = 2/3 x3/2 from x = 0 to x = 3.)
- `define function -> calculate derivative -> simplify fraction -> set up integral -> apply symmetry -> evaluate inverse trigonometric integral -> multiply` (canonicalStem: Example 6.17. Find the circumference of a circle of radius R using arc length.)
- `set up integral -> apply power rule -> evaluate definite integral` (canonicalStem: Example 6.18. A spring obeys Hooke's law: F (x) = kx, where k is the spring cons)
- `set up integral -> apply power rule -> evaluate boundaries -> arithmetic simplification` (canonicalStem: Example 6.19. If a spring has spring constant k = 100 N/m,  nd the work to stret)
- `solve algebraic equation -> set up integral -> apply power rule -> evaluate boundaries -> arithmetic simplification` (canonicalStem: Example 6.20. A force of 10 N stretches a spring 0.2 m from its natural length. )
- `equate expressions -> solve for variable -> substitute value -> set up integral -> apply power rule -> evaluate boundaries -> arithmetic simplification -> set up integral -> apply power rule -> evaluate boundaries -> arithmetic simplification` (canonicalStem: Example 6.21. If demand is D(q) = 50 − 0.5q and supply is S(q) = 10 + 2q,  nd eq)
- `equate expressions -> solve for variable -> substitute value -> set up integral -> apply power rule -> evaluate boundaries -> arithmetic simplification` (canonicalStem: Example 6.22. If D(q) = 100 − 2q and S(q) = 20 + 3q,  nd equilibrium and consume)
- `compute derivative -> simplify expression -> set up integral -> cancel terms -> evaluate integral -> evaluate boundaries` (canonicalStem: Example 6.23. Find the surface area of a sphere of radius R.)
- `calculate derivative -> simplify radical expression -> set up integral -> evaluate integral` (canonicalStem: Example 6.23. Find the surface area of a sphere of radius R.)
- `calculate derivative -> simplify radical -> set up integral -> substitute value -> calculate differential -> change limits of integration -> substitute trigonometric expressions -> apply trigonometric identity -> distribute terms -> apply reduction formula -> apply reduction formula -> combine like terms -> evaluate at limits -> arithmetic simplification -> multiply by constant` (canonicalStem: Example 6.24. Find the surface area obtained by rotating y = x2 from x = 0 to x )
- `calculate cardinality product` (canonicalStem: Example 2: For the two sets A and B given above, we have that \(n(A) = 3\) and \)
- `compute cartesian product -> define subset` (canonicalStem: Example 4: Let \(A = \{a, b\}\), \(B = \{c, d\}\). Find some relations from A to)
- `evaluate function -> verify mapping -> define sets -> compare sets` (canonicalStem: Example: Let \(A = \{1, 2, 3, 4, 5\}\), \(B = \{4, 7, 10, 13, 16, 19, 22\}\) and)
- `extract domain and range -> extract codomain -> compare range and codomain` (canonicalStem: Example 5: Let \(A = \{1, 2, 3, 4, 5\}\), \(B = \{6, 7, 8\}\). If \(f: A \to B\))
- `set denominator to zero -> solve trigonometric equation -> exclude values from domain` (canonicalStem: What is the domain of \(f(x) = \frac{1}{1-2\cos x}\)?)
- `identify domain -> identify domain -> intersect sets` (canonicalStem: Example, the domain of \(f(x) = \sqrt{x}\) is \(A = [0, \infty)\) and the domain)
- `substitute function -> simplify expression -> substitute function -> simplify expression -> substitute function -> simplify expression -> substitute function -> distribute constant -> combine like terms` (canonicalStem: Example: suppose \(f, g, h: \mathbb{R} \to \mathbb{R}\) are defined by \(f(x) = )

### Full per-question results

- Q0 (NO FIT): "1. (a) Evaluate lim x→4 (2x^2 − 11x + 12) / (x − 4)"
  - signature: `factor numerator -> cancel common factors -> apply limit -> substitute x-value -> arithmetic evaluation`
- Q1 (NO FIT): "1. (b) Evaluate lim x→0 (√x + 4 − 2) / x"
  - signature: `multiply by conjugate -> simplify numerator -> cancel common factors -> apply limit -> substitute x-value -> arithmetic evaluation`
- Q2 (NO FIT): "2. Evaluate the following using limits law (a) lim x→2 (5x^3 − 3x^2 + 5x − 4)"
  - signature: `apply limit laws -> substitute x-value -> evaluate power -> arithmetic evaluation`
- Q3 (NO FIT): "2. (b) Evaluate lim x→−1 (6x^4 + 9x^2 − 5x − 3) / (7x^2 + 4x)"
  - signature: `apply limit laws -> substitute x-value -> evaluate power -> arithmetic evaluation`
- Q4 (NO FIT): "3. Evaluate the following (a) lim x→3 (2x^5 − 7x^3 + 5x − 6) / (7x^2 − 4x − 5)"
  - signature: `apply limit laws -> substitute x-value -> evaluate power -> arithmetic evaluation`
- Q5 (NO FIT): "3. (b) Evaluate lim θ→π/6 (sin θ − cos 2θ) / (2 cos θ + sin 2θ)"
  - signature: `substitute x-value -> evaluate trigonometric functions -> evaluate expression -> simplify expression`
- Q6 (NO FIT): "4. Evaluate lim x→0 (sin 7x) / (sin 3x)"
  - signature: `identify indeterminate form -> rewrite expression -> apply standard limit -> evaluate limit`
- Q7 (NO FIT): "5. Evaluate lim x→3 (2x^2 − 5x − 3) / (x − 3)"
  - signature: `factor numerator -> cancel common factors -> simplify expression -> substitute x-value -> evaluate limit`
- Q8 (NO FIT): "6. Given that f(x) = 8 − 2x if x > 4, √4 − x if x ≤ 4. Show whether the lim x→4 f(x) exists"
  - signature: `evaluate left-hand limit -> evaluate right-hand limit -> compare limits -> conclude limit`
- Q9 (NO FIT): "Exercise 1: 1. Show whether lim x→0 (9|x| − 5x) / x exists."
  - signature: `evaluate right-hand limit -> evaluate left-hand limit -> compare limits -> conclude limit`
- Q10 (FIT): "Exercise 1: 2. Evaluate lim x→0 (√x + 81 − 9) / 6x"
  - signature: `multiply by conjugate -> simplify numerator -> cancel common factors -> evaluate limit`
- Q11 (NO FIT): "Exercise 1: 3. Evaluate lim x→−3 (6x^4 − x^3 + 4x^2 − 18) / (5x^2 + 3x + 9)"
  - signature: `substitute x-value -> evaluate numerator -> evaluate denominator -> calculate quotient`
- Q12 (NO FIT): "Exercise 1: 4. Evaluate without calculator or Mathematical table lim x→3π/4 (sin x − 2 cos 1/3 x) / (2 cos x + sin 1/3 x"
  - signature: `substitute x-value -> evaluate trigonometric functions -> simplify expression`
- Q13 (NO FIT): "Example: Evaluate lim x→∞ (x^3 − x)"
  - signature: `analyze growth behavior -> evaluate limit`
- Q14 (NO FIT): "Examples: Evaluate 1. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (2x^4 − 7x^3 − 2x + 6)"
  - signature: `identify leading coefficients -> compare degrees -> calculate ratio -> evaluate limit`
- Q15 (NO FIT): "Examples: Evaluate 2. lim x→∞ (5x^2 + 2x + 9) / (3x^2 − 2x + 8)"
  - signature: `divide numerator and denominator by x -> evaluate limit -> calculate ratio`
- Q16 (NO FIT): "Examples: Evaluate 3. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (3x^2 + 4x + 1)"
  - signature: `divide numerator and denominator by x -> evaluate limit -> analyze growth behavior`
- Q17 (NO FIT): "Example: Evaluate lim x→∞ (√4x^4 + 6x^3 − 7x + 8) / (2x^2 + 7x + 5)"
  - signature: `factor x squared from radical -> divide numerator and denominator by x -> evaluate limit -> calculate ratio`
- Q18 (NO FIT): "1. Find dy/dx if (a) y = x^2"
  - signature: `apply power rule`
- Q19 (NO FIT): "1. Find dy/dx if (b) y = 3x^3 + 5"
  - signature: `differentiate polynomial`
- Q20 (NO FIT): "1. Find dy/dx if (c) y = √2x − 7"
  - signature: `rewrite as fractional exponent -> apply chain rule -> differentiate inner function -> apply power rule -> simplify`
- Q21 (NO FIT): "1. Find dy/dx if (d) y = sin 2x"
  - signature: `apply chain rule -> differentiate inner function -> apply trigonometric derivative rule -> simplify`
- Q22 (NO FIT): "Exercise 2: 1. Prove that if y = x^n, then dy/dx = nx^n−1"
  - signature: `apply limit definition -> expand binomial -> subtract terms -> factor variable -> apply limit -> simplify`
- Q23 (NO FIT): "Exercise 2: 2. Find dy/dx if y = √5x + 8"
  - signature: `rewrite as fractional exponent -> apply chain rule -> differentiate inner function -> apply power rule -> simplify`
- Q24 (NO FIT): "Exercise 2: 3. Find dy/dx given that y = cos 13x"
  - signature: `apply chain rule -> differentiate inner function -> apply trigonometric derivative rule -> simplify`
- Q25 (NO FIT): "Example: If y = x^5, then dy/dx = ?"
  - signature: `differentiate polynomial`
- Q26 (NO FIT): "Example: If y = 8x^6, then dy/dx = ?"
  - signature: `differentiate polynomial`
- Q27 (NO FIT): "Example: If y = x^4 + 5x^3 − 3x^2 + 7x − 9, find dy/dx."
  - signature: `differentiate polynomial`
- Q28 (NO FIT): "Example: If y = x^3 sin x, find dy/dx."
  - signature: `apply product rule -> differentiate polynomial -> apply trigonometric derivative rule`
- Q29 (NO FIT): "Example: If y = (2x^3 − 5) / (x^2 + 6), find dy/dx."
  - signature: `apply quotient rule -> differentiate polynomial -> simplify expression`
- Q30 (NO FIT): "Example: Find dy/dx if (a) y = sin (4x^2 + 5)"
  - signature: `identify components -> apply chain rule -> differentiate inner function -> apply trigonometric derivative rule -> simplify`
- Q31 (NO FIT): "Example: Find dy/dx if (b) y = sin^2 x"
  - signature: `rewrite as power -> apply chain rule -> apply power rule -> apply trigonometric derivative rule -> simplify`
- Q32 (NO FIT): "Example: Find dy/dx if (c) y = e^6x^4"
  - signature: `apply exponential derivative -> differentiate inner function -> simplify`
- Q33 (NO FIT): "Exercise 2: 1. Find dy/dx if y = e^3x^5 / cos(7x^2 − 4x)"
  - signature: `apply quotient rule -> apply exponential derivative -> differentiate inner function -> apply trigonometric derivative rule -> differentiate inner function -> simplify`
- Q34 (NO FIT): "Exercise 2: 2. Find dy/dx if y = (5x^6 − 2x^3 + 4) / (15x^5 − 6)"
  - signature: `apply quotient rule -> differentiate polynomial -> differentiate polynomial -> simplify`
- Q35 (NO FIT): "Exercise 2: 3. Find dy/dx if y = (4x^3 − 5)^16"
  - signature: `identify components -> apply chain rule -> differentiate inner function -> apply power rule -> simplify`
