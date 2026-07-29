# Archetype Extraction Experiment v7 — PHY 102 (generalization test)

Captured 2026-07-27T00:28:56.430Z. Standalone experiment, not wired into any job/queue. No database writes (vocabulary/cache files and this report are the only file artifacts).

## Methodology

- **Generalization test**: same method as v6 (extract -> label steps -> normalize -> consolidate into a closed vocabulary -> split catch-alls -> classify DISCRIMINATING/GENERIC by fixed rule, no model-judged classification -> exact discriminating-only signature match, empty -> `DIRECT_EVALUATION`), applied fresh to PHY 102 with no hand-tuning and no reuse of MTH102's vocabulary.
- Source materials: "PHY 102 ELECTRIC, MAGNETISM AND MODERN PHYSICS", "GENERAL PHYSICS I  (2)". "PHY 101 MATERIAL" was excluded — it is cross-listed under both PHY 102 and PHY 108 (identical content, confirmed by matching byte length), so including it would not be PHY-102-specific source material.
- No held-out tutorial document exists for PHY 102, so the hold-out is a random 20% of the extracted examples, set aside (seed=20260727) before any labeling, normalization, or vocabulary work touched the data. The other 80% built the vocabulary and archetypes.
- Catch-all identification (which consolidated entries needed splitting) was done by manual inspection of alias counts, the same way it was originally done for MTH102 — not an automated threshold.
- Held-out examples were labeled in batches of at most 5, hard-constrained to the frozen vocabulary or "UNMAPPED". Closed-vocabulary violations coerced in code: 0.
- Model usage per phase:
  - step6-label-holdout: gemini-3.1-flash-lite x3

## Extraction and vocabulary

**74 examples extracted** (59 training, 15 held out).

**Vocabulary: 157 entries** (55 DISCRIMINATING, 102 GENERIC).

## Archetypes (built from the 80% training set)

**36 archetypes**, 32 singletons. `DIRECT_EVALUATION` covers **21** of 59 training examples (35.6%).

### Largest 10 archetypes by member count

- **[memberCount=21]** `DIRECT_EVALUATION`
  - canonicalStem: _(many different trivial problems)_
- **[memberCount=2]** `calculate angular frequency`
  - canonicalStem: (2b) What is the capacitance of the capacitor required in series with a 40-mH inductance coil to provide a circuit which resonates at a frequency of 60Hz?
- **[memberCount=2]** `state photoelectric equation`
  - canonicalStem: Quanta of wavelenght 6000 A0 strike the surface of a metal whose
work function is 1.0 eV. What is the maximum kinetic energy that a
photoelectron can have?
- **[memberCount=2]** `apply dimensional analysis`
  - canonicalStem: The period P of a simple pendulum is the time for one complete swing. How does P depend on the mass m of the bob, the length l of the string, and the acceleration due to gravity g?
- **[memberCount=1]** `apply superposition principle -> apply Coulomb's law -> apply Coulomb's law`
  - canonicalStem: In figure 3., q1 = 1.0μc, q2.0μc and q3 = 4.0μc. Find the electrostatic force on q1 to the two other charges. You should express your result as a magnitude and direction.
- **[memberCount=1]** `apply electric field formula -> apply electric field formula -> apply superposition principle -> apply electric field formula -> apply electric field formula -> resolve into components -> apply superposition principle`
  - canonicalStem: An electric field is set up by two point charges q1 and q2 such that q1 = -q2 = 12 x 10-9 C and separated by a distance of 0.1m as shown in figure 3.3. Find the electric field at the points A and B.
- **[memberCount=1]** `apply flux integral definition`
  - canonicalStem: Figure 3.2 shows a closed surface S in the form of a cylinder of radius R situated in a uniform electric field F, the axis of the cylinder being parallel to the field. What is the flux φ of the electric field through this closed surface?
- **[memberCount=1]** `define Gaussian surface -> apply Gauss's law`
  - canonicalStem: Example 1. Use Gauss’s law to derive the expression for the electric field of a point charge.
- **[memberCount=1]** `apply Coulomb's law`
  - canonicalStem: We wish to find the potential at point A in the field of an isolated point charge +Q situated at point 0, such that 0 A = r as shown in fig. 3.2.

Let us imagine a very small point charge +Qo is moved by an external agent from C distance x from A, through a very small distance δx to B without affecting the field due to +Q.

Assuming the force F on Qo due to the field remains constant over, δx, the work δW by the external agent over δx against the force of the field is
- **[memberCount=1]** `sum pairwise potential energies`
  - canonicalStem: Example 1
Three charges are arranged as shown in figure 3.6. What is their electrostatic
potential energy? Assume q = 1.0x10-5C, and d = 0.1m
+2q
d d
d
+q -4q

## Hold-out test (random 20%, unseen during vocabulary/archetype building)

15 held-out examples.

**coverageScore = 14 / 15 = 0.933**

Of the 14 fits, **14** matched `DIRECT_EVALUATION`.

Total UNMAPPED step labels: 5.

### Full per-example results

- phy11 (FIT, 0 UNMAPPED): "Calculate the area of the plates of a 1F parallel plate capacitor in
vacuum if the separation of the plates is 1mm. Comm"
  - signature: `DIRECT_EVALUATION`
- phy13 (FIT, 0 UNMAPPED): "A parallel capacitor consists of two square plates each of side
25cm, 3.0mm apart. If a p.d. of 200v is applied, calcula"
  - signature: `DIRECT_EVALUATION`
- phy15 (FIT, 0 UNMAPPED): "The resistance of a copper coil at 20°C is 300l. Calculate the
resistance of the coil at 60°C if the temperature coeffic"
  - signature: `DIRECT_EVALUATION`
- phy17 (FIT, 0 UNMAPPED): "Example 1
E11r1
c d
R1
I1
E21r1
a b
I2 R2
R3
f e
I3
Fig 3.4
In the figure 3.4, let magnitudes and directions of the e.m."
  - signature: `DIRECT_EVALUATION`
- phy23 (FIT, 0 UNMAPPED): "1. An electron is moving horizontally to the right at a speed or
4.0 x106ms-1. It enters a region of length 20cm in whic"
  - signature: `DIRECT_EVALUATION`
- phy25 (NO FIT, 0 UNMAPPED): "Example 1
In an experiment analyzing an aqueous solution of CUS04 between
CU electrodes, 0.477g of CU are deposited on t"
  - signature: `apply Faraday's law of electrolysis`
- phy31 (FIT, 0 UNMAPPED): "A coffee percolator is rated at 800 W.
(a) How many calories of heat does it generate in 100s ?
(b) What time would be r"
  - signature: `DIRECT_EVALUATION`
- phy35 (FIT, 0 UNMAPPED): "Example
A tangent galvanometer has a coil of 2 turn of mean radius 7.5cm, which is set with its plane in the magnetic me"
  - signature: `DIRECT_EVALUATION`
- phy41 (FIT, 0 UNMAPPED): "2. Find the magnitude of the induced e.m.f. in a 200-turn coil with cross-sectional area of 0.16m2 if the magnetic field"
  - signature: `DIRECT_EVALUATION`
- phy42 (FIT, 0 UNMAPPED): "(b) A straight wire of length 50cm and resistance 10ohm moves sideways with velocity of 15ms-1 at right angles to a unif"
  - signature: `DIRECT_EVALUATION`
- phy49 (FIT, 0 UNMAPPED): "The instantaneous voltage V and current I are given in SI units by
V = -155cos (377t - π/2)
I = 2.0sin 377t
Find the pha"
  - signature: `DIRECT_EVALUATION`
- phy61 (FIT, 0 UNMAPPED): "The work function of cesium surface is 2.0eV:
(a) find the maximum kinetic energy of the ejected electrons
when the surf"
  - signature: `DIRECT_EVALUATION`
- phy68 (FIT, 0 UNMAPPED): "Two rail cars A and B with masses mA = 1.2 x 104 kg and mB = 8 x 10 3 kg can
roll freely on a horizontal track. A locomo"
  - signature: `DIRECT_EVALUATION`
- phy69 (FIT, 0 UNMAPPED): "A 5kg block is on a horizontal surface for which 2 . 0 = s 
μ and 1 . 0 = k 
μ . It is
pulled by a 10N force directed at"
  - signature: `DIRECT_EVALUATION`
- phy72 (FIT, 5 UNMAPPED): "2. At what temperature are the Fahrenheit and Celsius scales equal?"
  - signature: `DIRECT_EVALUATION`

## Follow-up A — DIRECT_EVALUATION scoring bug fix

Captured 2026-07-27. Recomputed entirely from already-cached per-question results (fits + UNMAPPED count). Zero AI calls.

**Bug**: a question's discriminating-only signature is built by dropping both GENERIC *and* UNMAPPED labels. That means a question with UNMAPPED steps could resolve to an empty signature — and empty was being scored as a `DIRECT_EVALUATION` fit — indistinguishably from a question whose steps were genuinely all GENERIC. An UNMAPPED step means the vocabulary didn't recognize what the problem needed, which is never a success.

**Fix**: a question only counts as `DIRECT_EVALUATION` if it has zero UNMAPPED steps. Any UNMAPPED step forces NO FIT, regardless of what the resulting signature would otherwise have been.

**PHY 102 (this experiment)**: coverageScore drops from **14/15 (0.933) to 13/15 (0.867)**. One question flips: `phy72` (5 of 5 steps UNMAPPED, previously silently absorbed into `DIRECT_EVALUATION`) is now correctly NO FIT. Of the 13 corrected fits, **all 13 are still `DIRECT_EVALUATION`** — the genuine-technique-match count in the hold-out remains 0 of 15, unchanged by this fix (it was already 0 under the old rule too; the fix only removes a false positive, it doesn't create or remove any real archetype match).

**MTH 102 v6**: re-parsed all 36 per-question results from `docs/archetype-experiment-mth102-v6.md`. Every question already had 0 UNMAPPED steps (confirmed both from the per-question listing and the v6 run's `totalUnmappedStepLabels: 0` summary), so **the corrected rule changes nothing**: coverageScore stays **29/36 (0.806)**, of which 7 fits were `DIRECT_EVALUATION`. v6's result was never inflated by this bug.

## Follow-up B — PHY 102 extraction density diagnosis

Captured 2026-07-27. Read-only: re-fetched the two source materials and re-chunked them locally (same `chunkText`, `CHUNK_SIZE=8000`, `CHUNK_OVERLAP=500` as the extraction script — no AI calls), then cross-referenced against the cached extraction and read the flagged chunks' actual text. No extraction code was changed.

### 1. Chunk-level accounting

**67 chunks total**: 62 from "PHY 102 ELECTRIC, MAGNETISM AND MODERN PHYSICS", 5 from "GENERAL PHYSICS I  (2)". Every chunk ID referenced by a cached example matches a reconstructed chunk ID exactly (0 orphans) — combined with the run completing without a fatal error, this confirms **no chunk was skipped or silently failed**; every chunk was sent to the model and its result (even if empty) was accounted for. Per-chunk yield ranged from 0 to 5 examples; **20 of 67 chunks (30%) yielded zero examples**.

### 2. Are the zero-example chunks really empty?

Scanned all 20 zero-example chunks' full text for "Example N" / "Solution" markers:

- **15 of 20 are genuinely prose-only** — no Example/Solution markers at all (confirmed by direct reading of 2 of these: chunk0 of the PHY102 material is the course-guide introduction/administrative front matter; chunk20 is a unit's introduction/objectives section before any worked content). Correctly zero.
- **5 of 20 contain an Example/Solution marker.** Cross-checking each one's underlying problem text against the full 74-example extraction:
  - **3 are false alarms, not misses**: the example was captured, just attributed to a *different*, overlapping chunk. `CHUNK_OVERLAP=500` means adjacent chunks share content, so an example sitting near a chunk boundary can get credited to whichever chunk the model judged it "belonged to" — not duplicated, not lost. Confirmed for `chunk28` (proton-beam power example, captured as `phy27` under `chunk29`), `chunk45` (phase-difference/AC-circuit example, captured as `phy49` under `chunk48`), and `GENERAL PHYSICS I  (2)__chunk0` (the pendulum-period dimensional-analysis example, captured under the neighboring chunk — it's the one that ended up in the top-10 archetypes list).
  - **2 are genuine misses**: `chunk8` (a full worked example — three point charges on the x-axis, electric potential via the superposition principle, complete numeric solution) and `chunk21` (a units-derivation example for magnetic flux density, deriving the weber). Neither appears anywhere in the final 74-example cache. Both examples are interrupted mid-flow by PDF-to-text pagination noise — literal page-break artifacts (`-- 49 of 343 --`), repeated running headers (`PHY 121 ELECTRICITY, MAGNETISM AND MODERN PHYSICS`), and page-number stamps (`NOUN 49`) land in the middle of the "Example ... Solution ..." text, which plausibly broke the model's ability to recognize it as one coherent unit within its chunk.

Net: **2 genuine misses out of an estimated ~76 real worked examples (74 captured + 2 missed) ≈ 2.6% under-extraction.** Extraction is not the primary reason PHY 102 yielded so few examples relative to its size — it's close to complete.

### 3. Prose vs. worked-problem proportion

Measuring by character volume: the 74 extracted examples' combined problem + solution text totals 39,310 characters against 500,293 characters of combined source material — **worked-problem content is ~7.9% of the corpus; ~92% is explanatory prose** (theory, definitions, unit introductions/objectives, tutor-marked-assignment instructions, references, and other NOUN course-guide administrative content).

This directly explains the density gap: MTH 102's source material is dense with practice problems (1 example per ~405 chars); PHY 102's NOUN course-guide format is structured the opposite way — long explanatory sections with comparatively few worked examples (1 per ~6,761 chars is consistent with a corpus that's ~92% prose). The gap is a real property of the source material, not a pipeline defect.
