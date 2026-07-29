# Archetype Extraction Experiment — MTH 102

Captured 2026-07-26T20:38:01.442Z. Standalone experiment, not wired into any job/queue. No database writes.

## Methodology

- Source (read for archetype extraction ONLY): "MTH 102 CALCULUS LECTURE NOTES", "MTH 102 LECTURE 1", "MTH 102 LECTURE 1 CONT.".
- Held out (never read until the hold-out test phase below): "MTH 102 TUTORIAL 2026".
- No AI-generated Question rows or GeneratedTextbookSection content were read anywhere in this experiment.
- Topic grouping used the 14 nodes of the current GeneratedTextbookOutline for MTH 102 (title/learning_outcome only — not the generated prose).
- Ran extraction 3 times independently, same input, temperature=0.7.
- Cross-run matching/deduplication and hold-out fit-checking were done by a separate, lower-temperature (0.2) model call applying the same "one-sentence distinctBecause" merge rule as the extraction step itself — not string matching, since wording varies run to run.

## 1. Archetypes found per run

### Run 1 (3 archetypes)

**[Functions of a Real Variable]**
- trigger: A problem asks to determine if a function is injective (one-to-one), surjective (onto), or bijective.
- method: For injectivity, assume f(x1) = f(x2) and algebraically solve to show x1 = x2; for surjectivity, set y = f(x), solve for x in terms of y, and verify that x exists for all y in the codomain.
- canonicalStem: Determine if the function f: R -> R defined by f(x) = 2x + 3 is injective, surjective, or bijective.
- distinctBecause: This archetype focuses on formal logical verification of function properties rather than calculating values, graphing, or performing arithmetic operations on function definitions.
**[Functions of a Real Variable]**
- trigger: A problem asks to evaluate or graph functions involving floor (greatest integer) or ceiling (least integer) operators.
- method: Decompose the input value into intervals [n, n+1) or (n-1, n] and apply the definition that the output is the integer boundary of the interval containing the input.
- canonicalStem: Evaluate the expression ⌊3.7⌋ + ⌈-2.3⌉.
- distinctBecause: This archetype is defined by the step-wise nature of the output which remains constant over intervals, unlike continuous or algebraic functions.
**[Functions of a Real Variable]**
- trigger: A problem asks to find the domain, asymptotes, or intercepts of a rational function P(x)/Q(x).
- method: Factor numerator and denominator to identify roots, cancel common factors to locate holes, identify roots of the denominator for vertical asymptotes, and compare degrees of polynomials for horizontal asymptotes.
- canonicalStem: Find the domain, vertical asymptotes, and horizontal asymptote of f(x) = (x^2 - 9) / (x^2 + 4x + 3).
- distinctBecause: This archetype relies on polynomial factorization and degree comparison to analyze the asymptotic behavior of a ratio of functions, which is distinct from evaluating or composing functions.

### Run 2 (5 archetypes)

**[Functions of a Real Variable]**
- trigger: A problem asks to determine if a function f: A -> B is injective, surjective, or bijective.
- method: For injectivity, assume f(x1) = f(x2) and algebraically solve to show x1 = x2; for surjectivity, solve the equation y = f(x) for x in terms of y and verify that x is in the domain A for all y in the codomain B.
- canonicalStem: Determine if the function f: R -> R defined by f(x) = 2x + 3 is injective, surjective, or bijective.
- distinctBecause: This archetype focuses on proving set-theoretic properties of functions via algebraic manipulation of inputs and outputs rather than evaluating or graphing the function.
**[Functions of a Real Variable]**
- trigger: A problem requires finding the domain of a rational function or a function involving square roots or logarithms.
- method: Identify constraints (denominator != 0, radicand >= 0, logarithm argument > 0), set up the corresponding inequalities or equations, and solve for the valid set of x values.
- canonicalStem: Find the domain of the function f(x) = sqrt(x - 3) / (x^2 - 4).
- distinctBecause: This archetype solely determines the valid input set for a function based on algebraic constraints, whereas other archetypes evaluate the function, determine its mapping properties, or perform calculus operations on it.
**[Graphs, Limits, and Continuity]**
- trigger: A problem asks to evaluate a limit of a rational function as x approaches a value where the denominator is zero.
- method: Factor both the numerator and denominator to identify common factors, cancel the common terms to remove the singularity, and then substitute the limit value into the simplified expression.
- canonicalStem: Evaluate the limit as x approaches 2 of (x^2 - 4) / (x - 2).
- distinctBecause: This archetype addresses removable singularities in limits, whereas other limit archetypes involve either L'Hôpital's Rule for indeterminate forms or epsilon-delta proofs for formal definitions.
**[Differentiation]**
- trigger: A problem asks for the derivative of a function composed of products, quotients, or nested functions.
- method: Identify the functional structure (product, quotient, or composite), apply the appropriate differentiation rule (Product, Quotient, or Chain Rule) systematically, and simplify the resulting expression.
- canonicalStem: Find the derivative of f(x) = x^2 * sin(x) / (x + 1).
- distinctBecause: This archetype utilizes specific rules of differentiation to find the rate of change of a function, distinct from the limit-based definition of the derivative or applications to physical/economic models.
**[Integration]**
- trigger: A problem asks for the indefinite integral of a function that is not a basic elementary form.
- method: Select an integration technique (Substitution, Integration by Parts, or Partial Fractions) based on the integrand's structure, perform the transformation, and evaluate the integral.
- canonicalStem: Evaluate the indefinite integral of x * e^x dx.
- distinctBecause: This archetype focuses on selecting and executing a specific integration strategy to find an antiderivative, as opposed to evaluating definite integrals or solving application-based integrals.

### Run 3 (6 archetypes)

**[Functions of a Real Variable]**
- trigger: A relation is provided as a set of ordered pairs or a mapping diagram between two finite sets.
- method: Check if each element in the domain has exactly one image in the codomain; if any element in the domain maps to multiple elements in the codomain, it is not a function.
- canonicalStem: Given A = {1, 2, 3} and B = {4, 5, 6}, determine if the relation R = {(1, 4), (1, 5), (2, 6)} is a function from A to B.
- distinctBecause: This archetype evaluates the fundamental definition of a function via discrete set mapping rather than algebraic manipulation or limit analysis.
**[Functions of a Real Variable]**
- trigger: An algebraic expression defining a function f(x) and a request to determine if it is injective, surjective, or bijective.
- method: To test injectivity, assume f(x1) = f(x2) and solve for x1 = x2; to test surjectivity, set y = f(x) and solve for x in terms of y to verify if a preimage exists for every y in the codomain.
- canonicalStem: Determine if the function f: R -> R defined by f(x) = 3x - 5 is injective, surjective, or bijective.
- distinctBecause: This archetype focuses on formal property verification of functions using algebraic solving rather than set-based mapping or calculus-based properties.
**[Functions of a Real Variable]**
- trigger: A piecewise-defined function involving floor, ceiling, or absolute value expressions.
- method: Evaluate the function by identifying the interval containing the input and applying the specific rule defined for that interval.
- canonicalStem: Evaluate f(x) = floor(x) at x = 2.7, x = -1.2, and x = 3.
- distinctBecause: This archetype requires interval-based logic and integer rounding rules unique to step-functions, unlike general algebraic or continuous functions.
**[Definitions and Properties of Limits]**
- trigger: A limit expression lim(x->a) f(x) where f(x) is a rational function that results in 0/0 form.
- method: Factor the numerator and denominator to cancel the common term causing the zero, then substitute the limit value into the simplified expression.
- canonicalStem: Evaluate the limit: lim(x->3) (x^2 - 9) / (x - 3).
- distinctBecause: This archetype specifically uses algebraic simplification to resolve indeterminate forms, differing from epsilon-delta proofs or L'Hôpital's rule application.
**[Techniques of Differentiation]**
- trigger: A function defined as a product or quotient of two simpler functions.
- method: Apply the product rule (f'g + fg') or the quotient rule ((f'g - fg')/g^2) to compute the derivative.
- canonicalStem: Find the derivative of f(x) = x^2 * sin(x).
- distinctBecause: This archetype uses structural differentiation rules based on function composition types, distinct from power rule applications or chain rule scenarios.
**[Methods of Integration]**
- trigger: An integral containing a function and its derivative (or a scalar multiple thereof).
- method: Identify a substitution u = g(x) such that du = g'(x)dx, transform the integral into terms of u, integrate, and substitute back.
- canonicalStem: Evaluate the integral: integral of 2x * e^(x^2) dx.
- distinctBecause: This archetype uses variable transformation to simplify integrals, which is fundamentally different from integration by parts or partial fraction decomposition.

## 2 & 3. Canonical archetypes and stability

**stabilityScore = 1 / 8 = 0.125**

(archetypes appearing in all 3 runs / total distinct canonical archetypes found across all runs)

### All canonical archetypes

0. **[Functions of a Real Variable]**
- trigger: A problem asks to determine if a function is injective (one-to-one), surjective (onto), or bijective.
- method: For injectivity, assume f(x1) = f(x2) and algebraically solve to show x1 = x2; for surjectivity, set y = f(x), solve for x in terms of y, and verify that a preimage x exists for all y in the codomain.
- canonicalStem: Determine if the function f: R -> R defined by f(x) = 2x + 3 is injective, surjective, or bijective.
- distinctBecause: This archetype focuses on formal logical verification of function properties via algebraic manipulation rather than graphing, evaluating, or set-based mapping.
- foundInRuns: [1, 2, 3] — STABLE

1. **[Functions of a Real Variable]**
- trigger: A problem asks to evaluate or graph functions involving floor (greatest integer) or ceiling (least integer) operators.
- method: Decompose the input value into intervals and apply the definition that the output is the integer boundary of the interval containing the input.
- canonicalStem: Evaluate the expression ⌊3.7⌋ + ⌈-2.3⌉.
- distinctBecause: This archetype is defined by the step-wise nature of the output which remains constant over intervals, requiring interval-based logic unique to step-functions.
- foundInRuns: [1, 3] — UNSTABLE

2. **[Functions of a Real Variable]**
- trigger: A problem asks to find the domain, asymptotes, or intercepts of a rational function P(x)/Q(x).
- method: Factor numerator and denominator to identify roots, cancel common factors to locate holes, identify roots of the denominator for vertical asymptotes, and compare degrees of polynomials for horizontal asymptotes.
- canonicalStem: Find the domain, vertical asymptotes, and horizontal asymptote of f(x) = (x^2 - 9) / (x^2 + 4x + 3).
- distinctBecause: This archetype relies on polynomial factorization and degree comparison to analyze the asymptotic behavior of a ratio of functions.
- foundInRuns: [1] — UNSTABLE

3. **[Functions of a Real Variable]**
- trigger: A problem requires finding the domain of a function involving square roots, logarithms, or rational expressions.
- method: Identify constraints (denominator != 0, radicand >= 0, logarithm argument > 0), set up the corresponding inequalities or equations, and solve for the valid set of x values.
- canonicalStem: Find the domain of the function f(x) = sqrt(x - 3) / (x^2 - 4).
- distinctBecause: This archetype solely determines the valid input set for a function based on algebraic constraints.
- foundInRuns: [2] — UNSTABLE

4. **[Functions of a Real Variable]**
- trigger: A relation is provided as a set of ordered pairs or a mapping diagram between two finite sets.
- method: Check if each element in the domain has exactly one image in the codomain; if any element in the domain maps to multiple elements in the codomain, it is not a function.
- canonicalStem: Given A = {1, 2, 3} and B = {4, 5, 6}, determine if the relation R = {(1, 4), (1, 5), (2, 6)} is a function from A to B.
- distinctBecause: This archetype evaluates the fundamental definition of a function via discrete set mapping rather than algebraic manipulation.
- foundInRuns: [3] — UNSTABLE

5. **[Graphs, Limits, and Continuity]**
- trigger: A problem asks to evaluate a limit of a rational function as x approaches a value where the denominator is zero (0/0 form).
- method: Factor both the numerator and denominator to identify and cancel common factors to remove the singularity, then substitute the limit value into the simplified expression.
- canonicalStem: Evaluate the limit as x approaches 2 of (x^2 - 4) / (x - 2).
- distinctBecause: This archetype addresses removable singularities in limits using algebraic simplification, distinct from L'Hôpital's Rule or epsilon-delta proofs.
- foundInRuns: [2, 3] — UNSTABLE

6. **[Differentiation]**
- trigger: A problem asks for the derivative of a function composed of products, quotients, or nested functions.
- method: Identify the functional structure (product, quotient, or composite), apply the appropriate differentiation rule (Product, Quotient, or Chain Rule) systematically, and simplify the resulting expression.
- canonicalStem: Find the derivative of f(x) = x^2 * sin(x) / (x + 1).
- distinctBecause: This archetype utilizes specific structural rules of differentiation to find the rate of change of a function.
- foundInRuns: [2, 3] — UNSTABLE

7. **[Integration]**
- trigger: A problem asks for the indefinite integral of a function that is not a basic elementary form.
- method: Select an integration technique (Substitution, Integration by Parts, or Partial Fractions) based on the integrand's structure, perform the transformation, and evaluate the integral.
- canonicalStem: Evaluate the indefinite integral of x * e^x dx.
- distinctBecause: This archetype focuses on selecting and executing a specific integration strategy to find an antiderivative.
- foundInRuns: [2, 3] — UNSTABLE

### Unstable archetypes (appeared in 1 or 2 runs only)

- [Functions of a Real Variable] "A problem asks to evaluate or graph functions involving floor (greatest integer) or ceiling (least integer) operators." — found in run(s) [1, 3]
- [Functions of a Real Variable] "A problem asks to find the domain, asymptotes, or intercepts of a rational function P(x)/Q(x)." — found in run(s) [1]
- [Functions of a Real Variable] "A problem requires finding the domain of a function involving square roots, logarithms, or rational expressions." — found in run(s) [2]
- [Functions of a Real Variable] "A relation is provided as a set of ordered pairs or a mapping diagram between two finite sets." — found in run(s) [3]
- [Graphs, Limits, and Continuity] "A problem asks to evaluate a limit of a rational function as x approaches a value where the denominator is zero (0/0 form)." — found in run(s) [2, 3]
- [Differentiation] "A problem asks for the derivative of a function composed of products, quotients, or nested functions." — found in run(s) [2, 3]
- [Integration] "A problem asks for the indefinite integral of a function that is not a basic elementary form." — found in run(s) [2, 3]

## Hold-out test — MTH 102 TUTORIAL 2026

36 worked examples/exercise questions extracted from the hold-out document.

**coverageScore = 20 / 36 = 0.556**

(tutorial questions that fit a canonical archetype / total tutorial questions)

### 5. Tutorial questions that fit NO archetype

- Q1: "1. (b) Evaluate lim x→0 (√x + 4 − 2) / x"
  - reason: Requires rationalizing the numerator, which is not covered by the provided archetypes.
- Q2: "2. Evaluate the following using limits law (a) lim x→2 (5x^3 − 3x^2 + 5x − 4)"
  - reason: Direct substitution limit evaluation is not covered by the provided archetypes.
- Q3: "2. Evaluate the following using limits law (b) lim x→−1 (6x^4 + 9x^2 − 5x − 3) / (7x^2 + 4x)"
  - reason: Direct substitution limit evaluation is not covered by the provided archetypes.
- Q4: "3. Evaluate the following (a) lim x→3 (2x^5 − 7x^3 + 5x − 6) / (7x^2 − 4x − 5)"
  - reason: Direct substitution limit evaluation is not covered by the provided archetypes.
- Q5: "3. Evaluate the following (b) lim θ→ π/6 (sin θ − cos 2θ) / (2 cos θ + sin 2θ)"
  - reason: Direct substitution limit evaluation is not covered by the provided archetypes.
- Q6: "4. Evaluate lim x→0 (sin 7x) / (sin 3x)"
  - reason: Trigonometric limit evaluation is not covered by the provided archetypes.
- Q8: "6. Given that f (x) = 8 − 2x if x > 4, √4 − x if x ≤ 4. Show whether the lim x→4 f (x) exists"
  - reason: Piecewise limit evaluation is not covered by the provided archetypes.
- Q9: "Exercise 1: 1. Show whether lim x→0 (9|x| − 5x) / x exists."
  - reason: Absolute value limit evaluation is not covered by the provided archetypes.
- Q10: "Exercise 1: 2. Evaluate lim x→0 (√x + 81 − 9) / 6x"
  - reason: Requires rationalizing the numerator, which is not covered by the provided archetypes.
- Q11: "Exercise 1: 3. Evaluate lim x→−3 (6x^4 − x^3 + 4x^2 − 18) / (5x^2 + 3x + 9)"
  - reason: Direct substitution limit evaluation is not covered by the provided archetypes.
- Q12: "Exercise 1: 4. Evaluate without calculator or Mathematical table lim x→ 3π/4 (sin x − 2 cos 1/3 x) / (2 cos x + sin 1/3 x)"
  - reason: Direct substitution limit evaluation is not covered by the provided archetypes.
- Q13: "Example: Evaluate lim x→∞ (x^3 − x)"
  - reason: Limits at infinity are not covered by the provided archetypes.
- Q14: "Examples: Evaluate the following 1. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (2x^4 − 7x^3 − 2x + 6)"
  - reason: Limits at infinity are not covered by the provided archetypes.
- Q15: "Examples: Evaluate the following 2. lim x→∞ (5x^2 + 2x + 9) / (3x^2 − 2x + 8)"
  - reason: Limits at infinity are not covered by the provided archetypes.
- Q16: "Examples: Evaluate the following 3. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (3x^2 + 4x + 1)"
  - reason: Limits at infinity are not covered by the provided archetypes.
- Q17: "Example: Evaluate lim x→∞ (√4x^4 + 6x^3 − 7x + 8) / (2x^2 + 7x + 5)"
  - reason: Limits at infinity are not covered by the provided archetypes.

### 6. Canonical archetypes that appear NOWHERE in the tutorial

- [Functions of a Real Variable] "A problem asks to determine if a function is injective (one-to-one), surjective (onto), or bijective."
- [Functions of a Real Variable] "A problem asks to evaluate or graph functions involving floor (greatest integer) or ceiling (least integer) operators."
- [Functions of a Real Variable] "A problem asks to find the domain, asymptotes, or intercepts of a rational function P(x)/Q(x)."
- [Functions of a Real Variable] "A problem requires finding the domain of a function involving square roots, logarithms, or rational expressions."
- [Functions of a Real Variable] "A relation is provided as a set of ordered pairs or a mapping diagram between two finite sets."
- [Integration] "A problem asks for the indefinite integral of a function that is not a basic elementary form."

### Full per-question fit results

- Q0 (FIT — archetype #5 [Graphs, Limits, and Continuity]): "1. (a) Evaluate lim x→4 (2x^2 − 11x + 12) / (x − 4)"
  - This is a 0/0 indeterminate form requiring factoring and cancellation.
- Q1 (NO FIT — no match): "1. (b) Evaluate lim x→0 (√x + 4 − 2) / x"
  - Requires rationalizing the numerator, which is not covered by the provided archetypes.
- Q2 (NO FIT — no match): "2. Evaluate the following using limits law (a) lim x→2 (5x^3 − 3x^2 + 5x − 4)"
  - Direct substitution limit evaluation is not covered by the provided archetypes.
- Q3 (NO FIT — no match): "2. Evaluate the following using limits law (b) lim x→−1 (6x^4 + 9x^2 − 5x − 3) / (7x^2 + 4x)"
  - Direct substitution limit evaluation is not covered by the provided archetypes.
- Q4 (NO FIT — no match): "3. Evaluate the following (a) lim x→3 (2x^5 − 7x^3 + 5x − 6) / (7x^2 − 4x − 5)"
  - Direct substitution limit evaluation is not covered by the provided archetypes.
- Q5 (NO FIT — no match): "3. Evaluate the following (b) lim θ→ π/6 (sin θ − cos 2θ) / (2 cos θ + sin 2θ)"
  - Direct substitution limit evaluation is not covered by the provided archetypes.
- Q6 (NO FIT — no match): "4. Evaluate lim x→0 (sin 7x) / (sin 3x)"
  - Trigonometric limit evaluation is not covered by the provided archetypes.
- Q7 (FIT — archetype #5 [Graphs, Limits, and Continuity]): "5. Evaluate lim x→3 (2x^2 − 5x − 3) / (x − 3)"
  - This is a 0/0 indeterminate form requiring factoring and cancellation.
- Q8 (NO FIT — no match): "6. Given that f (x) = 8 − 2x if x > 4, √4 − x if x ≤ 4. Show whether the lim x→4 f (x) exists"
  - Piecewise limit evaluation is not covered by the provided archetypes.
- Q9 (NO FIT — no match): "Exercise 1: 1. Show whether lim x→0 (9|x| − 5x) / x exists."
  - Absolute value limit evaluation is not covered by the provided archetypes.
- Q10 (NO FIT — no match): "Exercise 1: 2. Evaluate lim x→0 (√x + 81 − 9) / 6x"
  - Requires rationalizing the numerator, which is not covered by the provided archetypes.
- Q11 (NO FIT — no match): "Exercise 1: 3. Evaluate lim x→−3 (6x^4 − x^3 + 4x^2 − 18) / (5x^2 + 3x + 9)"
  - Direct substitution limit evaluation is not covered by the provided archetypes.
- Q12 (NO FIT — no match): "Exercise 1: 4. Evaluate without calculator or Mathematical table lim x→ 3π/4 (sin x − 2 cos 1/3 x) / (2 cos x + sin 1/3 x)"
  - Direct substitution limit evaluation is not covered by the provided archetypes.
- Q13 (NO FIT — no match): "Example: Evaluate lim x→∞ (x^3 − x)"
  - Limits at infinity are not covered by the provided archetypes.
- Q14 (NO FIT — no match): "Examples: Evaluate the following 1. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (2x^4 − 7x^3 − 2x + 6)"
  - Limits at infinity are not covered by the provided archetypes.
- Q15 (NO FIT — no match): "Examples: Evaluate the following 2. lim x→∞ (5x^2 + 2x + 9) / (3x^2 − 2x + 8)"
  - Limits at infinity are not covered by the provided archetypes.
- Q16 (NO FIT — no match): "Examples: Evaluate the following 3. lim x→∞ (8x^3 − 6x^2 − 5x + 9) / (3x^2 + 4x + 1)"
  - Limits at infinity are not covered by the provided archetypes.
- Q17 (NO FIT — no match): "Example: Evaluate lim x→∞ (√4x^4 + 6x^3 − 7x + 8) / (2x^2 + 7x + 5)"
  - Limits at infinity are not covered by the provided archetypes.
- Q18 (FIT — archetype #6 [Differentiation]): "1. Find dy/dx if (a) y = x^2"
  - Basic power rule differentiation is a subset of the differentiation archetype.
- Q19 (FIT — archetype #6 [Differentiation]): "1. Find dy/dx if (b) y = 3x^3 + 5"
  - Basic differentiation rule application.
- Q20 (FIT — archetype #6 [Differentiation]): "1. Find dy/dx if (c) y = √2x − 7"
  - Chain rule application for a composite function.
- Q21 (FIT — archetype #6 [Differentiation]): "1. Find dy/dx if (d) y = sin 2x"
  - Chain rule application for a trigonometric function.
- Q22 (FIT — archetype #6 [Differentiation]): "Exercise 2: 1. Prove that if y = x^n, then dy/dx = nx^n−1"
  - Differentiation rule application.
- Q23 (FIT — archetype #6 [Differentiation]): "Exercise 2: 2. Find dy/dx if y = √5x + 8"
  - Chain rule application.
- Q24 (FIT — archetype #6 [Differentiation]): "Exercise 2: 3. Find dy/dx given that y = cos 1/3 x"
  - Chain rule application.
- Q25 (FIT — archetype #6 [Differentiation]): "Example: If y = x^5, then dy/dx = 5x^4"
  - Basic power rule differentiation.
- Q26 (FIT — archetype #6 [Differentiation]): "Example: If y = 8x^6, then dy/dx = d/dx(8x^6) = 8 d/dx(x^6) = 8(6x^5) = 48x^5"
  - Basic power rule differentiation.
- Q27 (FIT — archetype #6 [Differentiation]): "Example: If y = x^4 + 5x^3 − 3x^2 + 7x − 9, find dy/dx."
  - Sum rule differentiation.
- Q28 (FIT — archetype #6 [Differentiation]): "Example: If y = x^3 sin x, find dy/dx."
  - Product rule application.
- Q29 (FIT — archetype #6 [Differentiation]): "Example: If y = (2x^3 − 5) / (x^2 + 6)"
  - Quotient rule application.
- Q30 (FIT — archetype #6 [Differentiation]): "Example: Find dy/dx if (a) y = sin (4x^2 + 5)"
  - Chain rule application.
- Q31 (FIT — archetype #6 [Differentiation]): "Example: Find dy/dx if (b) y = sin^2 x"
  - Chain rule application.
- Q32 (FIT — archetype #6 [Differentiation]): "Example: Find dy/dx if (c) y = e^(6x^4)"
  - Chain rule application.
- Q33 (FIT — archetype #6 [Differentiation]): "Exercise 2: 1. Find dy/dx if y = e^(3x^5) cos(7x^2 − 4x)"
  - Product and chain rule application.
- Q34 (FIT — archetype #6 [Differentiation]): "Exercise 2: 2. Find dy/dx if y = (5x^6 − 2x^3 + 4) / (15x^5 − 6)"
  - Quotient rule application.
- Q35 (FIT — archetype #6 [Differentiation]): "Exercise 2: 3. Find dy/dx if y = (4x^3 − 5)^16"
  - Chain rule application.
