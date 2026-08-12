import type { TutorDepth } from './tutor-state';

export interface TutorBenchmarkLearner {
  id: 'foundation' | 'guided' | 'standard' | 'advanced';
  expectedDepth: TutorDepth;
  mastery: number;
  confidence: number;
  confusion: number;
  vocabulary: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
}

export interface TutorBenchmarkQuestion {
  id: string;
  discipline: string;
  taskType: 'conceptual' | 'calculation' | 'essay' | 'verification' | 'misconception';
  prompt: string;
  requiredSignals: string[];
}

export interface TutorBenchmarkCase extends TutorBenchmarkQuestion {
  caseId: string;
  learner: TutorBenchmarkLearner;
  rubric: string[];
}

export const BENCHMARK_LEARNERS: TutorBenchmarkLearner[] = [
  { id: 'foundation', expectedDepth: 'FOUNDATION', mastery: 0.2, confidence: 0.3, confusion: 0.82, vocabulary: 'BASIC' },
  { id: 'guided', expectedDepth: 'GUIDED', mastery: 0.42, confidence: 0.48, confusion: 0.58, vocabulary: 'INTERMEDIATE' },
  { id: 'standard', expectedDepth: 'STANDARD', mastery: 0.67, confidence: 0.62, confusion: 0.3, vocabulary: 'INTERMEDIATE' },
  { id: 'advanced', expectedDepth: 'ADVANCED', mastery: 0.9, confidence: 0.78, confusion: 0.16, vocabulary: 'ADVANCED' },
];

export const BENCHMARK_QUESTIONS: TutorBenchmarkQuestion[] = [
  { id: 'mth-quad', discipline: 'Mathematics', taskType: 'calculation', prompt: 'Solve 2x^2 + 3x - 2 = 0.', requiredSignals: ['correct roots', 'method'] },
  { id: 'mth-derivative', discipline: 'Mathematics', taskType: 'calculation', prompt: 'Differentiate y = x^3 sin x.', requiredSignals: ['product rule', 'correct derivative'] },
  { id: 'mth-limit', discipline: 'Mathematics', taskType: 'conceptual', prompt: 'Why does lim x->0 sin(x)/x equal 1?', requiredSignals: ['reason', 'limit'] },
  { id: 'mth-function', discipline: 'Mathematics', taskType: 'misconception', prompt: 'I thought every function from R to R is onto because every x has an output.', requiredSignals: ['repair misconception', 'codomain'] },
  { id: 'sta-probability', discipline: 'Statistics', taskType: 'calculation', prompt: 'A fair die is rolled twice. Find the probability the sum is 8.', requiredSignals: ['sample outcomes', 'probability'] },
  { id: 'sta-mean', discipline: 'Statistics', taskType: 'verification', prompt: 'I got a mean of 12.4 for 10, 11, 13, 15. Is this correct?', requiredSignals: ['verify', 'first error'] },
  { id: 'phy-newton', discipline: 'Physics', taskType: 'conceptual', prompt: "Explain Newton's second law and what acceleration really means.", requiredSignals: ['force', 'acceleration'] },
  { id: 'phy-projectile', discipline: 'Physics', taskType: 'calculation', prompt: 'A ball is launched at 20 m/s at 30 degrees. Find its time of flight, take g=9.8 m/s^2.', requiredSignals: ['vertical component', 'time'] },
  { id: 'phy-circuit', discipline: 'Physics', taskType: 'misconception', prompt: 'Voltage is basically the same thing as current, right?', requiredSignals: ['counterexample', 'difference'] },
  { id: 'chm-moles', discipline: 'Chemistry', taskType: 'calculation', prompt: 'How many moles are in 18 g of water?', requiredSignals: ['molar mass', 'moles'] },
  { id: 'chm-equilibrium', discipline: 'Chemistry', taskType: 'conceptual', prompt: "Why doesn't equilibrium mean the reaction has stopped?", requiredSignals: ['dynamic equilibrium', 'rates'] },
  { id: 'chm-balance', discipline: 'Chemistry', taskType: 'calculation', prompt: 'Balance Fe + O2 -> Fe2O3.', requiredSignals: ['balanced equation', 'coefficients'] },
  { id: 'eco-demand', discipline: 'Economics', taskType: 'conceptual', prompt: 'Why does a demand curve usually slope downward?', requiredSignals: ['price', 'quantity demanded'] },
  { id: 'eco-elasticity', discipline: 'Economics', taskType: 'calculation', prompt: 'Price rises from 100 to 120 and quantity demanded falls from 50 to 40. Calculate price elasticity using the midpoint method.', requiredSignals: ['midpoint', 'elasticity'] },
  { id: 'eco-inflation', discipline: 'Economics', taskType: 'essay', prompt: 'Discuss four causes of inflation in a developing economy.', requiredSignals: ['four causes', 'explanation'] },
  { id: 'acc-depreciation', discipline: 'Accounting', taskType: 'calculation', prompt: 'An asset costs 500000, residual value 50000, useful life 5 years. Calculate annual straight-line depreciation.', requiredSignals: ['depreciable amount', 'annual depreciation'] },
  { id: 'acc-double-entry', discipline: 'Accounting', taskType: 'misconception', prompt: 'I thought every debit means money is coming into the business.', requiredSignals: ['repair misconception', 'account type'] },
  { id: 'csc-bigo', discipline: 'Computer Science', taskType: 'conceptual', prompt: 'What does O(n log n) actually tell me about an algorithm?', requiredSignals: ['growth', 'input size'] },
  { id: 'csc-recursion', discipline: 'Computer Science', taskType: 'misconception', prompt: 'Recursion is just a loop written differently, so they are always equivalent.', requiredSignals: ['base case', 'call stack'] },
  { id: 'csc-binary', discipline: 'Computer Science', taskType: 'calculation', prompt: 'Convert decimal 45 to binary and show the method.', requiredSignals: ['binary', 'method'] },
  { id: 'bio-osmosis', discipline: 'Biology', taskType: 'conceptual', prompt: 'Explain osmosis without assuming I understand water potential.', requiredSignals: ['water movement', 'membrane'] },
  { id: 'bio-mitosis', discipline: 'Biology', taskType: 'essay', prompt: 'Compare mitosis and meiosis.', requiredSignals: ['comparison', 'differences'] },
  { id: 'med-cardiac', discipline: 'Medicine', taskType: 'conceptual', prompt: 'Explain the cardiac cycle at an undergraduate level.', requiredSignals: ['systole', 'diastole'] },
  { id: 'law-negligence', discipline: 'Law', taskType: 'essay', prompt: 'Discuss the elements required to establish negligence.', requiredSignals: ['duty', 'breach', 'causation', 'damage'] },
  { id: 'law-evaluate', discipline: 'Law', taskType: 'essay', prompt: 'Critically evaluate the doctrine of consideration in contract law.', requiredSignals: ['position', 'evaluation', 'qualification'] },
  { id: 'pol-separation', discipline: 'Political Science', taskType: 'essay', prompt: 'Explain the significance of separation of powers.', requiredSignals: ['purpose', 'checks'] },
  { id: 'eng-thesis', discipline: 'English', taskType: 'essay', prompt: 'How should I structure an answer that says compare and contrast two poems?', requiredSignals: ['comparison dimensions', 'structure'] },
  { id: 'edu-assessment', discipline: 'Education', taskType: 'essay', prompt: 'List and explain four purposes of formative assessment.', requiredSignals: ['four purposes', 'no forced counterargument'] },
  { id: 'eng-mechanics', discipline: 'Engineering', taskType: 'calculation', prompt: 'A simply supported beam carries a 10 kN central point load over a 4 m span. Find the support reactions.', requiredSignals: ['equilibrium', 'reactions'] },
  { id: 'general-verify', discipline: 'General', taskType: 'verification', prompt: 'Here is my reasoning: correlation proves causation because the variables move together. Is this right?', requiredSignals: ['verification', 'causation misconception'] },
];

const COMMON_RUBRIC = [
  'academic correctness',
  'course/question grounding',
  'depth matches learner state',
  'no unnecessary verbosity',
  'important reasoning is not skipped',
  'transferable method or understanding',
  'misconceptions corrected when present',
  'confidence is not confused with mastery',
];

export function buildTutorBenchmarkSuite(): TutorBenchmarkCase[] {
  return BENCHMARK_QUESTIONS.flatMap((question) => BENCHMARK_LEARNERS.map((learner) => ({
    ...question,
    caseId: `${question.id}-${learner.id}`,
    learner,
    rubric: [...COMMON_RUBRIC, ...question.requiredSignals],
  })));
}
