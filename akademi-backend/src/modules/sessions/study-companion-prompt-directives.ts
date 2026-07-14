import { StudyCompanionPhase } from '@prisma/client';
import { TeachingDecision } from './teaching-decision-engine';
import {
  RoadmapSection,
  TeacherBrainSectionContext,
  StudySectionLessonPlanRecord,
  StudentMemoryContext,
  RelevantMaterialContext,
  LessonScope,
  ScopeViolation,
  TeachingDepthPlan,
  LearningIntelligenceContext,
  SectionContext,
} from './study-companion.types';
import {
  truncate,
  truncateList,
  safeStringArray,
} from './study-companion-teacher-brain';

export const RETENTION_THROWBACK_THRESHOLD = 60;

export const PASS_1 = StudyCompanionPhase.TEACHING_PASS_1_BIG_PICTURE;
export const PASS_2 = StudyCompanionPhase.TEACHING_PASS_2_DETAILS;
export const PASS_3 = StudyCompanionPhase.TEACHING_PASS_3_CONNECTIONS;
export const TEACHBACK_1 = StudyCompanionPhase.TEACHBACK_1_REQUESTED;
export const GAP_RETEACH = StudyCompanionPhase.GAP_RETEACH;
export const TEACHBACK_2 = StudyCompanionPhase.TEACHBACK_2_REQUESTED;
export const MEMORY_DUMP = StudyCompanionPhase.MEMORY_DUMP_REQUESTED;
export const NEXT_SECTION = StudyCompanionPhase.NEXT_SECTION_READY;
export const SESSION_DONE = StudyCompanionPhase.SESSION_COMPLETED;

export function safeJsonObject<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fallback;
  return value as T;
}

export function safeJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function readSectionContext(value: unknown): SectionContext {
  return safeJsonObject<SectionContext>(value, {});
}

export function canonicalizeCoveredConcept(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function mergeCoveredConcepts(existing: string[], next: string[]) {
  return Array.from(
    new Set(
      [...existing, ...next].map(canonicalizeCoveredConcept).filter(Boolean),
    ),
  );
}

export function extractConceptLabel(value: string) {
  const cleaned = String(value || '').trim();
  if (!cleaned) return '';
  const beforeColon = cleaned.split(':')[0]?.trim() || cleaned;
  return canonicalizeCoveredConcept(beforeColon);
}

export function inferPrerequisiteConcepts(
  teacherBrainSectionContext?: TeacherBrainSectionContext,
  lessonPlan?: StudySectionLessonPlanRecord,
) {
  const concepts = [
    ...(teacherBrainSectionContext?.prerequisites || []).map((item) =>
      String(item.concept || '').trim(),
    ),
    ...(lessonPlan?.prerequisiteRefresh || []).map((item) =>
      extractConceptLabel(item),
    ),
  ]
    .map(canonicalizeCoveredConcept)
    .filter(Boolean);

  return Array.from(new Set(concepts));
}

export function buildFeedbackDoctrineLines(options?: { brief?: boolean }) {
  if (options?.brief) {
    return [
      "Feedback doctrine: before teaching anything new, give exactly one short sentence of feedback on the student's last answer.",
      'That sentence is about the work, never the person. Name what was right or close, or correct the one biggest slip in plain words. Do not say only great job or well done. A wrong guess is welcome, not a failure.',
    ];
  }
  return [
    "Feedback doctrine: respond to the student's attempt before teaching anything new.",
    'Feedback is about the work, never the person. Never praise or judge intelligence or ability, and never let a wrong answer read as a verdict on the student.',
    'Name the specific thing that was right in the attempt first, even if the overall answer was wrong.',
    'Locate the single highest-leverage error and say why it is wrong, tied to the concept, not just the rule.',
    'Give one concrete next move. Fix only that one error, never a list of everything wrong. One correction per turn.',
    'Praise effort or strategy specifically, or not at all. Never say only great job or well done.',
  ];
}

export function buildLecturerStyleDirectives(args: {
  phase: StudyCompanionPhase | 'INTRO' | 'CHECKPOINT' | 'RETEACH';
  turnType: 'teaching' | 'checkpoint_question' | 'reteach' | 'transition';
  teachingDecision: TeachingDecision;
  sectionTitle: string;
  alreadyCoveredConcepts: string[];
  prerequisiteRepairActive: boolean;
  isCheckpointQuestion: boolean;
  microQuestionAllowed?: boolean;
}) {
  const lines = [
    'Sound like a calm university lecturer, not a textbook summary.',
    'Teach one clear idea at a time.',
    'Use natural bridge phrases such as Now connect that to, The key link is, This matters because, For exams, notice, or Keep this distinction in mind.',
    'Avoid restarting the lesson from the beginning.',
    'Avoid Welcome except for the very first opening message.',
    'Keep intros short and direct.',
    'Do not dump definitions mechanically.',
    'Use a light lecturer-style coaching tone, not chatbot phrasing.',
  ];

  if (args.alreadyCoveredConcepts.length) {
    lines.push(
      `These prerequisite ideas were already refreshed in this section: ${truncateList(args.alreadyCoveredConcepts, 6, 40).join(' | ')}.`,
    );
    lines.push(
      'Do not explain those prerequisite ideas again in full. If needed, bridge to them in one short sentence only.',
    );
  }

  if (args.prerequisiteRepairActive) {
    lines.push(
      'A short prerequisite repair is active, so focus only on the blocking prerequisite before returning to the main lesson.',
    );
  }

  if (args.isCheckpointQuestion) {
    lines.push(
      'This is a checkpoint request, so ask clearly for the student response and do not continue teaching afterward.',
    );
  } else if (args.microQuestionAllowed) {
    lines.push(
      'This is teaching with one genuine micro-question at the very end, not a rhetorical question. Ask it once, mean it, and never answer it yourself.',
    );
  } else {
    lines.push(
      'This is teaching, not a checkpoint. Do not ask rhetorical questions.',
    );
  }

  console.log('lecturer_style_directives_applied', {
    phase: args.phase,
    turnType: args.turnType,
    sectionTitle: args.sectionTitle,
    coveredConceptCount: args.alreadyCoveredConcepts.length,
    prerequisiteRepairActive: args.prerequisiteRepairActive,
    isCheckpointQuestion: args.isCheckpointQuestion,
    strategy: args.teachingDecision.strategy,
    pace: args.teachingDecision.pace,
  });

  return lines;
}

export function planPrerequisiteRefresh(args: {
  phase: 'INTRO' | 1 | 2 | 3 | 'RETEACH';
  decision: TeachingDecision;
  sectionContext: SectionContext;
  teacherBrainSectionContext?: TeacherBrainSectionContext;
  lessonPlan?: StudySectionLessonPlanRecord;
  repairMode?: 'medium_prerequisite_repair' | 'full_section_reteach';
}) {
  const availableConcepts = inferPrerequisiteConcepts(
    args.teacherBrainSectionContext,
    args.lessonPlan,
  );
  const coveredConcepts = safeStringArray(
    args.sectionContext.coveredConcepts,
  ).map(canonicalizeCoveredConcept);
  const unrepeated = availableConcepts.filter(
    (concept) => !coveredConcepts.includes(concept),
  );
  const refreshAllowed =
    args.phase === 'INTRO' ||
    args.phase === 1 ||
    args.phase === 'RETEACH' ||
    args.repairMode === 'medium_prerequisite_repair' ||
    args.decision.promptDirectives.some((line) =>
      /prerequisite refresh|prerequisite repair|short clarification/i.test(
        line,
      ),
    );

  if (!availableConcepts.length || !refreshAllowed) {
    return { lines: [] as string[], newCoveredConcepts: [] as string[] };
  }

  if (!unrepeated.length) {
    console.log('repeated_prerequisite_suppressed', {
      phase: args.phase,
      repairMode: args.repairMode || null,
      coveredConcepts,
    });
    return {
      lines: [
        'We have already refreshed the prerequisite ideas for this section, so use only one short bridge sentence before continuing to the main concept.',
      ],
      newCoveredConcepts: [],
    };
  }

  const selected = unrepeated.slice(
    0,
    args.repairMode === 'medium_prerequisite_repair' ? 2 : 3,
  );
  return {
    lines: [
      `If a prerequisite refresh is needed here, keep it brief and limit it to: ${selected.join(', ')}. Refresh them once, then move straight into the main lesson.`,
    ],
    newCoveredConcepts: selected,
  };
}

export function buildDeterministicTeachbackPrompt(
  section: RoadmapSection,
  attemptNumber: 1 | 2,
  keyConcepts: string[],
  mode: 'teachback' | 'memory_dump',
) {
  if (mode === 'memory_dump') {
    return `Memory Dump: Without checking notes, say or write everything you remember about ${section.title}. Include the main idea${keyConcepts.length ? ` and these key points: ${truncateList(keyConcepts, 3, 50).join(', ')}` : ''}.`;
  }

  if (attemptNumber === 1) {
    return `Teach-Back 1: Explain ${section.title} in your own words${keyConcepts.length ? ` using these key ideas: ${truncateList(keyConcepts, 3, 50).join(', ')}` : ''}. Do not copy the definition; respond like you understand it.`;
  }

  return `Teach-Back 2: Explain ${section.title} again, this time correcting the missing ideas${keyConcepts.length ? ` around ${truncateList(keyConcepts, 3, 50).join(', ')}` : ''}. Respond clearly in your own words.`;
}

export function estimateConceptLoad(content: string) {
  const normalized = normalizeText(content);
  const lower = normalized.toLowerCase();
  const commaGroups = (normalized.match(/,/g) || []).length;
  const additiveMarkers = [
    'also',
    'in addition',
    'furthermore',
    'another aspect',
    'on the other hand',
    'moreover',
  ].reduce(
    (sum, marker) =>
      sum +
      (
        lower.match(
          new RegExp(`\\b${marker.replace(/\s+/g, '\\s+')}\\b`, 'g'),
        ) || []
      ).length,
    0,
  );
  const transitionMarkers = [
    'now',
    'next',
    'finally',
    'for exams',
    'keep this in mind',
    'this matters because',
  ].reduce(
    (sum, marker) =>
      sum +
      (
        lower.match(
          new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        ) || []
      ).length,
    0,
  );
  const listSignals = [
    'heat',
    'light',
    'sound',
    'electricity',
    'magnetism',
    'atoms',
    'scientific method',
    'measurement',
    'applied physics',
  ].filter((marker) => lower.includes(marker));
  const paragraphCount = normalized.split(/\n{2,}/).filter(Boolean).length;
  const estimatedConceptCount = Math.max(
    1,
    Math.min(
      8,
      1 +
        Math.floor(commaGroups / 3) +
        additiveMarkers +
        Math.max(0, transitionMarkers - 1) +
        Math.floor(listSignals.length / 2),
    ),
  );
  const signals = [
    commaGroups >= 4 ? 'long_comma_list' : '',
    additiveMarkers >= 2 ? 'many_additive_markers' : '',
    paragraphCount >= 3 ? 'many_paragraphs' : '',
    listSignals.length >= 4 ? 'many_topic_keywords' : '',
    transitionMarkers >= 3 ? 'many_transitions' : '',
  ].filter(Boolean);
  const tooDense = estimatedConceptCount >= 4 || signals.length >= 2;

  console.log('pacing_concept_load_estimated', {
    estimatedConceptCount,
    tooDense,
    signals,
  });

  return {
    estimatedConceptCount,
    tooDense,
    signals,
  };
}

export function buildPacingDirectives(args: {
  phase: StudyCompanionPhase | 'INTRO' | 'CHECKPOINT' | 'RETEACH';
  turnType: 'teaching' | 'checkpoint_question' | 'reteach' | 'transition';
  passNumber?: 1 | 2 | 3;
  teachingDecision: TeachingDecision;
  sectionTitle: string;
  sectionContent: string;
  lessonPlan?: StudySectionLessonPlanRecord;
  isCalculationHeavy: boolean;
  isDiagramHeavy: boolean;
  isCheckpointQuestion: boolean;
  prerequisiteRepairActive: boolean;
}) {
  let targetWordRange = { min: 90, max: 180 };
  let conceptBudget = 1;
  const lines = [
    'Do not try to cover the entire section in this turn. Stop after the allowed scope for this pass. Later passes will continue the lesson.',
  ];

  if (args.phase === 'INTRO') {
    targetWordRange = { min: 40, max: 90 };
    conceptBudget = 1;
    lines.push(
      'Intro pacing: 2 to 4 short sentences, one concept only, no long lists, no checkpoint content.',
    );
  } else if (args.passNumber === 1) {
    targetWordRange = {
      min: 120,
      max: args.isCalculationHeavy || args.isDiagramHeavy ? 210 : 180,
    };
    conceptBudget = 1;
    lines.push(
      'Pass 1 pacing: one main idea, one simple supporting example at most, no long subtopic list.',
    );
    if (args.isCalculationHeavy)
      lines.push('Do not place the full formula walkthrough in Pass 1.');
    if (args.isDiagramHeavy)
      lines.push('Do not fully describe the entire diagram in Pass 1.');
  } else if (args.passNumber === 2) {
    targetWordRange = { min: 180, max: 260 };
    conceptBudget = 3;
    lines.push(
      'Pass 2 pacing: 2 to 3 closely related ideas only. Carry details, definition, process, or one worked example.',
    );
    lines.push('Do not repeat Pass 1.');
  } else if (args.passNumber === 3) {
    targetWordRange = { min: 120, max: 200 };
    conceptBudget = 2;
    lines.push(
      'Pass 3 pacing: concise connection, exam relevance, common mistake, and bridge forward. Do not introduce a large new subtopic.',
    );
  } else if (args.isCheckpointQuestion) {
    targetWordRange = { min: 18, max: 70 };
    conceptBudget = 0;
    lines.push(
      'Checkpoint pacing: maximum 2 sentences, no teaching paragraph, no new concepts.',
    );
  } else if (args.phase === 'RETEACH') {
    targetWordRange = { min: 80, max: 170 };
    conceptBudget = args.prerequisiteRepairActive ? 1 : 2;
    lines.push(
      args.prerequisiteRepairActive
        ? 'Prerequisite repair pacing: one blocking idea, one practical example, then stop.'
        : 'Reteach pacing: simplify and cover only the missing idea or two.',
    );
  }

  console.log('pacing_directives_applied', {
    phase: args.phase,
    turnType: args.turnType,
    passNumber: args.passNumber || null,
    sectionTitle: args.sectionTitle,
    targetWordRange,
    conceptBudget,
    isCalculationHeavy: args.isCalculationHeavy,
    isDiagramHeavy: args.isDiagramHeavy,
    prerequisiteRepairActive: args.prerequisiteRepairActive,
  });

  lines.push(
    `Concept budget for this turn: maximum ${conceptBudget} new concept${conceptBudget === 1 ? '' : 's'}.`,
  );
  lines.push(
    `Target word range: ${targetWordRange.min} to ${targetWordRange.max} words.`,
  );

  return {
    lines,
    targetWordRange,
    conceptBudget,
  };
}

export function splitConceptPhrases(text: string) {
  return normalizeText(text)
    .split(/[,;:()\/]/)
    .flatMap((part) => part.split(/\band\b|&/i))
    .map((part) =>
      part
        .replace(
          /\b(definition|introduction|basics|overview|meaning|concept|principles|scope|nature|properties|applications?)\s+of\s+/gi,
          '',
        )
        .trim(),
    )
    .map((part) => part.replace(/\bwhat is\b/gi, '').trim())
    .filter((part) => part.length >= 3 && part.length <= 60);
}

export function addConceptLabel(map: Map<string, string>, value: string) {
  const label = String(value || '').trim();
  const key = canonicalizeCoveredConcept(label);
  if (!key || key.length < 3) return;
  if (!map.has(key)) {
    map.set(key, label);
  }
}

export function collectExampleConcepts(text: string) {
  const matches = Array.from(
    text.matchAll(/\b(?:such as|including|includes|like)\s+([^.!?]+)/gi),
  );
  return matches
    .flatMap((match) => splitConceptPhrases(match[1] || ''))
    .filter(Boolean)
    .slice(0, 10);
}

export function sentenceContainsConcept(sentence: string, concept: string) {
  const normalizedSentence = canonicalizeCoveredConcept(sentence);
  const normalizedConcept = canonicalizeCoveredConcept(concept);
  if (!normalizedSentence || !normalizedConcept) return false;
  return normalizedSentence.includes(normalizedConcept);
}

export function formatLessonScopePrompt(scope: LessonScope) {
  return [
    `Primary objective: ${truncate(scope.primaryObjective, 180)}`,
    scope.inScopeConcepts.length
      ? `In-scope concepts: ${truncateList(scope.inScopeConcepts, 6, 50).join(' | ')}`
      : '',
    scope.supportingConcepts.length
      ? `Supporting context only: ${truncateList(scope.supportingConcepts, 4, 50).join(' | ')}`
      : '',
    scope.prerequisiteConcepts.length
      ? `Prerequisites: ${truncateList(scope.prerequisiteConcepts, 4, 50).join(' | ')}`
      : '',
    scope.previewOnlyConcepts.length
      ? `Preview only: ${truncateList(scope.previewOnlyConcepts, 6, 50).join(' | ')}`
      : '',
    scope.outOfScopeConcepts.length
      ? `Out of scope: ${truncateList(scope.outOfScopeConcepts, 6, 50).join(' | ')}`
      : '',
    scope.allowedExamples.length
      ? `Allowed examples: ${truncateList(scope.allowedExamples, 3, 70).join(' | ')}`
      : '',
    ...scope.scopeDirectives,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildLessonScope(args: {
  sectionTitle: string;
  sectionContent: string;
  roadmap?: RoadmapSection[];
  currentSectionIndex?: number;
  teacherBrainContext?: string;
  teacherBrainSectionContext?: TeacherBrainSectionContext;
  lessonPlan?: StudySectionLessonPlanRecord;
  lessonPlanContext?: string;
  relevantMaterialContext?: RelevantMaterialContext;
  lecturerConstraintContext?: string;
  teachingDecision?: TeachingDecision;
  passNumber?: 1 | 2 | 3;
  phase: StudyCompanionPhase | 'INTRO' | 'CHECKPOINT' | 'RETEACH';
}) {
  const content = normalizeText(args.sectionContent || '');
  const title = String(args.sectionTitle || '').trim();
  const titleConceptMap = new Map<string, string>();
  splitConceptPhrases(title).forEach((item) =>
    addConceptLabel(titleConceptMap, item),
  );
  if (!titleConceptMap.size) addConceptLabel(titleConceptMap, title);

  const inScopeMap = new Map<string, string>(titleConceptMap);
  const supportingMap = new Map<string, string>();
  const prerequisiteMap = new Map<string, string>();
  const previewMap = new Map<string, string>();
  const outOfScopeMap = new Map<string, string>();
  const allowedExampleMap = new Map<string, string>();

  const lessonPlan = args.lessonPlan;
  const teacherBrainSectionContext = args.teacherBrainSectionContext;
  const primaryObjective = truncate(
    lessonPlan?.lessonObjective ||
      teacherBrainSectionContext?.currentChapterSummary?.summary ||
      title,
    180,
  );

  const titleOrContent = `${title}\n${content}`.toLowerCase();
  const prerequisiteCandidates = [
    ...(teacherBrainSectionContext?.prerequisites || []).map(
      (item) => item.concept || '',
    ),
    ...(lessonPlan?.prerequisiteRefresh || []),
  ];
  prerequisiteCandidates.forEach((item) => {
    const concept = extractConceptLabel(String(item || ''));
    if (!concept) return;
    addConceptLabel(prerequisiteMap, concept);
    if (titleOrContent.includes(concept)) {
      addConceptLabel(supportingMap, concept);
    }
  });

  const teacherBrainCandidates = [
    ...(teacherBrainSectionContext?.concepts || []).map(
      (item) => item.concept || '',
    ),
    ...(teacherBrainSectionContext?.formulas || []).map(
      (item) => item.name || '',
    ),
    ...(teacherBrainSectionContext?.calculationMethods || []).map(
      (item) => item.topic || '',
    ),
    ...(teacherBrainSectionContext?.diagrams || []).map(
      (item) => item.title || '',
    ),
    ...(teacherBrainSectionContext?.currentChapterSummary?.key_points || []),
    ...(lessonPlan?.checkpointFocus || []),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  teacherBrainCandidates.forEach((candidate) => {
    const label = candidate.replace(/^[-*]\s*/, '').trim();
    const key = canonicalizeCoveredConcept(label);
    if (!key) return;
    if (titleOrContent.includes(key)) {
      addConceptLabel(inScopeMap, label);
    }
  });

  [
    'matter',
    'energy',
    'measurement',
    'physical quantity',
    'physical quantities',
    'science',
    'observation',
    'experiment',
    'unit',
    'units',
    'variable',
    'variables',
  ].forEach((item) => {
    if (titleOrContent.includes(item)) {
      if (
        item === 'science' ||
        item === 'observation' ||
        item === 'experiment' ||
        item === 'unit' ||
        item === 'units' ||
        item === 'variable' ||
        item === 'variables'
      ) {
        addConceptLabel(supportingMap, item);
      } else {
        addConceptLabel(inScopeMap, item);
      }
    }
  });

  const nextSection =
    args.roadmap && Number.isInteger(args.currentSectionIndex)
      ? args.roadmap[
          Math.min((args.currentSectionIndex || 0) + 1, args.roadmap.length - 1)
        ]
      : null;
  splitConceptPhrases(nextSection?.title || '').forEach((item) =>
    addConceptLabel(previewMap, item),
  );
  (teacherBrainSectionContext?.concepts || []).forEach((concept) => {
    safeStringArray(concept.leads_to).forEach((item) =>
      addConceptLabel(previewMap, String(item || '')),
    );
  });

  collectExampleConcepts(content).forEach((item) => {
    const key = canonicalizeCoveredConcept(item);
    if (!key) return;
    if (
      !inScopeMap.has(key) &&
      !supportingMap.has(key) &&
      !prerequisiteMap.has(key)
    ) {
      addConceptLabel(previewMap, item);
    } else {
      addConceptLabel(allowedExampleMap, item);
    }
  });

  (teacherBrainSectionContext?.concepts || []).forEach((concept) => {
    const label = String(concept.concept || '').trim();
    const key = canonicalizeCoveredConcept(label);
    if (
      !key ||
      inScopeMap.has(key) ||
      supportingMap.has(key) ||
      prerequisiteMap.has(key)
    )
      return;
    if (titleOrContent.includes(key)) {
      addConceptLabel(supportingMap, label);
      return;
    }
    if (previewMap.has(key)) {
      return;
    }
    addConceptLabel(outOfScopeMap, label);
  });

  args.relevantMaterialContext?.chunks.forEach((chunk) => {
    splitConceptPhrases(chunk.whyRelevant || '').forEach((item) => {
      const key = canonicalizeCoveredConcept(item);
      if (
        !key ||
        inScopeMap.has(key) ||
        supportingMap.has(key) ||
        prerequisiteMap.has(key) ||
        previewMap.has(key)
      )
        return;
      addConceptLabel(outOfScopeMap, item);
    });
  });

  const inScopeConcepts = Array.from(inScopeMap.values()).slice(0, 8);
  const supportingConcepts = Array.from(supportingMap.values())
    .filter((item) => !inScopeMap.has(canonicalizeCoveredConcept(item)))
    .slice(0, 6);
  const prerequisiteConcepts = Array.from(prerequisiteMap.values())
    .filter((item) => !inScopeMap.has(canonicalizeCoveredConcept(item)))
    .slice(0, 6);
  const previewOnlyConcepts = Array.from(previewMap.values())
    .filter((item) => {
      const key = canonicalizeCoveredConcept(item);
      return (
        !inScopeMap.has(key) &&
        !supportingMap.has(key) &&
        !prerequisiteMap.has(key)
      );
    })
    .slice(0, 8);
  const outOfScopeConcepts = Array.from(outOfScopeMap.values())
    .filter((item) => {
      const key = canonicalizeCoveredConcept(item);
      return (
        !inScopeMap.has(key) &&
        !supportingMap.has(key) &&
        !prerequisiteMap.has(key) &&
        !previewMap.has(key)
      );
    })
    .slice(0, 8);
  const allowedExamples = Array.from(allowedExampleMap.values()).slice(0, 3);
  const forbiddenExpansions = Array.from(
    new Set([...previewOnlyConcepts, ...outOfScopeConcepts]),
  ).slice(0, 12);

  const scopeDirectives = [
    'Stay inside the current section objective. Teacher Brain and retrieved material may support, but must not expand the lesson beyond this section.',
    args.phase === 'INTRO'
      ? 'Intro scope: topic, learning goal, and at most one simple hook only. No lists of subtopics. No detailed explanation.'
      : args.phase === PASS_1 || args.passNumber === 1
        ? 'Pass 1 scope: teach the main intuitive definition, why it matters, and one simple example only.'
        : args.phase === PASS_2 || args.passNumber === 2
          ? 'Pass 2 scope: teach the formal definition, key terms, and one example or method detail only.'
          : args.phase === PASS_3 || args.passNumber === 3
            ? 'Pass 3 scope: teach exam framing, common mistake, concise connection, and what to remember. Do not introduce a large new topic.'
            : args.phase === 'CHECKPOINT'
              ? 'Checkpoint scope: ask only about the in-scope concepts. Do not ask about preview-only or out-of-scope concepts.'
              : 'Repair scope: focus only on the blocked prerequisite or missing idea.',
    previewOnlyConcepts.length
      ? `Preview-only concepts may be mentioned in one short phrase only: ${truncateList(previewOnlyConcepts, 4, 45).join(' | ')}.`
      : '',
    outOfScopeConcepts.length
      ? `Do not explain these out-of-scope concepts in this turn: ${truncateList(outOfScopeConcepts, 5, 45).join(' | ')}.`
      : '',
    forbiddenExpansions.length
      ? `Forbidden expansions for this turn: ${truncateList(forbiddenExpansions, 6, 45).join(' | ')}.`
      : '',
    args.teachingDecision?.promptDirectives?.length
      ? `Teaching decision must still stay inside this scope: ${truncateList(args.teachingDecision.promptDirectives, 4, 90).join(' | ')}`
      : '',
  ].filter(Boolean);

  const scope = {
    primaryObjective,
    inScopeConcepts,
    supportingConcepts,
    prerequisiteConcepts,
    previewOnlyConcepts,
    outOfScopeConcepts,
    allowedExamples,
    forbiddenExpansions,
    scopeDirectives,
  };

  console.log('lesson_scope_built', {
    phase: args.phase,
    sectionTitle: title,
    primaryObjective,
    inScopeCount: inScopeConcepts.length,
    supportingCount: supportingConcepts.length,
    prerequisiteCount: prerequisiteConcepts.length,
    previewOnlyCount: previewOnlyConcepts.length,
    outOfScopeCount: outOfScopeConcepts.length,
  });

  return scope;
}

export function detectScopeViolation(
  content: string,
  lessonScope: LessonScope,
): ScopeViolation {
  const normalized = normalizeText(content);
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const forbiddenConceptsFound = lessonScope.forbiddenExpansions
    .filter((concept) => sentenceContainsConcept(normalized, concept))
    .slice(0, 8);
  const previewConceptsOverExplained = lessonScope.previewOnlyConcepts
    .filter((concept) =>
      sentences.some(
        (sentence) =>
          sentenceContainsConcept(sentence, concept) &&
          sentence.split(/\s+/).filter(Boolean).length > 12,
      ),
    )
    .slice(0, 6);
  const violations: string[] = [];

  if (forbiddenConceptsFound.length) {
    violations.push('out_of_scope_expansion');
  }
  if (previewConceptsOverExplained.length) {
    violations.push('preview_explained_too_deeply');
  }
  const topicListHit = sentences.some((sentence) => {
    const commaCount = (sentence.match(/,/g) || []).length;
    const hits = lessonScope.forbiddenExpansions.filter((concept) =>
      sentenceContainsConcept(sentence, concept),
    ).length;
    return commaCount >= 3 && hits >= 2;
  });
  if (topicListHit) {
    violations.push('too_many_topic_lists');
  }

  return {
    violated: violations.length > 0,
    violations,
    forbiddenConceptsFound,
    previewConceptsOverExplained,
  };
}

export function formatTeachingDepthPlan(plan: TeachingDepthPlan) {
  return [
    `Target depth: ${plan.targetDepth}`,
    plan.minimumUnderstanding.length
      ? `Minimum understanding: ${truncateList(plan.minimumUnderstanding, 5, 60).join(' | ')}`
      : '',
    plan.allowedDepthConcepts.length
      ? `Allowed depth concepts: ${truncateList(plan.allowedDepthConcepts, 6, 60).join(' | ')}`
      : '',
    plan.deferredDepthConcepts.length
      ? `Deferred concepts: ${truncateList(plan.deferredDepthConcepts, 6, 55).join(' | ')}`
      : '',
    plan.allowedExampleTypes.length
      ? `Allowed example types: ${plan.allowedExampleTypes.join(' | ')}`
      : '',
    `Maximum reasoning layers: ${plan.maxReasoningLayers}`,
    `Maximum examples: ${plan.maxExamples}`,
    ...plan.depthDirectives,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildTeachingDepthPlan(args: {
  phase: StudyCompanionPhase | 'INTRO' | 'CHECKPOINT' | 'RETEACH';
  turnType: 'teaching' | 'checkpoint_question' | 'reteach' | 'transition';
  passNumber?: 1 | 2 | 3;
  sectionTitle: string;
  sectionContent: string;
  lessonScope: LessonScope;
  teachingDecision: TeachingDecision;
  lessonPlan?: StudySectionLessonPlanRecord;
  learningIntelligence?: LearningIntelligenceContext | null;
  studentMemoryContext?: StudentMemoryContext | null;
  isCalculationHeavy: boolean;
  isDiagramHeavy: boolean;
  prerequisiteRepairActive: boolean;
}) {
  const minimumUnderstanding = args.lessonScope.inScopeConcepts.slice(
    0,
    args.phase === 'INTRO' ? 1 : args.passNumber === 1 ? 3 : 5,
  );
  const deferredMap = new Map<string, string>();
  const forbiddenMap = new Map<string, string>();
  [
    ...args.lessonScope.previewOnlyConcepts,
    ...args.lessonScope.outOfScopeConcepts,
  ].forEach((item) => {
    addConceptLabel(deferredMap, item);
    addConceptLabel(forbiddenMap, item);
  });

  [
    'experimental verification',
    'validity of laws',
    'derive physical laws',
    'engineering applications',
    'applied physics',
    'atomic structure',
    'scientific method',
    'theoretical foundations',
    'advanced implication',
    'measurement philosophy',
  ].forEach((item) => {
    if (
      !args.lessonScope.inScopeConcepts.some((concept) =>
        sentenceContainsConcept(concept, item),
      )
    ) {
      addConceptLabel(deferredMap, item);
      addConceptLabel(forbiddenMap, item);
    }
  });

  let targetDepth: TeachingDepthPlan['targetDepth'] = 'standard';
  let maxReasoningLayers = 2;
  let maxExamples = 1;
  let allowedExampleTypes = ['simple everyday example'];

  if (args.phase === 'INTRO' || args.passNumber === 1) {
    targetDepth = 'basic';
    maxReasoningLayers = 1;
    maxExamples = 1;
    allowedExampleTypes = args.isCalculationHeavy
      ? ['one tiny intuitive setup only']
      : ['one simple everyday example'];
  } else if (args.phase === 'CHECKPOINT') {
    targetDepth = 'basic';
    maxReasoningLayers = 1;
    maxExamples = 0;
    allowedExampleTypes = ['no new example'];
  } else if (args.phase === PASS_2 || args.passNumber === 2) {
    targetDepth = 'standard';
    maxReasoningLayers = args.isCalculationHeavy || args.isDiagramHeavy ? 3 : 2;
    maxExamples = 1;
    allowedExampleTypes = args.isCalculationHeavy
      ? ['one simple worked example']
      : args.isDiagramHeavy
        ? ['one simple process or visual walkthrough']
        : ['one direct academic example'];
  } else if (args.phase === PASS_3 || args.passNumber === 3) {
    targetDepth = args.teachingDecision.shouldUseExamFraming
      ? 'standard'
      : 'basic';
    maxReasoningLayers = 2;
    maxExamples = 1;
    allowedExampleTypes = ['one short exam framing example at most'];
  } else if (args.phase === 'RETEACH') {
    targetDepth = args.prerequisiteRepairActive ? 'basic' : 'standard';
    maxReasoningLayers = args.prerequisiteRepairActive ? 1 : 2;
    maxExamples = 1;
    allowedExampleTypes = args.isCalculationHeavy
      ? ['one tiny simple example']
      : ['one clarifying example'];
  }

  if (
    args.teachingDecision.promptDirectives.some((line) =>
      /challenge level|worked example|exam use/i.test(line),
    ) &&
    targetDepth === 'standard' &&
    args.passNumber === 3
  ) {
    targetDepth = 'deep';
  }

  if (
    args.learningIntelligence?.hiddenConfusionRisk &&
    args.learningIntelligence.hiddenConfusionRisk >= 60
  ) {
    targetDepth = 'basic';
    maxReasoningLayers = 1;
  }

  const allowedDepthConcepts = args.lessonScope.inScopeConcepts.slice(
    0,
    targetDepth === 'basic' ? 3 : 6,
  );
  const deferredDepthConcepts = Array.from(deferredMap.values()).slice(0, 10);
  const forbiddenDepthExpansions = Array.from(forbiddenMap.values()).slice(
    0,
    12,
  );
  const depthDirectives = [
    `Target depth for this turn is ${targetDepth}.`,
    'Stop after the target depth is reached. Do not keep adding related explanations just because they are true.',
    args.phase === 'INTRO'
      ? 'Intro depth: topic, learning goal, and one anchor idea only. No formulas, no worked examples, no philosophy.'
      : args.passNumber === 1
        ? 'Pass 1 depth: simplest meaning, one intuitive example, and why it matters only.'
        : args.passNumber === 2
          ? 'Pass 2 depth: formal definition, key terms, and one direct example only.'
          : args.passNumber === 3
            ? 'Pass 3 depth: exam framing, common mistake, concise summary, and bridge only.'
            : args.phase === 'CHECKPOINT'
              ? 'Checkpoint depth: ask only for recall or explanation of what has already been taught.'
              : 'Repair depth: focus only on the missing idea and stop once it is clear.',
    deferredDepthConcepts.length
      ? `Do not explain these deferred concepts in this turn: ${truncateList(deferredDepthConcepts, 6, 55).join(' | ')}.`
      : '',
    `Allowed example types: ${allowedExampleTypes.join(' | ')}.`,
    `Maximum reasoning layers: ${maxReasoningLayers}.`,
    `Maximum examples: ${maxExamples}.`,
  ].filter(Boolean);

  const plan = {
    targetDepth,
    minimumUnderstanding,
    allowedDepthConcepts,
    deferredDepthConcepts,
    forbiddenDepthExpansions,
    allowedExampleTypes,
    maxReasoningLayers,
    maxExamples,
    depthDirectives,
  };

  console.log('teaching_depth_plan_built', {
    phase: args.phase,
    turnType: args.turnType,
    passNumber: args.passNumber || null,
    sectionTitle: args.sectionTitle,
    targetDepth,
    minimumUnderstandingCount: minimumUnderstanding.length,
    deferredDepthCount: deferredDepthConcepts.length,
    maxReasoningLayers,
    maxExamples,
  });

  return plan;
}

export function detectDepthViolation(
  content: string,
  teachingDepthPlan: TeachingDepthPlan,
) {
  const normalized = normalizeText(content);
  const lower = normalized.toLowerCase();
  const deferredConceptsExplained = teachingDepthPlan.forbiddenDepthExpansions
    .filter((concept) => sentenceContainsConcept(normalized, concept))
    .slice(0, 8);
  const reasoningLayerCount = (
    lower.match(/\btherefore\b|\bso that\b|\bwhich means\b|\bas a result\b/g) ||
    []
  ).length;
  const exampleCount = (
    lower.match(
      /\bfor example\b|\bfor instance\b|\bimagine\b|\bsimple example\b/g,
    ) || []
  ).length;
  const advancedPhrases = [
    'validity of laws',
    'derive physical laws',
    'engineering applications',
    'experimental verification',
    'theoretical foundations',
    'advanced implication',
  ].filter((phrase) => lower.includes(phrase));
  const formulaMentioned = /[=+\-/*^]|\\\(|\\\[|\bformula\b/i.test(normalized);
  const tooManyReasoningLayers =
    reasoningLayerCount > teachingDepthPlan.maxReasoningLayers;
  const tooManyExamples = exampleCount > teachingDepthPlan.maxExamples;
  const tooAdvancedForPass =
    advancedPhrases.length > 0 ||
    (teachingDepthPlan.targetDepth === 'basic' &&
      formulaMentioned &&
      !teachingDepthPlan.allowedExampleTypes.some((item) =>
        /worked|calculation/i.test(item),
      ));
  const violations: string[] = [];

  if (deferredConceptsExplained.length) {
    violations.push('deferred_concepts_explained');
  }
  if (tooManyReasoningLayers) {
    violations.push('too_many_reasoning_layers');
  }
  if (tooManyExamples) {
    violations.push('too_many_examples');
  }
  if (tooAdvancedForPass) {
    violations.push('too_advanced_for_pass');
  }

  return {
    violated: violations.length > 0,
    violations,
    deferredConceptsExplained,
    tooManyReasoningLayers,
    tooManyExamples,
    tooAdvancedForPass,
  };
}

export function buildTeachingDecisionPromptLines(
  decision: TeachingDecision,
  options?: {
    pass?: 1 | 2 | 3;
    includeCheckpoint?: boolean;
    includeInterrupt?: boolean;
    includeReteach?: boolean;
    includeIntro?: boolean;
  },
) {
  const lines: string[] = [
    `Teaching decision strategy: ${decision.strategy}.`,
    `Teaching pace: ${decision.pace}.`,
  ];

  if (decision.shouldRepairPrerequisite) {
    lines.push(
      'There is a prerequisite weakness. Before teaching the main idea, insert a short prerequisite refresh.',
    );
  }

  if (decision.pace === 'slow') {
    lines.push('Teach slowly.');
    lines.push('Explain every important transition.');
    lines.push('Do not assume prior knowledge.');
  } else if (decision.pace === 'fast') {
    lines.push('Be concise.');
    lines.push('Avoid over-explaining.');
    lines.push('Move confidently.');
  }

  switch (decision.strategy) {
    case 'worked_example_first':
      lines.push(
        'Preferred teaching order: worked example, then explanation, then definition.',
      );
      break;
    case 'analogy_first':
      lines.push(
        'Preferred teaching order: analogy, then intuition, then definition, then example.',
      );
      break;
    case 'visual_first':
      lines.push(
        'Preferred teaching order: mental visual, then explanation, then definition, then example.',
      );
      break;
    case 'problem_first':
      lines.push(
        'Preferred teaching order: problem, then curiosity, then explanation.',
      );
      break;
    case 'story_first':
      lines.push(
        'Preferred teaching order: short story, then insight, then explanation.',
      );
      break;
    case 'exam_first':
      lines.push(
        'Preferred teaching order: exam framing, then explanation, then application.',
      );
      break;
    case 'definition_first':
      lines.push(
        'Preferred teaching order: definition, then explanation, then example.',
      );
      break;
    default:
      lines.push('Use a balanced hybrid teaching order.');
      break;
  }

  if (decision.shouldUseAnalogy) {
    lines.push(
      'Use one simple analogy only if it genuinely improves understanding. Avoid forced analogies.',
    );
  }
  if (decision.shouldUseVisualExplanation) {
    lines.push(
      'Use mental imagery or a verbal diagram description. Do not generate images.',
    );
  }
  if (decision.shouldUseWorkedExample) {
    lines.push('Use a worked example when it helps understanding.');
  }
  if (decision.shouldUseCalculationSteps) {
    lines.push(
      'Show calculation steps clearly and explain variables before substitution.',
    );
  }
  if (decision.shouldChallengeStudent) {
    lines.push(
      'Slightly increase reasoning depth without making the task overwhelming.',
    );
  }
  if (decision.shouldUseExamFraming) {
    lines.push(
      'Include examiner expectations, common mistakes, or exam tricks where they fit naturally.',
    );
  }

  if (options?.pass === 2 && decision.shouldUseWorkedExample) {
    lines.push(
      'Pass 2 must include one worked example unless the section content already contains one.',
    );
  }

  if (options?.pass === 3 && decision.shouldUseExamFraming) {
    lines.push(
      'Pass 3 should naturally include examiner expectations, common mistakes, and exam tricks.',
    );
  }

  if (options?.includeCheckpoint) {
    lines.push(
      'Keep the checkpoint aligned with the teaching decision and current emphasis.',
    );
  }

  if (options?.includeInterrupt) {
    lines.push(
      'Answer the interruption using the same teaching strategy and pace, but stay brief.',
    );
  }

  if (options?.includeReteach) {
    lines.push(
      'For reteach, keep the same strategic direction but simplify the explanation further.',
    );
  }

  if (options?.includeIntro) {
    lines.push(
      'Let the opening immediately reflect the chosen strategy without delaying the lesson.',
    );
  }

  if (decision.promptDirectives.length) {
    lines.push(`Decision directives: ${decision.promptDirectives.join(' | ')}`);
  }

  return lines;
}
