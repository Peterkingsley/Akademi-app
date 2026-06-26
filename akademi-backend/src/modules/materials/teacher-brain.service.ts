import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { aiProvider } from '../ai/ai.provider';

type ReaderStructurePage = {
  chapterTitle?: string;
  pageTitle?: string;
  content?: string;
  pageNumber?: number;
};

type TeacherBrainRecord = {
  summary: Record<string, unknown>;
  chapter_summaries: Array<Record<string, unknown>>;
  concept_graph: Array<Record<string, unknown>>;
  prerequisites: Array<Record<string, unknown>>;
  formulas: Array<Record<string, unknown>>;
  calculation_methods: Array<Record<string, unknown>>;
  diagrams: Array<Record<string, unknown>>;
  misconceptions: Array<Record<string, unknown>>;
  exam_angles: Array<Record<string, unknown>>;
  teacher_notes: Record<string, unknown>;
  subject_family: string | null;
  confidence: number;
};

const SUBJECT_FAMILIES = [
  'mathematics',
  'statistics',
  'engineering',
  'medicine',
  'biology',
  'agriculture',
  'economics',
  'finance',
  'computer_science',
  'cybersecurity',
  'arts',
  'general',
] as const;

function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function safeObject(value: unknown, fallback: Record<string, unknown> = {}) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fallback;
}

function safeArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => safeObject(item)) : [];
}

function summarizeSections(readerStructure: unknown) {
  const pages = Array.isArray((readerStructure as { pages?: unknown[] })?.pages)
    ? ((readerStructure as { pages: unknown[] }).pages as ReaderStructurePage[])
    : [];

  const seen = new Set<string>();
  const sections: string[] = [];

  pages.forEach((page, index) => {
    const title = String(page.chapterTitle || page.pageTitle || `Section ${index + 1}`).trim();
    const content = String(page.content || '').replace(/\s+/g, ' ').trim();
    const key = `${title.toLowerCase()}::${content.slice(0, 40).toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    sections.push(`${index + 1}. ${title}${content ? ` - ${content.slice(0, 220)}` : ''}`);
  });

  return sections.slice(0, 20);
}

function inferSubjectFamily(material: {
  title: string;
  course_code: string | null;
  faculty: string;
  department: string;
  content: string;
}) {
  const haystack = [
    material.title,
    material.course_code || '',
    material.faculty,
    material.department,
    material.content.slice(0, 2000),
  ]
    .join(' ')
    .toLowerCase();

  const checks: Array<{ family: (typeof SUBJECT_FAMILIES)[number]; terms: string[] }> = [
    { family: 'cybersecurity', terms: ['cyber', 'security', 'cryptography', 'network defense'] },
    { family: 'computer_science', terms: ['computer', 'programming', 'software', 'algorithm', 'database'] },
    { family: 'medicine', terms: ['medicine', 'clinical', 'anatomy', 'physiology', 'pharmacology'] },
    { family: 'biology', terms: ['biology', 'genetics', 'ecology', 'microbiology', 'cell'] },
    { family: 'engineering', terms: ['engineering', 'circuit', 'thermodynamics', 'mechanics', 'control system'] },
    { family: 'mathematics', terms: ['mathematics', 'calculus', 'algebra', 'geometry', 'differential equation'] },
    { family: 'statistics', terms: ['statistics', 'probability', 'regression', 'variance', 'sampling'] },
    { family: 'economics', terms: ['economics', 'microeconomics', 'macroeconomics', 'elasticity', 'market'] },
    { family: 'finance', terms: ['finance', 'accounting', 'investment', 'portfolio', 'cash flow'] },
    { family: 'agriculture', terms: ['agriculture', 'crop', 'soil', 'livestock', 'agronomy'] },
    { family: 'arts', terms: ['arts', 'literature', 'history', 'philosophy', 'theatre'] },
  ];

  const match = checks.find((entry) => entry.terms.some((term) => haystack.includes(term)));
  return match?.family || 'general';
}

function buildFallbackTeacherBrain(material: {
  id: string;
  title: string;
  course_code: string | null;
  university: string;
  faculty: string;
  department: string;
  level: number;
  content: string;
  reader_structure: unknown;
}): TeacherBrainRecord {
  const sections = summarizeSections(material.reader_structure);
  const inferredFamily = inferSubjectFamily(material);

  return {
    summary: {
      material_title: material.title,
      overall_summary: material.content.slice(0, 700).trim() || `Study material for ${material.title}.`,
      main_learning_goal: `Help tertiary students understand the core ideas in ${material.title}.`,
      difficulty_level: material.level >= 500 ? 'advanced' : material.level >= 300 ? 'intermediate' : 'beginner',
      recommended_study_order: sections.map((entry) => entry.replace(/^\d+\.\s*/, '').split(' - ')[0]).slice(0, 8),
    },
    chapter_summaries: sections.slice(0, 8).map((entry, index) => {
      const [title, summary = ''] = entry.replace(/^\d+\.\s*/, '').split(' - ');
      return {
        section_index: index,
        title,
        summary,
        key_points: [],
        why_it_matters: `This section supports the overall understanding of ${material.title}.`,
        connects_to: [],
      };
    }),
    concept_graph: [],
    prerequisites: [],
    formulas: [],
    calculation_methods: [],
    diagrams: [],
    misconceptions: [],
    exam_angles: [],
    teacher_notes: {
      teaching_style: 'Start from the material structure and expand examples where needed.',
      best_analogies: [],
      sections_that_need_extra_care: [],
      calculation_heavy_sections: [],
      diagram_heavy_sections: [],
      recommended_teaching_sequence: sections.map((entry) => entry.replace(/^\d+\.\s*/, '').split(' - ')[0]).slice(0, 8),
    },
    subject_family: inferredFamily,
    confidence: 35,
  };
}

function normalizeTeacherBrain(raw: unknown, fallback: TeacherBrainRecord): TeacherBrainRecord {
  const data = safeObject(raw);
  const subjectFamily = String(data.subject_family || fallback.subject_family || 'general');
  const normalizedSubjectFamily = SUBJECT_FAMILIES.includes(subjectFamily as (typeof SUBJECT_FAMILIES)[number])
    ? subjectFamily
    : 'general';

  return {
    summary: safeObject(data.summary, fallback.summary),
    chapter_summaries: safeArray(data.chapter_summaries).length ? safeArray(data.chapter_summaries) : fallback.chapter_summaries,
    concept_graph: safeArray(data.concept_graph),
    prerequisites: safeArray(data.prerequisites),
    formulas: safeArray(data.formulas),
    calculation_methods: safeArray(data.calculation_methods),
    diagrams: safeArray(data.diagrams),
    misconceptions: safeArray(data.misconceptions),
    exam_angles: safeArray(data.exam_angles),
    teacher_notes: safeObject(data.teacher_notes, fallback.teacher_notes),
    subject_family: normalizedSubjectFamily,
    confidence: clampConfidence(data.confidence),
  };
}

function tryParseJson(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function saveTeacherBrain(
  material: {
    id: string;
    course_code: string | null;
    university: string;
    faculty: string;
    department: string;
    level: number;
  },
  teacherBrain: TeacherBrainRecord,
) {
  return prisma.materialTeacherBrain.upsert({
    where: { material_id: material.id },
    create: {
      material_id: material.id,
      course_code: material.course_code,
      university: material.university,
      faculty: material.faculty,
      department: material.department,
      level: material.level,
      summary: teacherBrain.summary as Prisma.InputJsonValue,
      chapter_summaries: teacherBrain.chapter_summaries as Prisma.InputJsonValue,
      concept_graph: teacherBrain.concept_graph as Prisma.InputJsonValue,
      prerequisites: teacherBrain.prerequisites as Prisma.InputJsonValue,
      formulas: teacherBrain.formulas as Prisma.InputJsonValue,
      calculation_methods: teacherBrain.calculation_methods as Prisma.InputJsonValue,
      diagrams: teacherBrain.diagrams as Prisma.InputJsonValue,
      misconceptions: teacherBrain.misconceptions as Prisma.InputJsonValue,
      exam_angles: teacherBrain.exam_angles as Prisma.InputJsonValue,
      teacher_notes: teacherBrain.teacher_notes as Prisma.InputJsonValue,
      subject_family: teacherBrain.subject_family,
      confidence: teacherBrain.confidence,
    },
    update: {
      course_code: material.course_code,
      university: material.university,
      faculty: material.faculty,
      department: material.department,
      level: material.level,
      summary: teacherBrain.summary as Prisma.InputJsonValue,
      chapter_summaries: teacherBrain.chapter_summaries as Prisma.InputJsonValue,
      concept_graph: teacherBrain.concept_graph as Prisma.InputJsonValue,
      prerequisites: teacherBrain.prerequisites as Prisma.InputJsonValue,
      formulas: teacherBrain.formulas as Prisma.InputJsonValue,
      calculation_methods: teacherBrain.calculation_methods as Prisma.InputJsonValue,
      diagrams: teacherBrain.diagrams as Prisma.InputJsonValue,
      misconceptions: teacherBrain.misconceptions as Prisma.InputJsonValue,
      exam_angles: teacherBrain.exam_angles as Prisma.InputJsonValue,
      teacher_notes: teacherBrain.teacher_notes as Prisma.InputJsonValue,
      subject_family: teacherBrain.subject_family,
      confidence: teacherBrain.confidence,
      generated_at: new Date(),
    },
  });
}

export async function createFallbackTeacherBrain(materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      title: true,
      course_code: true,
      university: true,
      faculty: true,
      department: true,
      level: true,
      content: true,
      reader_structure: true,
    },
  });

  if (!material?.content) {
    throw new Error('Material content is required to build a fallback teacher brain.');
  }

  const fallback = buildFallbackTeacherBrain({
    ...material,
    content: material.content,
  });

  const record = await saveTeacherBrain(material, fallback);
  console.log('teacher_brain_fallback_created', {
    materialId,
    confidence: fallback.confidence,
    subjectFamily: fallback.subject_family,
  });
  return record;
}

export async function generateMaterialTeacherBrain(materialId: string) {
  console.log('teacher_brain_generation_started', {
    materialId,
    timestamp: new Date().toISOString(),
  });

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      title: true,
      course_code: true,
      university: true,
      faculty: true,
      department: true,
      level: true,
      content: true,
      reader_structure: true,
    },
  });

  if (!material) {
    throw new Error('Material not found.');
  }

  if (!material.content || !material.reader_structure) {
    throw new Error('Material content and reader structure are required.');
  }

  const fallback = buildFallbackTeacherBrain({
    ...material,
    content: material.content,
  });

  const sectionOutline = summarizeSections(material.reader_structure);
  const prompt = [
    'Return JSON only.',
    'No markdown.',
    'Preserve mathematical formulas in LaTeX.',
    'This is for tertiary institution students.',
    'If material is calculation-heavy, prioritize formulas and step-by-step methods.',
    'If material is diagram-heavy, identify diagrams clearly.',
    'Handle diverse courses including engineering, medicine, agriculture, finance, arts, cybersecurity, mathematics, statistics, economics, biology, and related fields.',
    'Use this exact JSON shape with keys: summary, chapter_summaries, concept_graph, prerequisites, formulas, calculation_methods, diagrams, misconceptions, exam_angles, teacher_notes, subject_family, confidence.',
    `Material title: ${material.title}`,
    `Course code: ${material.course_code || 'unknown'}`,
    `University: ${material.university}`,
    `Faculty: ${material.faculty}`,
    `Department: ${material.department}`,
    `Level: ${material.level}`,
    `Reader structure sections:\n${sectionOutline.join('\n')}`,
    `Material content:\n${material.content.slice(0, 18000)}`,
  ].join('\n\n');

  let normalized = fallback;

  try {
    const response = await aiProvider.generateResponse(prompt, {
      maxTokens: 3000,
      systemPrompt:
        'You are building a reusable Teacher Brain for a university study material. Return valid JSON only, with no prose outside the JSON object.',
    });

    const parsed = tryParseJson(response);
    if (!parsed) {
      throw new Error('Teacher brain AI response was not valid JSON.');
    }

    normalized = normalizeTeacherBrain(parsed, fallback);
  } catch (error) {
    console.error('teacher_brain_generation_failed', {
      materialId,
      message: error instanceof Error ? error.message : 'Unknown teacher brain error',
    });
    const record = await saveTeacherBrain(material, fallback);
    console.log('teacher_brain_generation_completed', {
      materialId,
      confidence: fallback.confidence,
      fallback: true,
    });
    console.log('teacher_brain_fallback_created', {
      materialId,
      confidence: fallback.confidence,
      subjectFamily: fallback.subject_family,
    });
    return record;
  }

  const record = await saveTeacherBrain(material, normalized);
  console.log('teacher_brain_generation_completed', {
    materialId,
    confidence: normalized.confidence,
    fallback: false,
  });
  return record;
}
