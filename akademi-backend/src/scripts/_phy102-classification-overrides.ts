// Classification for all 157 entries in docs/phy102-vocabulary-split.json, following the same
// judgment standard as v6 (Rule 2/3): DISCRIMINATING if the entry names a specific, identifiable
// technique/law that narrows down what kind of problem this is; GENERIC if it is generic
// bookkeeping/arithmetic that recurs across many different problem types, or a residual/leftover
// bucket from splitting "calculate arithmetic". No model call — this is a one-time hand-reviewed
// lookup, exactly like v6's RULE_2_3_CLASSIFICATION table.
//
// Every entry not listed as DISCRIMINATING below defaults to GENERIC (see the DISCRIMINATING set
// and the fallback logic at the bottom) — this keeps the table short and makes omissions safe
// (an omitted entry becomes GENERIC, the lower-blast-radius default, rather than throwing).

const DISCRIMINATING_NAMES = new Set<string>([
  // circuits — named laws and specific formulas
  "relate potential differences",
  "apply current conservation",
  "apply Ohm's law",
  'apply charge equality in series',
  'apply voltage equality in parallel',
  'apply charge conservation',
  'state resistivity formula',
  'apply series and parallel reduction',
  "apply Kirchhoff's loop rule",
  "apply Kirchhoff's point rule",
  'apply terminal voltage formula',
  'apply power formula',
  'equate potential difference',

  // AC circuits
  'calculate angular frequency',
  'calculate time constant',
  'apply exponential growth property',
  'apply capacitive reactance formula',
  'apply inductive reactance formula',
  'calculate total voltage via phasor sum',
  'calculate impedance',
  'calculate phase angle',

  // magnetism / electromagnetism — named laws
  "apply Ampere's law",
  'calculate magnetizing field',
  'calculate magnetization',
  "apply Biot-Savart law",
  'apply tangent galvanometer formula',
  'apply right-hand rule',
  "apply Faraday's law",
  "apply Faraday's law of electrolysis",
  "apply Lenz's law",

  // electrostatics — named laws
  'apply superposition principle',
  "apply Coulomb's law",
  'apply electric field formula',
  'apply flux integral definition',
  'define Gaussian surface',
  "apply Gauss's law",
  'sum pairwise potential energies',

  // modern physics — named laws/equations
  'state photoelectric equation',
  'state energy conservation principle',
  'state stopping potential formula',

  // mechanics / kinematics / thermo — named laws or genuine method choices
  'select kinematic equation',
  'apply gas laws',
  'define mechanical energy equation',
  'apply pythagorean theorem',
  'resolve into components',
  'apply trigonometric projection',
  'apply dimensional analysis',
  'apply iteration',

  // electrolysis / particle-current calculations (specific formulas, from the calculate-arithmetic split)
  'calculate parallel capacitance',
  'calculate mass from density',
  'calculate electric charge',
  'calculate electrochemical equivalent',
  'calculate mass deposited',
  'calculate beam current',
  'calculate electric power',
]);

export const CLASSIFICATION_OVERRIDES: Record<string, 'DISCRIMINATING' | 'GENERIC'> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      return DISCRIMINATING_NAMES.has(prop) ? 'DISCRIMINATING' : 'GENERIC';
    },
  },
) as Record<string, 'DISCRIMINATING' | 'GENERIC'>;
