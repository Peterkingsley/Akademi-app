import {
  RoadmapSection,
  TeacherBrainSummary,
  TeacherBrainChapterSummary,
  TeacherBrainNotes,
  ParsedTeacherBrain,
  TeacherBrainSectionContext,
  CalculationTeachingContext,
  DiagramTeachingContext,
  StudyVisualSuggestedRenderer,
} from './study-companion.types';
import {
  safeJsonObject,
  safeJsonArray,
  normalizeText,
} from './study-companion-prompt-directives';

export function questionCountForContent(content: string) {
  const matches = content.match(/\?/g);
  return matches ? matches.length : 0;
}

export function trimAfterFirstQuestion(content: string) {
  const index = content.indexOf('?');
  if (index < 0) return content.trim();
  return content.slice(0, index + 1).trim();
}

export function sanitizeSingleQuestionTurn(content: string) {
  return trimAfterFirstQuestion(normalizeText(content));
}

export function removeAccidentalTeachingQuestions(content: string) {
  const normalized = normalizeText(content);
  if (!normalized.includes('?')) return normalized;

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !sentence.includes('?'));

  return (
    sentences.join(' ') || normalized.slice(0, normalized.indexOf('?'))
  ).trim();
}

export function isIntroLikeSection(section: RoadmapSection) {
  const title = section.title.toLowerCase().trim();

  return [
    'introduction',
    'intro',
    'overview',
    'preface',
    'course outline',
    'table of contents',
    'contents',
  ].some((keyword) => title.includes(keyword));
}

export function hasEnoughTeachingContent(section: RoadmapSection) {
  const text = normalizeText(section.content || '');
  return text.length >= 500;
}

export function findFirstRealTeachingSection(
  roadmap: RoadmapSection[],
  startIndex = 0,
) {
  for (let i = startIndex; i < roadmap.length; i++) {
    const section = roadmap[i];

    if (!isIntroLikeSection(section) && hasEnoughTeachingContent(section)) {
      return i;
    }
  }

  return startIndex;
}

export function truncate(value: string, max = 900) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).trimEnd()}...`;
}

export function truncateList(items: string[], limit = 4, max = 180) {
  return items
    .map((item) => truncate(String(item || '').trim(), max))
    .filter(Boolean)
    .slice(0, limit);
}

export function safeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

export function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseTeacherBrain(value: unknown): ParsedTeacherBrain | null {
  const source = safeJsonObject<Record<string, unknown> | null>(value, null);
  if (!source) return null;

  const summary = safeJsonObject<TeacherBrainSummary>(source.summary, {});
  const chapterSummaries = safeJsonArray<Record<string, unknown>>(
    source.chapter_summaries,
  ).map((item) => ({
    section_index: Number(item.section_index),
    title: String(item.title || ''),
    summary: String(item.summary || ''),
    key_points: safeStringArray(item.key_points),
    why_it_matters: String(item.why_it_matters || ''),
    connects_to: safeStringArray(item.connects_to),
  }));

  const conceptGraph = safeJsonArray<Record<string, unknown>>(
    source.concept_graph,
  ).map((item) => ({
    concept: String(item.concept || ''),
    depends_on: safeStringArray(item.depends_on),
    leads_to: safeStringArray(item.leads_to),
    section_indexes: Array.isArray(item.section_indexes)
      ? item.section_indexes
          .map((entry) => Number(entry))
          .filter((entry) => Number.isFinite(entry))
      : [],
    importance: String(item.importance || 'medium'),
  }));

  const prerequisites = safeJsonArray<Record<string, unknown>>(
    source.prerequisites,
  ).map((item) => ({
    concept: String(item.concept || ''),
    needed_for: String(item.needed_for || ''),
    section_index: Number(item.section_index),
    student_should_know: String(item.student_should_know || ''),
  }));

  const formulas = safeJsonArray<Record<string, unknown>>(source.formulas).map(
    (item) => ({
      name: String(item.name || ''),
      formula_latex: String(item.formula_latex || ''),
      variables: safeStringArray(item.variables),
      section_index: Number(item.section_index),
      when_to_use: String(item.when_to_use || ''),
    }),
  );

  const calculationMethods = safeJsonArray<Record<string, unknown>>(
    source.calculation_methods,
  ).map((item) => ({
    topic: String(item.topic || ''),
    section_index: Number(item.section_index),
    method_steps: safeStringArray(item.method_steps),
    worked_example_summary: String(item.worked_example_summary || ''),
    common_mistakes: safeStringArray(item.common_mistakes),
    unit_or_answer_format: String(item.unit_or_answer_format || ''),
  }));

  const diagrams = safeJsonArray<Record<string, unknown>>(source.diagrams).map(
    (item) => ({
      title: String(item.title || ''),
      section_index: Number(item.section_index),
      diagram_type: String(item.diagram_type || ''),
      description: String(item.description || ''),
      when_to_show: String(item.when_to_show || ''),
      student_should_notice: safeStringArray(item.student_should_notice),
    }),
  );

  const misconceptions = safeJsonArray<Record<string, unknown>>(
    source.misconceptions,
  ).map((item) => ({
    misconception: String(item.misconception || ''),
    correction: String(item.correction || ''),
    section_index: Number(item.section_index),
  }));

  const examAngles = safeJsonArray<Record<string, unknown>>(
    source.exam_angles,
  ).map((item) => ({
    section_index: Number(item.section_index),
    likely_question_type: String(item.likely_question_type || ''),
    what_examiner_tests: String(item.what_examiner_tests || ''),
    how_to_answer: String(item.how_to_answer || ''),
  }));

  const teacherNotesSource = safeJsonObject<Record<string, unknown>>(
    source.teacher_notes,
    {},
  );
  const teacherNotes: TeacherBrainNotes = {
    teaching_style: String(teacherNotesSource.teaching_style || ''),
    best_analogies: safeStringArray(teacherNotesSource.best_analogies),
    sections_that_need_extra_care: safeStringArray(
      teacherNotesSource.sections_that_need_extra_care,
    ),
    calculation_heavy_sections: Array.isArray(
      teacherNotesSource.calculation_heavy_sections,
    )
      ? teacherNotesSource.calculation_heavy_sections
          .map((entry) => Number(entry))
          .filter((entry) => Number.isFinite(entry))
      : [],
    diagram_heavy_sections: Array.isArray(
      teacherNotesSource.diagram_heavy_sections,
    )
      ? teacherNotesSource.diagram_heavy_sections
          .map((entry) => Number(entry))
          .filter((entry) => Number.isFinite(entry))
      : [],
    recommended_teaching_sequence: safeStringArray(
      teacherNotesSource.recommended_teaching_sequence,
    ),
  };

  return {
    summary: {
      material_title: String(summary.material_title || ''),
      overall_summary: String(summary.overall_summary || ''),
      main_learning_goal: String(summary.main_learning_goal || ''),
      difficulty_level: String(summary.difficulty_level || ''),
      recommended_study_order: safeStringArray(summary.recommended_study_order),
    },
    chapterSummaries,
    conceptGraph,
    prerequisites,
    formulas,
    calculationMethods,
    diagrams,
    misconceptions,
    examAngles,
    teacherNotes,
    subjectFamily: source.subject_family ? String(source.subject_family) : null,
    confidence: Number.isFinite(Number(source.confidence))
      ? Number(source.confidence)
      : 50,
  };
}

export function getTeacherBrainSectionContext(
  teacherBrain: ParsedTeacherBrain | null,
  sectionIndex: number,
  sectionTitle: string,
): TeacherBrainSectionContext {
  if (!teacherBrain) {
    return {
      currentChapterSummary: null,
      previousChapterSummary: null,
      nextChapterSummary: null,
      concepts: [],
      prerequisites: [],
      formulas: [],
      calculationMethods: [],
      diagrams: [],
      misconceptions: [],
      examAngles: [],
      teacherNotes: {
        teaching_style: '',
        best_analogies: [],
        sections_that_need_extra_care: [],
        calculation_heavy_sections: [],
        diagram_heavy_sections: [],
        recommended_teaching_sequence: [],
      },
    };
  }

  const normalizedCurrentTitle = normalizeTitle(sectionTitle);
  const chapterMatch = (entry: TeacherBrainChapterSummary) =>
    entry.section_index === sectionIndex ||
    normalizeTitle(String(entry.title || '')) === normalizedCurrentTitle;

  const currentChapterSummary =
    teacherBrain.chapterSummaries.find(chapterMatch) || null;
  const previousChapterSummary =
    teacherBrain.chapterSummaries.find(
      (item) => item.section_index === sectionIndex - 1,
    ) || null;
  const nextChapterSummary =
    teacherBrain.chapterSummaries.find(
      (item) => item.section_index === sectionIndex + 1,
    ) || null;

  const concepts = teacherBrain.conceptGraph.filter((item) =>
    (item.section_indexes || []).includes(sectionIndex),
  );

  const prerequisites = teacherBrain.prerequisites.filter(
    (item) => item.section_index === sectionIndex,
  );
  const formulas = teacherBrain.formulas.filter(
    (item) => item.section_index === sectionIndex,
  );
  const calculationMethods = teacherBrain.calculationMethods.filter(
    (item) => item.section_index === sectionIndex,
  );
  const diagrams = teacherBrain.diagrams.filter(
    (item) => item.section_index === sectionIndex,
  );
  const misconceptions = teacherBrain.misconceptions.filter(
    (item) => item.section_index === sectionIndex,
  );
  const examAngles = teacherBrain.examAngles.filter(
    (item) => item.section_index === sectionIndex,
  );

  return {
    currentChapterSummary,
    previousChapterSummary,
    nextChapterSummary,
    concepts,
    prerequisites,
    formulas,
    calculationMethods,
    diagrams,
    misconceptions,
    examAngles,
    teacherNotes: teacherBrain.teacherNotes,
    subjectFamily: teacherBrain.subjectFamily,
    confidence: teacherBrain.confidence,
  };
}

export function hasMathNotation(text: string) {
  return /[=+\-*/^%<>]|\\\(|\\\[|\\frac|\\sum|\\int|≤|≥|≈|π|σ|μ|Δ|∑|√/.test(
    text,
  );
}

export function extractLikelyEquations(text: string) {
  const matches =
    text.match(
      /(?:\\\([^)]+\\\)|\\\[[^\]]+\\\]|[A-Za-z][A-Za-z0-9_\s]{0,12}=\s*[^,.;\n]{2,80}|\b\d+(?:\.\d+)?\s*(?:%|kg|g|mg|m|cm|mm|km|s|min|hr|hours|naira|n|pa|j|w|v|a|mol|l)\b)/g,
    ) || [];
  return truncateList(
    matches.map((item) => item.replace(/\s+/g, ' ').trim()),
    5,
    100,
  );
}

export function isCalculationHeavySection(
  section: RoadmapSection,
  teacherBrainContext: TeacherBrainSectionContext,
) {
  const subjectFamily = teacherBrainContext.subjectFamily || '';
  const calculationFamilies = new Set([
    'mathematics',
    'statistics',
    'engineering',
    'economics',
    'finance',
    'physics',
    'chemistry',
    'computer_science',
    'cybersecurity',
    'agriculture',
  ]);

  if (
    teacherBrainContext.formulas.length ||
    teacherBrainContext.calculationMethods.length
  ) {
    return true;
  }

  if (calculationFamilies.has(subjectFamily)) {
    return true;
  }

  const content = `${section.title}\n${section.content}`.toLowerCase();
  const quantitativePatterns = [
    /\bmean\b|\bmedian\b|\bmode\b|\bvariance\b|\bstandard deviation\b|\bprobability\b/,
    /\binterest\b|\bdiscount\b|\bpresent value\b|\bfuture value\b|\belasticity\b|\bcost\b|\brevenue\b/,
    /\bforce\b|\bvelocity\b|\bacceleration\b|\bdensity\b|\bmolar\b|\bconcentration\b|\bpressure\b/,
    /\balgorithmic complexity\b|\bbig o\b|\bhash\b|\bencryption\b|\bthroughput\b/,
    /\bpercentage\b|\bratio\b|\brate\b|\bunit\b|\bsolve\b|\bcalculate\b|\bsubstitute\b/,
    /\bkg\b|\bg\b|\bmg\b|\bmol\b|\blitre\b|\bl\b|\bcm\b|\bmm\b|\bkm\b|\bnaira\b|\bseconds?\b|\bminutes?\b/,
  ];

  return (
    hasMathNotation(content) ||
    quantitativePatterns.some((pattern) => pattern.test(content))
  );
}

export function buildCalculationTeachingContext(
  section: RoadmapSection,
  teacherBrainContext: TeacherBrainSectionContext,
): CalculationTeachingContext {
  const likelyEquations = extractLikelyEquations(section.content);
  const commonMistakes = truncateList(
    teacherBrainContext.calculationMethods.flatMap(
      (item) => item.common_mistakes || [],
    ),
    5,
    100,
  );
  const unitFormats = truncateList(
    teacherBrainContext.calculationMethods
      .map((item) => item.unit_or_answer_format || '')
      .filter(Boolean),
    4,
    100,
  );
  const workedExamples = truncateList(
    teacherBrainContext.calculationMethods
      .map((item) => item.worked_example_summary || '')
      .filter(Boolean),
    4,
    140,
  );

  const lines: string[] = [];
  if (teacherBrainContext.formulas.length) {
    lines.push(
      `Formulas: ${truncateList(
        teacherBrainContext.formulas.map(
          (item) =>
            `${item.name}: ${item.formula_latex}; variables: ${(item.variables || []).join(', ')}; use: ${item.when_to_use}`,
        ),
        4,
        180,
      ).join(' | ')}`,
    );
  }
  if (teacherBrainContext.calculationMethods.length) {
    lines.push(
      `Methods: ${truncateList(
        teacherBrainContext.calculationMethods.map(
          (item) =>
            `${item.topic}; steps: ${(item.method_steps || []).slice(0, 5).join(' -> ')}`,
        ),
        4,
        180,
      ).join(' | ')}`,
    );
  }
  if (workedExamples.length) {
    lines.push(`Worked examples: ${workedExamples.join(' | ')}`);
  }
  if (commonMistakes.length) {
    lines.push(`Common mistakes: ${commonMistakes.join(' | ')}`);
  }
  if (unitFormats.length) {
    lines.push(`Unit or answer format: ${unitFormats.join(' | ')}`);
  }
  if (likelyEquations.length) {
    lines.push(`Likely equations from section: ${likelyEquations.join(' | ')}`);
  }
  if (teacherBrainContext.prerequisites.length) {
    lines.push(
      `Prerequisites before solving: ${truncateList(
        teacherBrainContext.prerequisites.map(
          (item) => `${item.concept}: ${item.student_should_know}`,
        ),
        4,
        120,
      ).join(' | ')}`,
    );
  }

  return {
    detected: isCalculationHeavySection(section, teacherBrainContext),
    formulas: teacherBrainContext.formulas,
    calculationMethods: teacherBrainContext.calculationMethods,
    prerequisites: teacherBrainContext.prerequisites,
    likelyEquations,
    commonMistakes,
    unitFormats,
    workedExamples,
    subjectFamily: teacherBrainContext.subjectFamily || null,
    summary: lines.join('\n'),
  };
}

export function buildCalculationInstructions(
  pass: 1 | 2 | 3,
  calculationContext: CalculationTeachingContext,
) {
  if (!calculationContext.detected) return '';

  if (pass === 1) {
    return [
      'Calculation teaching mode: Pass 1.',
      'Explain the big idea behind the calculation.',
      'Explain what problem type the formula or method solves.',
      'Do not solve a full problem unless the section itself clearly requires it.',
      'Avoid asking questions.',
    ].join(' ');
  }

  if (pass === 2) {
    return [
      'Calculation teaching mode: Pass 2.',
      'Teach the formula or method step by step.',
      'Define each variable before substitution.',
      'Show the solving order clearly.',
      'Include one short worked example if possible.',
      'Preserve formulas using LaTeX delimiters.',
    ].join(' ');
  }

  return [
    'Calculation teaching mode: Pass 3.',
    'Connect the calculation to exam use.',
    'Explain common traps and how to recognize when to apply the method.',
    'Mention units, final answer format, or interpretation where relevant.',
    'Avoid asking questions.',
  ].join(' ');
}

export function isDiagramHeavySection(
  section: RoadmapSection,
  teacherBrainContext: TeacherBrainSectionContext,
) {
  const subjectFamily = teacherBrainContext.subjectFamily || '';
  const diagramFamilies = new Set([
    'biology',
    'medicine',
    'engineering',
    'agriculture',
    'geography',
    'chemistry',
    'computer_science',
    'cybersecurity',
    'economics',
    'statistics',
  ]);

  if (teacherBrainContext.diagrams.length) {
    return true;
  }

  if (diagramFamilies.has(subjectFamily)) {
    return true;
  }

  const content = `${section.title}\n${section.content}`.toLowerCase();
  return /\bdiagram\b|\bfigure\b|\bchart\b|\btable\b|\bgraph\b|\bcurve\b|\bmap\b|\bflowchart\b|\bprocess\b|\baxis\b|\bx-axis\b|\by-axis\b|\barrow\b|\blabel\b|\bimage caption\b|\bimage description\b/.test(
    content,
  );
}

export function buildDiagramTeachingContext(
  section: RoadmapSection,
  teacherBrainContext: TeacherBrainSectionContext,
): DiagramTeachingContext {
  const imageDescriptions = truncateList(
    section.content
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) =>
        /^image (caption|description)|^alt text|^figure|^diagram|^chart|^graph/i.test(
          line,
        ),
      ),
    5,
    160,
  );

  const lines: string[] = [];
  if (teacherBrainContext.diagrams.length) {
    lines.push(
      `Diagrams: ${truncateList(
        teacherBrainContext.diagrams.map(
          (item) =>
            `${item.title} (${item.diagram_type}) | section ${Number(item.section_index) + 1} | ${item.description} | when: ${item.when_to_show} | notice: ${(item.student_should_notice || []).slice(0, 3).join(', ')}`,
        ),
        4,
        220,
      ).join(' | ')}`,
    );
  }
  if (imageDescriptions.length) {
    lines.push(
      `Image descriptions already in content: ${imageDescriptions.join(' | ')}`,
    );
  }

  return {
    detected: isDiagramHeavySection(section, teacherBrainContext),
    diagrams: teacherBrainContext.diagrams,
    imageDescriptions,
    subjectFamily: teacherBrainContext.subjectFamily || null,
    summary: lines.join('\n'),
  };
}

export function buildDiagramInstructions(
  pass: 1 | 2 | 3,
  diagramContext: DiagramTeachingContext,
) {
  if (!diagramContext.detected) return '';

  if (pass === 1) {
    return [
      'Diagram teaching mode: Pass 1.',
      'Introduce the visual idea.',
      'Explain why the diagram matters.',
      'Describe the big picture without too much detail.',
      'Use imagine or picture instead of claiming an image is on screen.',
    ].join(' ');
  }

  if (pass === 2) {
    return [
      'Diagram teaching mode: Pass 2.',
      'Walk through the diagram or process step by step.',
      'Explain labels, parts, arrows, axes, stages, or relationships.',
      'For graphs, explain x-axis, y-axis, trend, slope, peak, movement, or comparison where relevant.',
      'For anatomy or biology, explain parts and functions.',
      'For engineering or computer science, explain flow, components, inputs, outputs, or system behavior.',
    ].join(' ');
  }

  return [
    'Diagram teaching mode: Pass 3.',
    'Connect the diagram to exam use.',
    'Explain what examiners usually ask from the diagram.',
    'Highlight common visual mistakes or mislabeling.',
    'Explain how the student should reproduce or interpret the diagram.',
  ].join(' ');
}

export function mapDiagramTypeToSuggestedRenderer(
  diagramType?: string,
): StudyVisualSuggestedRenderer {
  const normalized = String(diagramType || '')
    .trim()
    .toLowerCase();

  switch (normalized) {
    case 'flowchart':
      return 'flowchart';
    case 'graph':
      return 'graph';
    case 'equation_breakdown':
      return 'equation_breakdown';
    case 'anatomy':
      return 'labeled_diagram';
    case 'process':
      return 'process_steps';
    case 'table':
      return 'table';
    case 'map':
      return 'future_image_generation';
    default:
      return 'mental_model';
  }
}

export function buildTeacherBrainPromptContext(
  teacherBrain: ParsedTeacherBrain | null,
  currentSectionIndex: number,
  roadmap: RoadmapSection[],
) {
  if (!teacherBrain) return '';

  const currentSection =
    roadmap[Math.max(0, Math.min(currentSectionIndex, roadmap.length - 1))];
  const sectionContext = getTeacherBrainSectionContext(
    teacherBrain,
    currentSectionIndex,
    currentSection?.title || '',
  );
  const lines: string[] = [];

  if (teacherBrain.summary.overall_summary) {
    lines.push(
      `Overall material summary: ${truncate(teacherBrain.summary.overall_summary, 320)}`,
    );
  }
  if (teacherBrain.summary.main_learning_goal) {
    lines.push(
      `Main learning goal: ${truncate(teacherBrain.summary.main_learning_goal, 180)}`,
    );
  }
  if (teacherBrain.subjectFamily) {
    lines.push(`Subject family: ${teacherBrain.subjectFamily}`);
  }
  if (teacherBrain.summary.recommended_study_order?.length) {
    lines.push(
      `Recommended study order: ${truncateList(teacherBrain.summary.recommended_study_order, 6, 80).join(' | ')}`,
    );
  }
  if (sectionContext.currentChapterSummary?.summary) {
    lines.push(
      `Current chapter summary: ${truncate(sectionContext.currentChapterSummary.summary, 220)}`,
    );
  }
  if (sectionContext.previousChapterSummary?.summary) {
    lines.push(
      `Previous section bridge: ${truncate(sectionContext.previousChapterSummary.summary, 140)}`,
    );
  }
  if (sectionContext.nextChapterSummary?.summary) {
    lines.push(
      `Next section preview: ${truncate(sectionContext.nextChapterSummary.summary, 140)}`,
    );
  }
  if (sectionContext.concepts.length) {
    lines.push(
      `Connected concepts: ${truncateList(
        sectionContext.concepts.map(
          (item) => `${item.concept} (${item.importance})`,
        ),
        5,
        90,
      ).join(' | ')}`,
    );
  }
  if (sectionContext.prerequisites.length) {
    lines.push(
      `Prerequisites: ${truncateList(
        sectionContext.prerequisites.map(
          (item) => `${item.concept}: ${item.student_should_know}`,
        ),
        4,
        120,
      ).join(' | ')}`,
    );
  }
  if (sectionContext.formulas.length) {
    lines.push(
      `Formulas: ${truncateList(
        sectionContext.formulas.map(
          (item) =>
            `${item.name}: ${item.formula_latex} | use: ${item.when_to_use}`,
        ),
        4,
        140,
      ).join(' | ')}`,
    );
  }
  if (sectionContext.calculationMethods.length) {
    lines.push(
      `Calculation methods: ${truncateList(
        sectionContext.calculationMethods.map(
          (item) =>
            `${item.topic} | steps: ${(item.method_steps || []).slice(0, 4).join(' -> ')} | mistakes: ${(item.common_mistakes || []).slice(0, 2).join(', ')}`,
        ),
        3,
        180,
      ).join(' | ')}`,
    );
  }
  if (sectionContext.diagrams.length) {
    lines.push(
      `Diagrams: ${truncateList(
        sectionContext.diagrams.map(
          (item) =>
            `${item.title} (${item.diagram_type}) - ${item.description}`,
        ),
        3,
        140,
      ).join(' | ')}`,
    );
  }
  if (sectionContext.misconceptions.length) {
    lines.push(
      `Common misconceptions: ${truncateList(
        sectionContext.misconceptions.map(
          (item) => `${item.misconception} -> ${item.correction}`,
        ),
        3,
        140,
      ).join(' | ')}`,
    );
  }
  if (sectionContext.examAngles.length) {
    lines.push(
      `Exam angles: ${truncateList(
        sectionContext.examAngles.map(
          (item) => `${item.likely_question_type}: ${item.what_examiner_tests}`,
        ),
        3,
        140,
      ).join(' | ')}`,
    );
  }

  const notes: string[] = [];
  if (sectionContext.teacherNotes.teaching_style) {
    notes.push(
      `style: ${truncate(sectionContext.teacherNotes.teaching_style, 120)}`,
    );
  }
  if ((sectionContext.teacherNotes.best_analogies || []).length) {
    notes.push(
      `analogies: ${truncateList(sectionContext.teacherNotes.best_analogies || [], 2, 80).join(', ')}`,
    );
  }
  if (
    (sectionContext.teacherNotes.sections_that_need_extra_care || []).some(
      (item) =>
        normalizeTitle(item) === normalizeTitle(currentSection?.title || ''),
    )
  ) {
    notes.push('this section needs extra care');
  }
  if (
    (sectionContext.teacherNotes.calculation_heavy_sections || []).includes(
      currentSectionIndex,
    )
  ) {
    notes.push('calculation-heavy section');
  }
  if (
    (sectionContext.teacherNotes.diagram_heavy_sections || []).includes(
      currentSectionIndex,
    )
  ) {
    notes.push('diagram-heavy section');
  }
  if (notes.length) {
    lines.push(`Teacher notes: ${notes.join(' | ')}`);
  }

  return lines.join('\n');
}
