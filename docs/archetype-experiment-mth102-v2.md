# Archetype Extraction Experiment v2 — MTH 102

Captured 2026-07-26T21:26:58.579Z. Standalone experiment, not wired into any job/queue. No database writes.

## Methodology

- **Step 0 quota check — corrected.** A single test call to the configured primary Gemini model initially succeeded with `usageMetadata.serviceTier: "standard"`, which was read as "billing is active, the 20/day free-tier cap no longer applies." That was wrong: a subsequent full attempt at this experiment hit repeated `429` errors mid-run with the exact same `GenerateRequestsPerDayPerProjectPerModel-FreeTier` quota (`quotaValue: "20"`) from an earlier session today. The single successful test call does not reliably indicate remaining daily quota — treat "the primary model answered once" as no signal at all about whether it will keep answering.
- **Scope reduced to 1 run** (from the original design's 3) as a direct consequence: the full 3-run design needs ~39 model calls against a confirmed hard 20/day cap on the primary model. extractionStability and stabilityScore are therefore NOT measured this run — see Step 3.
- Source (read for extraction/clustering ONLY): "MTH 102 CALCULUS LECTURE NOTES", "MTH 102 LECTURE 1", "MTH 102 LECTURE 1 CONT.".
- Held out (never read until the hold-out phase): "MTH 102 TUTORIAL 2026".
- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.
- Each source document was chunked into ~8000-char windows with ~500-char overlap, producing 21 chunks total. Every chunk was processed — none sampled or truncated.
- Step 1 (extraction) batches 2 chunks per API call for cost/quota reasons; every chunk still gets its own dedicated slot in every batch's prompt and response, none are skipped.
- Step 1 explicitly forbids interpretation/generalization: verbatim problemText + solutionSteps only.
- Step 2 clusters that flat list into archetypes by strict solution-action-sequence equality (power/product/quotient/chain rule kept as separate archetypes, per instruction).
- Ran Steps 1+2 1 time(s), temperature=0.7.
- extractionStability was not computed (only 1 run — nothing to compare across runs).
- stabilityScore was not computed (only 1 run — nothing to compare across runs). The "canonical archetypes" below are simply this single run's Step 2 output.

## Step 1 — extraction counts

### Run 1: 358 examples across 21 chunks

| Chunk | Examples found |
|---|---|
| MTH 102 CALCULUS LECTURE NOTES__chunk0 | 0 |
| MTH 102 CALCULUS LECTURE NOTES__chunk1 | 19 |
| MTH 102 CALCULUS LECTURE NOTES__chunk2 | 18 |
| MTH 102 CALCULUS LECTURE NOTES__chunk3 | 17 |
| MTH 102 CALCULUS LECTURE NOTES__chunk4 | 23 |
| MTH 102 CALCULUS LECTURE NOTES__chunk5 | 11 |
| MTH 102 CALCULUS LECTURE NOTES__chunk6 | 10 |
| MTH 102 CALCULUS LECTURE NOTES__chunk7 | 11 |
| MTH 102 CALCULUS LECTURE NOTES__chunk8 | 17 |
| MTH 102 CALCULUS LECTURE NOTES__chunk9 | 23 |
| MTH 102 CALCULUS LECTURE NOTES__chunk10 | 21 |
| MTH 102 CALCULUS LECTURE NOTES__chunk11 | 38 |
| MTH 102 CALCULUS LECTURE NOTES__chunk12 | 34 |
| MTH 102 CALCULUS LECTURE NOTES__chunk13 | 28 |
| MTH 102 CALCULUS LECTURE NOTES__chunk14 | 27 |
| MTH 102 CALCULUS LECTURE NOTES__chunk15 | 27 |
| MTH 102 CALCULUS LECTURE NOTES__chunk16 | 23 |
| MTH 102 CALCULUS LECTURE NOTES__chunk17 | 2 |
| MTH 102 LECTURE 1__chunk0 | 6 |
| MTH 102 LECTURE 1__chunk1 | 0 |
| MTH 102 LECTURE 1 CONT.__chunk0 | 3 |

## Step 2 — archetypes per run

### Run 1 (39 archetypes)

**Example 1.2. Let A = {1, 2, 3} and B = {x, y}. Then A × B = {(1, x), (1, y), (2,...**
- trigger: A set or relation is defined by listing pairs or a subset rule.
- method: (1) Enumerate the Cartesian product or a subset relation.
- distinctBecause: This archetype focuses on set-theoretic enumeration of relations rather than functional analysis or algebraic simplification.
- memberCount: 6
- canonicalStem: Example 1.2. Let A = {1, 2, 3} and B = {x, y}. Then A × B = {(1, x), (1, y), (2, x), (2, y), (3, x), (3, y)}. The cardinality is |A| · |B| = 3 × 2 = 6.
**Example 1.7. f (x) = 3x − 2 is injective because 3x1 − 2 = 3x2 − 2 implies x1 = ...**
- trigger: A function property (injective, surjective, bijective) is evaluated via definition.
- method: (1) Apply the definition of the property (e.g., f(x1)=f(x2) implies x1=x2 or solve for preimage).
- distinctBecause: This archetype uses formal logic or existence proofs for function properties, unlike algebraic simplification or numerical evaluation.
- memberCount: 16
- canonicalStem: Example 1.7. f (x) = 3x − 2 is injective because 3x1 − 2 = 3x2 − 2 implies x1 = x2.
**Example 1.18. Let f (x) = 5. Find f (0), f (10), and f (−3).**
- trigger: A function value is requested at specific input points.
- method: (1) Substitute the input value into the function expression and calculate the output.
- distinctBecause: This archetype performs simple evaluation at points, whereas others involve limits, derivatives, or set properties.
- memberCount: 5
- canonicalStem: Example 1.18. Let f (x) = 5. Find f (0), f (10), and f (−3).
**Example 1.19. A taxi company charges a at fee of $3 per ride regardless of dista...**
- trigger: A real-world cost or population scenario requires a function model.
- method: (1) Define the function based on constants and variables. (2) Evaluate at given inputs or solve for variables.
- distinctBecause: This archetype models specific word problems with linear or exponential growth/cost, distinct from pure calculus or set theory.
- memberCount: 26
- canonicalStem: Example 1.19. A taxi company charges a at fee of $3 per ride regardless of distance. Write the cost function and state its domain and range.
**Example 1.26. Solve the equation |x − 3| = 5 using the properties of absolute va...**
- trigger: Absolute value inequalities or equations.
- method: (1) Expand the absolute value into compound inequalities or cases. (2) Solve the resulting algebraic inequalities.
- distinctBecause: This archetype specifically solves for x by removing absolute value bars, unlike function property proofs or limit evaluations.
- memberCount: 4
- canonicalStem: Example 1.26. Solve the equation |x − 3| = 5 using the properties of absolute value.
**Example 1.24. Verify the triangle inequality for a = 5 and b = −3.**
- trigger: Triangle inequality verification or proof.
- method: (1) Calculate left and right sides of the inequality for specific numbers or use algebraic properties to prove the general case.
- distinctBecause: This archetype focuses on the specific geometry/algebra of inequalities, not on limit definitions or function evaluation.
- memberCount: 4
- canonicalStem: Example 1.24. Verify the triangle inequality for a = 5 and b = −3.
**Example 1.30. Evaluate sgn(10), sgn(−5), and sgn(0).**
- trigger: Signum or floor/ceiling function graph or property.
- method: (1) Apply the definition of the function (rounding or sign) to specific inputs or intervals.
- distinctBecause: This archetype deals with piecewise-constant functions (rounding), distinct from continuous function calculus or set relations.
- memberCount: 8
- canonicalStem: Example 1.30. Evaluate sgn(10), sgn(−5), and sgn(0).
**Example 1.49. Identify the degree and leading coe cient of P (x) = 4x5 − 3x2 + 2...**
- trigger: Polynomial properties (degree, roots, end behavior, domain).
- method: (1) Inspect coefficients and powers to determine domain or end behavior properties.
- distinctBecause: This archetype focuses on polynomial-specific features like degree and leading coefficients, which are not relevant to other function types.
- memberCount: 4
- canonicalStem: Example 1.49. Identify the degree and leading coe cient of P (x) = 4x5 − 3x2 + 2x − 7.
**Example 1.54. Find the domain of f (x) = x+2 x2−9 .**
- trigger: Rational function asymptotes, holes, or intercepts.
- method: (1) Factor numerator and denominator. (2) Identify cancelled factors as holes and remaining denominator zeros as vertical asymptotes.
- distinctBecause: This archetype is specific to the analysis of rational functions via factorization, unlike logarithmic, exponential, or polynomial analysis.
- memberCount: 17
- canonicalStem: Example 1.54. Find the domain of f (x) = x+2 x2−9 .
**Example 1.71. Evaluate 23, 1 2 4, and e0.**
- trigger: Exponential or logarithmic evaluation/simplification/solving.
- method: (1) Apply log/exp laws (base conversion, product/quotient/power rules). (2) Solve the resulting algebraic equation.
- distinctBecause: This archetype uses specific log/exp algebraic rules, distinct from limit evaluation or calculus.
- memberCount: 8
- canonicalStem: Example 1.71. Evaluate 23, 1 2 4, and e0.
**Example 1.81. Evaluate sin π 6 , cos π 3 , and tan π 4 .**
- trigger: Trigonometric value evaluation or domain.
- method: (1) Evaluate trigonometric functions at standard angles or determine undefined points.
- distinctBecause: This archetype deals with trigonometric unit circle properties, not present in other clusters.
- memberCount: 4
- canonicalStem: Example 1.81. Evaluate sin π 6 , cos π 3 , and tan π 4 .
**Example 1.85. Find the domain and range of f (x) = √x − 3.**
- trigger: Domain of radical or log functions.
- method: (1) Set the argument of the function (under root or in log) to satisfy the required condition (e.g., non-negative).
- distinctBecause: This archetype specifically solves domain restrictions for transcendental/radical functions, separate from rational function domain analysis.
- memberCount: 3
- canonicalStem: Example 1.85. Find the domain and range of f (x) = √x − 3.
**Example 1.91. Find the inverse of f (x) = 2x + 3.**
- trigger: Finding the inverse of a function.
- method: (1) Set y = f(x), solve for x, and swap variables.
- distinctBecause: This archetype is limited to the algebraic process of finding an inverse, unlike checking for injectivity.
- memberCount: 4
- canonicalStem: Example 1.91. Find the inverse of f (x) = 2x + 3.
**Example 1.113. A standard US household outlet supplies 120 V RMS (root mean squa...**
- trigger: AC voltage signal properties.
- method: (1) Apply wave models (sine functions) to determine frequency, period, and peak voltage.
- distinctBecause: This archetype uses physical wave models with frequency parameters, unique from other exponential/polynomial models.
- memberCount: 4
- canonicalStem: Example 1.113. A standard US household outlet supplies 120 V RMS (root mean square) at 60 Hz. The peak voltage is V0 = 120√2 ≈ 169.7 V. Find: (a) The voltage function. (b) The voltage at t = 0.005 seconds. (c) The period. (d) The frequency in radians per second (ω).
**Example 1.117. A drug is administered orally. The absorption rate is ka = 2 per ...**
- trigger: Pharmacokinetic drug concentration models.
- method: (1) Model concentration using sums of exponentials. (2) Evaluate at specific times or find maxima via calculus.
- distinctBecause: This archetype involves specific pharmacokinetic decay/absorption models, distinct from standard exponential growth.
- memberCount: 5
- canonicalStem: Example 1.117. A drug is administered orally. The absorption rate is ka = 2 per hour and the elimination rate is ke = 0.5 per hour. C0 = 10 mg/L. Find: (a) The concentration function. (b) The concentration at t = 1 hour. (c) The concentration at t = 2 hours. (d) What happens to the concentration as t becomes very large?
**Example 2.2. Use the epsilon-delta de nition to prove that limx→2(3x + 1) = 7.**
- trigger: Epsilon-delta limit proof.
- method: (1) Use the epsilon-delta definition to find a delta for a given epsilon.
- distinctBecause: This archetype is the formal definition of a limit, distinct from computational limit evaluations.
- memberCount: 4
- canonicalStem: Example 2.2. Use the epsilon-delta de nition to prove that limx→2(3x + 1) = 7.
**Example 2.7. Find limx→2(3x + 1).**
- trigger: Computational limit evaluation (direct, factoring, one-sided, or trigonometric).
- method: (1) Apply limit laws, factor common terms, or use squeeze theorem/trig identities.
- distinctBecause: This archetype focuses on calculating limits, unlike epsilon-delta proofs or derivative definitions.
- memberCount: 33
- canonicalStem: Example 2.7. Find limx→2(3x + 1).
**Example 2.38 (Business: Marginal Cost as Limit of Average Rate of Change). The m...**
- trigger: Limit definition of marginal cost/revenue or rate of change.
- method: (1) Compute the difference quotient (C(x+h)-C(x))/h and take the limit as h goes to 0.
- distinctBecause: This archetype uses the formal definition of the derivative/marginal rate, distinct from computational limits.
- memberCount: 5
- canonicalStem: Example 2.38 (Business: Marginal Cost as Limit of Average Rate of Change). The marginal cost is de ned as M C(x) = limh→0 C(x+h)−C(x) h . For a cost function C(x) = 1000 + 20x + 0.1x2, nd the marginal cost at x = 100.
**Is f (x) = ( x2, x̸ = 2 5, x = 2 continuous at x = 2?**
- trigger: Continuity verification.
- method: (1) Check if the limit as x approaches a point equals the function value at that point.
- distinctBecause: This archetype verifies continuity using the limit definition, distinct from general limit calculation.
- memberCount: 3
- canonicalStem: Is f (x) = ( x2, x̸ = 2 5, x = 2 continuous at x = 2?
**Show that the equation x3 − 2x − 5 = 0 has a root between 2 and 3.**
- trigger: Intermediate Value Theorem (IVT) application.
- method: (1) Evaluate the function at endpoints. (2) Show the sign change exists to prove the root exists.
- distinctBecause: This archetype proves the existence of roots via the IVT, unlike continuity verification or limit calculations.
- memberCount: 4
- canonicalStem: Show that the equation x3 − 2x − 5 = 0 has a root between 2 and 3.
**Find f ′(2) for f (x) = x2.**
- trigger: Derivative definition via limit.
- method: (1) Calculate the limit of (f(x+h)-f(x))/h.
- distinctBecause: This archetype computes derivatives from the definition, different from using power/product rules.
- memberCount: 7
- canonicalStem: Find f ′(2) for f (x) = x2.
**Find the equations of the tangent and normal lines to f (x) = x2 at x = 3.**
- trigger: Tangent/normal line equation.
- method: (1) Find the derivative at the point for slope. (2) Use point-slope form for the line equation.
- distinctBecause: This archetype constructs geometric lines, unlike derivative calculation or limit application.
- memberCount: 5
- canonicalStem: Find the equations of the tangent and normal lines to f (x) = x2 at x = 3.
**Find f ′(x) for f (x) = 3x5 − 2x3 + 4x − 7.**
- trigger: Derivative calculation using rules (power, product, quotient, chain).
- method: (1) Apply the appropriate derivation rule to the function expression.
- distinctBecause: This archetype uses shortcut rules to differentiate, unlike the limit definition.
- memberCount: 26
- canonicalStem: Find f ′(x) for f (x) = 3x5 − 2x3 + 4x − 7.
**Example 3.38. Find limx→0 sin x x using L'Hôpital's Rule.**
- trigger: L'Hôpital's Rule for limits.
- method: (1) Identify 0/0 or inf/inf indeterminate form. (2) Differentiate numerator and denominator.
- distinctBecause: This archetype uses derivatives to solve limits, distinct from algebraic limit techniques.
- memberCount: 8
- canonicalStem: Example 3.38. Find limx→0 sin x x using L'Hôpital's Rule.
**Example 3.43. Find dy dx for x2 + y2 = 25.**
- trigger: Implicit differentiation.
- method: (1) Differentiate both sides with respect to x, treating y as a function of x.
- distinctBecause: This archetype differentiates relations where y is not isolated, unlike explicit differentiation.
- memberCount: 5
- canonicalStem: Example 3.43. Find dy dx for x2 + y2 = 25.
**Example 3.48. For f (x) = x4 − 3x2, nd f ′(x) and f ′′(x).**
- trigger: Higher-order derivatives.
- method: (1) Differentiate the function repeatedly.
- distinctBecause: This archetype finds derivatives of derivatives, distinct from first-order differentiation.
- memberCount: 6
- canonicalStem: Example 3.48. For f (x) = x4 − 3x2, nd f ′(x) and f ′′(x).
**Example 3.53. A ball is thrown upward with position s(t) = −4.9t2 + 20t + 1. Fin...**
- trigger: Physics motion or business marginal rate (applications of derivatives).
- method: (1) Differentiate the position/cost function to find velocity/marginal value.
- distinctBecause: This archetype applies derivatives to physical or economic rates of change, different from pure differentiation.
- memberCount: 26
- canonicalStem: Example 3.53. A ball is thrown upward with position s(t) = −4.9t2 + 20t + 1. Find the velocity and acceleration at t = 2 seconds.
**Example 4.2. Find R x3 dx.**
- trigger: Indefinite integration (antiderivatives).
- method: (1) Apply basic integration rules to find the antiderivative.
- distinctBecause: This archetype performs indefinite integration, unlike definite integrals or differentiation.
- memberCount: 16
- canonicalStem: Example 4.2. Find R x3 dx.
**Example 4.12. Find R 2xex2 dx.**
- trigger: Integration by substitution (u-substitution).
- method: (1) Identify a function-derivative pair. (2) Substitute u, integrate, and back-substitute.
- distinctBecause: This archetype uses variable substitution, distinct from basic rules or integration by parts.
- memberCount: 9
- canonicalStem: Example 4.12. Find R 2xex2 dx.
**Example 4.17. Find R xex dx.**
- trigger: Integration by parts.
- method: (1) Apply R u dv = uv - R v du.
- distinctBecause: This archetype uses integration by parts, distinct from u-substitution.
- memberCount: 6
- canonicalStem: Example 4.17. Find R xex dx.
**Example 4.22. Find R 1/(x2−4) dx.**
- trigger: Partial fraction decomposition.
- method: (1) Factor denominator. (2) Decompose into partial fractions. (3) Integrate individual terms.
- distinctBecause: This archetype integrates rational functions via decomposition, distinct from other integration techniques.
- memberCount: 5
- canonicalStem: Example 4.22. Find R 1/(x2−4) dx.
**Example 4.27. Find R sin2 x dx.**
- trigger: Trigonometric integration.
- method: (1) Use trig identities to simplify powers or products of trig functions before integrating.
- distinctBecause: This archetype relies on specific trig identity transformations, unlike rational or polynomial integration.
- memberCount: 11
- canonicalStem: Example 4.27. Find R sin2 x dx.
**Example 4.37. Find R √1 − x2 dx.**
- trigger: Trigonometric substitution.
- method: (1) Substitute x = a sin θ, tan θ, or sec θ to eliminate radical expressions.
- distinctBecause: This archetype uses trig sub for radicals, distinct from general trig integration.
- memberCount: 6
- canonicalStem: Example 4.37. Find R √1 − x2 dx.
**Example 5.4. Compute R 2 0 x3 dx.**
- trigger: Definite integrals (calculating area/accumulation).
- method: (1) Find antiderivative. (2) Apply Fundamental Theorem of Calculus: F(b) - F(a).
- distinctBecause: This archetype computes values over intervals, unlike indefinite integrals.
- memberCount: 16
- canonicalStem: Example 5.4. Compute R 2 0 x3 dx.
**Example 5.16. Compute R ∞ 1 1/x2 dx.**
- trigger: Improper integrals.
- method: (1) Express the integral as a limit of a definite integral.
- distinctBecause: This archetype handles infinite intervals or discontinuities, distinct from standard definite integrals.
- memberCount: 5
- canonicalStem: Example 5.16. Compute R ∞ 1 1/x2 dx.
**Example 6.1. Find the area between y = x2 and y = x from x = 0 to x = 1.**
- trigger: Area between curves.
- method: (1) Integrate the difference of the functions over the interval.
- distinctBecause: This archetype calculates geometric area, unlike standard accumulation.
- memberCount: 5
- canonicalStem: Example 6.1. Find the area between y = x2 and y = x from x = 0 to x = 1.
**Example 6.6. Find the volume of the solid obtained by rotating y = √x from x = 0...**
- trigger: Volume of solid of revolution.
- method: (1) Integrate the cross-sectional area (disk/washer) or shell method.
- distinctBecause: This archetype computes 3D volumes, distinct from 2D area.
- memberCount: 10
- canonicalStem: Example 6.6. Find the volume of the solid obtained by rotating y = √x from x = 0 to x = 4 about the x-axis.
**Example 6.15. Find the length of y = x3/2 from x = 0 to x = 4.**
- trigger: Arc length or Surface area.
- method: (1) Integrate the arc length or surface area formula.
- distinctBecause: This archetype computes 1D or 2D geometric features of curves, distinct from volume.
- memberCount: 5
- canonicalStem: Example 6.15. Find the length of y = x3/2 from x = 0 to x = 4.
**Example 6.18. A spring obeys Hooke's law: F (x) = kx, where k is the spring cons...**
- trigger: Work/Economic application of integrals.
- method: (1) Integrate force or demand/supply functions to calculate work or consumer/producer surplus.
- distinctBecause: This archetype applies integration to physics/economics, distinct from pure geometric integration.
- memberCount: 5
- canonicalStem: Example 6.18. A spring obeys Hooke's law: F (x) = kx, where k is the spring constant. Find the work done to stretch the spring from its natural length x = 0 to x = L.

## Step 3 — stability

**Not measured this run.** Scope was reduced to 1 run (see Methodology) after confirming the primary model's 20/day quota was already exhausted partway through a prior attempt today — with only one run, there is nothing to compare across runs. The archetypes below are this single run's Step 2 output, used as-is for the hold-out test.

### Archetypes found (single run — not cross-validated)

0. **Example 1.2. Let A = {1, 2, 3} and B = {x, y}. Then A × B = {(1, x), (1, y), (2,...**
- trigger: A set or relation is defined by listing pairs or a subset rule.
- method: (1) Enumerate the Cartesian product or a subset relation.
- distinctBecause: This archetype focuses on set-theoretic enumeration of relations rather than functional analysis or algebraic simplification.

1. **Example 1.7. f (x) = 3x − 2 is injective because 3x1 − 2 = 3x2 − 2 implies x1 = ...**
- trigger: A function property (injective, surjective, bijective) is evaluated via definition.
- method: (1) Apply the definition of the property (e.g., f(x1)=f(x2) implies x1=x2 or solve for preimage).
- distinctBecause: This archetype uses formal logic or existence proofs for function properties, unlike algebraic simplification or numerical evaluation.

2. **Example 1.18. Let f (x) = 5. Find f (0), f (10), and f (−3).**
- trigger: A function value is requested at specific input points.
- method: (1) Substitute the input value into the function expression and calculate the output.
- distinctBecause: This archetype performs simple evaluation at points, whereas others involve limits, derivatives, or set properties.

3. **Example 1.19. A taxi company charges a at fee of $3 per ride regardless of dista...**
- trigger: A real-world cost or population scenario requires a function model.
- method: (1) Define the function based on constants and variables. (2) Evaluate at given inputs or solve for variables.
- distinctBecause: This archetype models specific word problems with linear or exponential growth/cost, distinct from pure calculus or set theory.

4. **Example 1.26. Solve the equation |x − 3| = 5 using the properties of absolute va...**
- trigger: Absolute value inequalities or equations.
- method: (1) Expand the absolute value into compound inequalities or cases. (2) Solve the resulting algebraic inequalities.
- distinctBecause: This archetype specifically solves for x by removing absolute value bars, unlike function property proofs or limit evaluations.

5. **Example 1.24. Verify the triangle inequality for a = 5 and b = −3.**
- trigger: Triangle inequality verification or proof.
- method: (1) Calculate left and right sides of the inequality for specific numbers or use algebraic properties to prove the general case.
- distinctBecause: This archetype focuses on the specific geometry/algebra of inequalities, not on limit definitions or function evaluation.

6. **Example 1.30. Evaluate sgn(10), sgn(−5), and sgn(0).**
- trigger: Signum or floor/ceiling function graph or property.
- method: (1) Apply the definition of the function (rounding or sign) to specific inputs or intervals.
- distinctBecause: This archetype deals with piecewise-constant functions (rounding), distinct from continuous function calculus or set relations.

7. **Example 1.49. Identify the degree and leading coe cient of P (x) = 4x5 − 3x2 + 2...**
- trigger: Polynomial properties (degree, roots, end behavior, domain).
- method: (1) Inspect coefficients and powers to determine domain or end behavior properties.
- distinctBecause: This archetype focuses on polynomial-specific features like degree and leading coefficients, which are not relevant to other function types.

8. **Example 1.54. Find the domain of f (x) = x+2 x2−9 .**
- trigger: Rational function asymptotes, holes, or intercepts.
- method: (1) Factor numerator and denominator. (2) Identify cancelled factors as holes and remaining denominator zeros as vertical asymptotes.
- distinctBecause: This archetype is specific to the analysis of rational functions via factorization, unlike logarithmic, exponential, or polynomial analysis.

9. **Example 1.71. Evaluate 23, 1 2 4, and e0.**
- trigger: Exponential or logarithmic evaluation/simplification/solving.
- method: (1) Apply log/exp laws (base conversion, product/quotient/power rules). (2) Solve the resulting algebraic equation.
- distinctBecause: This archetype uses specific log/exp algebraic rules, distinct from limit evaluation or calculus.

10. **Example 1.81. Evaluate sin π 6 , cos π 3 , and tan π 4 .**
- trigger: Trigonometric value evaluation or domain.
- method: (1) Evaluate trigonometric functions at standard angles or determine undefined points.
- distinctBecause: This archetype deals with trigonometric unit circle properties, not present in other clusters.

11. **Example 1.85. Find the domain and range of f (x) = √x − 3.**
- trigger: Domain of radical or log functions.
- method: (1) Set the argument of the function (under root or in log) to satisfy the required condition (e.g., non-negative).
- distinctBecause: This archetype specifically solves domain restrictions for transcendental/radical functions, separate from rational function domain analysis.

12. **Example 1.91. Find the inverse of f (x) = 2x + 3.**
- trigger: Finding the inverse of a function.
- method: (1) Set y = f(x), solve for x, and swap variables.
- distinctBecause: This archetype is limited to the algebraic process of finding an inverse, unlike checking for injectivity.

13. **Example 1.113. A standard US household outlet supplies 120 V RMS (root mean squa...**
- trigger: AC voltage signal properties.
- method: (1) Apply wave models (sine functions) to determine frequency, period, and peak voltage.
- distinctBecause: This archetype uses physical wave models with frequency parameters, unique from other exponential/polynomial models.

14. **Example 1.117. A drug is administered orally. The absorption rate is ka = 2 per ...**
- trigger: Pharmacokinetic drug concentration models.
- method: (1) Model concentration using sums of exponentials. (2) Evaluate at specific times or find maxima via calculus.
- distinctBecause: This archetype involves specific pharmacokinetic decay/absorption models, distinct from standard exponential growth.

15. **Example 2.2. Use the epsilon-delta de nition to prove that limx→2(3x + 1) = 7.**
- trigger: Epsilon-delta limit proof.
- method: (1) Use the epsilon-delta definition to find a delta for a given epsilon.
- distinctBecause: This archetype is the formal definition of a limit, distinct from computational limit evaluations.

16. **Example 2.7. Find limx→2(3x + 1).**
- trigger: Computational limit evaluation (direct, factoring, one-sided, or trigonometric).
- method: (1) Apply limit laws, factor common terms, or use squeeze theorem/trig identities.
- distinctBecause: This archetype focuses on calculating limits, unlike epsilon-delta proofs or derivative definitions.

17. **Example 2.38 (Business: Marginal Cost as Limit of Average Rate of Change). The m...**
- trigger: Limit definition of marginal cost/revenue or rate of change.
- method: (1) Compute the difference quotient (C(x+h)-C(x))/h and take the limit as h goes to 0.
- distinctBecause: This archetype uses the formal definition of the derivative/marginal rate, distinct from computational limits.

18. **Is f (x) = ( x2, x̸ = 2 5, x = 2 continuous at x = 2?**
- trigger: Continuity verification.
- method: (1) Check if the limit as x approaches a point equals the function value at that point.
- distinctBecause: This archetype verifies continuity using the limit definition, distinct from general limit calculation.

19. **Show that the equation x3 − 2x − 5 = 0 has a root between 2 and 3.**
- trigger: Intermediate Value Theorem (IVT) application.
- method: (1) Evaluate the function at endpoints. (2) Show the sign change exists to prove the root exists.
- distinctBecause: This archetype proves the existence of roots via the IVT, unlike continuity verification or limit calculations.

20. **Find f ′(2) for f (x) = x2.**
- trigger: Derivative definition via limit.
- method: (1) Calculate the limit of (f(x+h)-f(x))/h.
- distinctBecause: This archetype computes derivatives from the definition, different from using power/product rules.

21. **Find the equations of the tangent and normal lines to f (x) = x2 at x = 3.**
- trigger: Tangent/normal line equation.
- method: (1) Find the derivative at the point for slope. (2) Use point-slope form for the line equation.
- distinctBecause: This archetype constructs geometric lines, unlike derivative calculation or limit application.

22. **Find f ′(x) for f (x) = 3x5 − 2x3 + 4x − 7.**
- trigger: Derivative calculation using rules (power, product, quotient, chain).
- method: (1) Apply the appropriate derivation rule to the function expression.
- distinctBecause: This archetype uses shortcut rules to differentiate, unlike the limit definition.

23. **Example 3.38. Find limx→0 sin x x using L'Hôpital's Rule.**
- trigger: L'Hôpital's Rule for limits.
- method: (1) Identify 0/0 or inf/inf indeterminate form. (2) Differentiate numerator and denominator.
- distinctBecause: This archetype uses derivatives to solve limits, distinct from algebraic limit techniques.

24. **Example 3.43. Find dy dx for x2 + y2 = 25.**
- trigger: Implicit differentiation.
- method: (1) Differentiate both sides with respect to x, treating y as a function of x.
- distinctBecause: This archetype differentiates relations where y is not isolated, unlike explicit differentiation.

25. **Example 3.48. For f (x) = x4 − 3x2, nd f ′(x) and f ′′(x).**
- trigger: Higher-order derivatives.
- method: (1) Differentiate the function repeatedly.
- distinctBecause: This archetype finds derivatives of derivatives, distinct from first-order differentiation.

26. **Example 3.53. A ball is thrown upward with position s(t) = −4.9t2 + 20t + 1. Fin...**
- trigger: Physics motion or business marginal rate (applications of derivatives).
- method: (1) Differentiate the position/cost function to find velocity/marginal value.
- distinctBecause: This archetype applies derivatives to physical or economic rates of change, different from pure differentiation.

27. **Example 4.2. Find R x3 dx.**
- trigger: Indefinite integration (antiderivatives).
- method: (1) Apply basic integration rules to find the antiderivative.
- distinctBecause: This archetype performs indefinite integration, unlike definite integrals or differentiation.

28. **Example 4.12. Find R 2xex2 dx.**
- trigger: Integration by substitution (u-substitution).
- method: (1) Identify a function-derivative pair. (2) Substitute u, integrate, and back-substitute.
- distinctBecause: This archetype uses variable substitution, distinct from basic rules or integration by parts.

29. **Example 4.17. Find R xex dx.**
- trigger: Integration by parts.
- method: (1) Apply R u dv = uv - R v du.
- distinctBecause: This archetype uses integration by parts, distinct from u-substitution.

30. **Example 4.22. Find R 1/(x2−4) dx.**
- trigger: Partial fraction decomposition.
- method: (1) Factor denominator. (2) Decompose into partial fractions. (3) Integrate individual terms.
- distinctBecause: This archetype integrates rational functions via decomposition, distinct from other integration techniques.

31. **Example 4.27. Find R sin2 x dx.**
- trigger: Trigonometric integration.
- method: (1) Use trig identities to simplify powers or products of trig functions before integrating.
- distinctBecause: This archetype relies on specific trig identity transformations, unlike rational or polynomial integration.

32. **Example 4.37. Find R √1 − x2 dx.**
- trigger: Trigonometric substitution.
- method: (1) Substitute x = a sin θ, tan θ, or sec θ to eliminate radical expressions.
- distinctBecause: This archetype uses trig sub for radicals, distinct from general trig integration.

33. **Example 5.4. Compute R 2 0 x3 dx.**
- trigger: Definite integrals (calculating area/accumulation).
- method: (1) Find antiderivative. (2) Apply Fundamental Theorem of Calculus: F(b) - F(a).
- distinctBecause: This archetype computes values over intervals, unlike indefinite integrals.

34. **Example 5.16. Compute R ∞ 1 1/x2 dx.**
- trigger: Improper integrals.
- method: (1) Express the integral as a limit of a definite integral.
- distinctBecause: This archetype handles infinite intervals or discontinuities, distinct from standard definite integrals.

35. **Example 6.1. Find the area between y = x2 and y = x from x = 0 to x = 1.**
- trigger: Area between curves.
- method: (1) Integrate the difference of the functions over the interval.
- distinctBecause: This archetype calculates geometric area, unlike standard accumulation.

36. **Example 6.6. Find the volume of the solid obtained by rotating y = √x from x = 0...**
- trigger: Volume of solid of revolution.
- method: (1) Integrate the cross-sectional area (disk/washer) or shell method.
- distinctBecause: This archetype computes 3D volumes, distinct from 2D area.

37. **Example 6.15. Find the length of y = x3/2 from x = 0 to x = 4.**
- trigger: Arc length or Surface area.
- method: (1) Integrate the arc length or surface area formula.
- distinctBecause: This archetype computes 1D or 2D geometric features of curves, distinct from volume.

38. **Example 6.18. A spring obeys Hooke's law: F (x) = kx, where k is the spring cons...**
- trigger: Work/Economic application of integrals.
- method: (1) Integrate force or demand/supply functions to calculate work or consumer/producer surplus.
- distinctBecause: This archetype applies integration to physics/economics, distinct from pure geometric integration.

## Step 4 — hold-out test (MTH 102 TUTORIAL 2026)

36 worked examples/exercise questions extracted from the hold-out document.

**coverageScore = 36 / 36 = 1.000**

### Tutorial questions that fit NO archetype

_None — every tutorial question fit a canonical archetype._

### Canonical archetypes absent from the tutorial

- "A set or relation is defined by listing pairs or a subset rule."
- "A function property (injective, surjective, bijective) is evaluated via definition."
- "A function value is requested at specific input points."
- "A real-world cost or population scenario requires a function model."
- "Absolute value inequalities or equations."
- "Triangle inequality verification or proof."
- "Signum or floor/ceiling function graph or property."
- "Polynomial properties (degree, roots, end behavior, domain)."
- "Rational function asymptotes, holes, or intercepts."
- "Exponential or logarithmic evaluation/simplification/solving."
- "Trigonometric value evaluation or domain."
- "Domain of radical or log functions."
- "Finding the inverse of a function."
- "AC voltage signal properties."
- "Pharmacokinetic drug concentration models."
- "Epsilon-delta limit proof."
- "Limit definition of marginal cost/revenue or rate of change."
- "Intermediate Value Theorem (IVT) application."
- "Tangent/normal line equation."
- "L'Hôpital's Rule for limits."
- "Implicit differentiation."
- "Higher-order derivatives."
- "Physics motion or business marginal rate (applications of derivatives)."
- "Indefinite integration (antiderivatives)."
- "Integration by substitution (u-substitution)."
- "Integration by parts."
- "Partial fraction decomposition."
- "Trigonometric integration."
- "Trigonometric substitution."
- "Definite integrals (calculating area/accumulation)."
- "Improper integrals."
- "Area between curves."
- "Volume of solid of revolution."
- "Arc length or Surface area."
- "Work/Economic application of integrals."

### Full per-question fit results

- Q0 (FIT — archetype #16): "1. (a) Evaluate lim x→4 (2x^2 − 11x + 12) / (x − 4)"
  - This is a standard limit evaluation requiring factoring or algebraic manipulation.
- Q1 (FIT — archetype #16): "1. (b) Evaluate lim x→0 (√x + 4 − 2) / x"
  - This is a standard limit evaluation requiring rationalization.
- Q2 (FIT — archetype #16): "2. Evaluate the following using limits law (a) lim x→2 (5x^3 − 3x^2 + 5x − 4)"
  - This is a standard limit evaluation using limit laws.
- Q3 (FIT — archetype #16): "2. (b) Evaluate lim x→−1 (6x^4 + 9x^2 − 5x − 3) / (7x^2 + 4x)"
  - This is a standard limit evaluation using limit laws.
- Q4 (FIT — archetype #16): "3. Evaluate the following (a) lim x→3 (2x^5 − 7x^3 + 5x − 6) / (7x^2 − 4x − 5)"
  - This is a standard limit evaluation using limit laws.
- Q5 (FIT — archetype #16): "3. (b) Evaluate lim θ→π/6 (sin θ − cos 2θ) / (2 cos θ + sin 2θ)"
  - This is a standard limit evaluation involving trigonometric functions.
- Q6 (FIT — archetype #16): "4. Evaluate lim x→0 (sin 7x) / (sin 3x)"
  - This is a standard limit evaluation involving trigonometric functions.
- Q7 (FIT — archetype #16): "5. Evaluate lim x→3 (2x^2 − 5x − 3) / (x − 3)"
  - This is a standard limit evaluation requiring factoring.
- Q8 (FIT — archetype #18): "6. Given that f(x) = { 8 − 2x if x > 4, √4 − x if x ≤ 4 }. Show whether the lim x→4 f(x) exists"
  - This requires checking the existence of a limit at a point for a piecewise function.
- Q9 (FIT — archetype #18): "Exercise 1: 1. Show whether lim x→0 (9|x| − 5x) / x exists."
  - This requires checking the existence of a limit involving an absolute value function.
- Q10 (FIT — archetype #16): "Exercise 1: 2. Evaluate lim x→0 (√x + 81 − 9) / 6x"
  - This is a standard limit evaluation requiring rationalization.
- Q11 (FIT — archetype #16): "Exercise 1: 3. Evaluate lim x→−3 (6x^4 − x^3 + 4x^2 − 18) / (5x^2 + 3x + 9)"
  - This is a standard limit evaluation using limit laws.
- Q12 (FIT — archetype #16): "Exercise 1: 4. Evaluate without calculator or Mathematical table lim x→3π/4 (sin x − 2 cos 1/3 x) / (2 cos x + sin 1/3 x)"
  - This is a standard limit evaluation involving trigonometric functions.
- Q13 (FIT — archetype #16): "Example: Evaluate lim x→∞ (x^3 − x)"
  - This is a limit at infinity evaluation.
- Q14 (FIT — archetype #16): "Examples: Evaluate 1. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (2x^4 − 7x^3 − 2x + 6)"
  - This is a limit at infinity evaluation.
- Q15 (FIT — archetype #16): "Examples: Evaluate 2. lim x→∞ (5x^2 + 2x + 9) / (3x^2 − 2x + 8)"
  - This is a limit at infinity evaluation.
- Q16 (FIT — archetype #16): "Examples: Evaluate 3. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (3x^2 + 4x + 1)"
  - This is a limit at infinity evaluation.
- Q17 (FIT — archetype #16): "Example: Evaluate lim x→∞ (√4x^4 + 6x^3 − 7x + 8) / (2x^2 + 7x + 5)"
  - This is a limit at infinity evaluation involving radicals.
- Q18 (FIT — archetype #22): "1. Find dy/dx if (a) y = x^2"
  - This is a standard derivative calculation using the power rule.
- Q19 (FIT — archetype #22): "1. Find dy/dx if (b) y = 3x^3 + 5"
  - This is a standard derivative calculation using the power rule.
- Q20 (FIT — archetype #22): "1. Find dy/dx if (c) y = √2x − 7"
  - This is a standard derivative calculation using the chain rule.
- Q21 (FIT — archetype #22): "1. Find dy/dx if (d) y = sin 2x"
  - This is a standard derivative calculation using the chain rule.
- Q22 (FIT — archetype #20): "Exercise 2: 1. Prove that if y = x^n, then dy/dx = nx^{n−1}"
  - This requires proving the power rule using the limit definition of the derivative.
- Q23 (FIT — archetype #22): "Exercise 2: 2. Find dy/dx if y = √5x + 8"
  - This is a standard derivative calculation using the chain rule.
- Q24 (FIT — archetype #22): "Exercise 2: 3. Find dy/dx given that y = cos 1/3x"
  - This is a standard derivative calculation using the chain rule.
- Q25 (FIT — archetype #22): "Example: If y = x^5, then dy/dx"
  - This is a standard derivative calculation using the power rule.
- Q26 (FIT — archetype #22): "Example: If y = 8x^6, then dy/dx"
  - This is a standard derivative calculation using the power rule.
- Q27 (FIT — archetype #22): "Example: If y = x^4 + 5x^3 − 3x^2 + 7x − 9, find dy/dx."
  - This is a standard derivative calculation using the power rule.
- Q28 (FIT — archetype #22): "Example: If y = x^3 sin x, find dy/dx."
  - This is a standard derivative calculation using the product rule.
- Q29 (FIT — archetype #22): "Example: If y = (2x^3 − 5) / (x^2 + 6)"
  - This is a standard derivative calculation using the quotient rule.
- Q30 (FIT — archetype #22): "Example: Find dy/dx if (a) y = sin(4x^2 + 5)"
  - This is a standard derivative calculation using the chain rule.
- Q31 (FIT — archetype #22): "Example: Find dy/dx if (b) y = sin^2 x"
  - This is a standard derivative calculation using the chain rule.
- Q32 (FIT — archetype #22): "Example: Find dy/dx if (c) y = e^{6x^4}"
  - This is a standard derivative calculation using the chain rule.
- Q33 (FIT — archetype #22): "Exercise 2: 1. Find dy/dx if y = e^{3x^5} cos(7x^2 − 4x)"
  - This is a standard derivative calculation using product and chain rules.
- Q34 (FIT — archetype #22): "Exercise 2: 2. Find dy/dx if y = (5x^6 − 2x^3 + 4) / (15x^5 − 6)"
  - This is a standard derivative calculation using the quotient rule.
- Q35 (FIT — archetype #22): "Exercise 2: 3. Find dy/dx if y = (4x^3 − 5)^{16}"
  - This is a standard derivative calculation using the chain rule.
