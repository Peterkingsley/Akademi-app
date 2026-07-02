import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { aiProvider } from '../ai/ai.provider';
import { buildReaderStructure, normalizeExtractedText } from './reader-structure';

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

type CompatibilityMaterialRecord = {
  id: string;
  title: string;
  course_code: string | null;
  university: string;
  faculty: string;
  department: string;
  level: number;
  file_ref: string;
  file_type: string;
  processing_status: 'UPLOADED' | 'QUEUED' | 'EXTRACTING' | 'EXTRACTED' | 'FAILED';
  content: string | null;
  reader_structure: unknown;
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

const EMBEDDING_BATCH_SIZE = Math.max(Number(process.env.MATERIAL_EMBEDDING_BATCH_SIZE || 5), 1);

function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.substring(i, i + size));
  }
  return chunks;
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

function hasReaderImageBlocks(readerStructure: unknown) {
  const pages = Array.isArray((readerStructure as { pages?: unknown[] })?.pages)
    ? ((readerStructure as { pages: unknown[] }).pages as Array<{ blocks?: unknown[] }>)
    : [];

  return pages.some((page) =>
    Array.isArray(page.blocks) && page.blocks.some((block) => {
      const item = block as { type?: unknown; src?: unknown };
      return item?.type === 'image' && typeof item?.src === 'string' && item.src.trim().length > 0;
    }));
}

function contentSuggestsFigures(content: string) {
  return /(figure\s*\d+|diagram|chart|graph|illustration|image)/i.test(content);
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

async function loadMaterialForTeacherBrain(materialId: string) {
  return prisma.material.findUnique({
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
      teacher_brain: {
        select: {
          id: true,
          summary: true,
          chapter_summaries: true,
          concept_graph: true,
          prerequisites: true,
          formulas: true,
          calculation_methods: true,
          diagrams: true,
          misconceptions: true,
          exam_angles: true,
          teacher_notes: true,
          subject_family: true,
          confidence: true,
          generated_at: true,
          updated_at: true,
        },
      },
    },
  });
}

async function rebuildMaterialEmbeddings(materialId: string, content: string) {
  const normalizedContent = normalizeExtractedText(content);
  if (!normalizedContent) return 0;

  const chunks = chunkText(normalizedContent, 2000);
  await prisma.materialEmbedding.deleteMany({
    where: { material_id: materialId },
  });

  let created = 0;
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    const vectors = await Promise.all(batch.map((chunk) => aiProvider.generateEmbedding(chunk)));
    await prisma.materialEmbedding.createMany({
      data: batch.map((chunk, batchIndex) => ({
        material_id: materialId,
        chunk_index: i + batchIndex,
        chunk_text: chunk,
        embedding: vectors[batchIndex] as unknown as Prisma.InputJsonValue,
      })),
    });
    created += batch.length;
  }

  return created;
}

async function ensureMaterialStudyCompanionCompatibility(materialId: string) {
  const actions: string[] = [];

  const loadMaterial = async () => prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      title: true,
      course_code: true,
      university: true,
      faculty: true,
      department: true,
      level: true,
      file_ref: true,
      file_type: true,
      processing_status: true as any,
      content: true,
      reader_structure: true,
    } as any,
  }) as Promise<CompatibilityMaterialRecord | null>;

  let material = await loadMaterial();
  if (!material) {
    throw new Error('Material not found.');
  }

  const shouldReingestForContent = !material.content?.trim() && Boolean(material.file_ref);
  const shouldReingestLegacyDoc =
    material.file_type === 'DOC' &&
    Boolean(material.content?.trim()) &&
    contentSuggestsFigures(material.content || '') &&
    !hasReaderImageBlocks(material.reader_structure);

  if (shouldReingestForContent || shouldReingestLegacyDoc) {
    const { ingestMaterialJob } = await import('../../jobs/ingestMaterial.job');
    await ingestMaterialJob(materialId);
    actions.push(shouldReingestForContent ? 'reingested_missing_content' : 'reingested_legacy_doc_reader_structure');
    material = await loadMaterial();
    if (!material) {
      throw new Error('Material not found after compatibility re-ingest.');
    }
  }

  if (!material.content?.trim()) {
    throw new Error('Material content is required for compatibility backfill.');
  }

  const normalizedContent = normalizeExtractedText(material.content);
  if (normalizedContent !== material.content) {
    await prisma.material.update({
      where: { id: materialId },
      data: {
        content: normalizedContent,
      },
    });
    actions.push('normalized_content');
    material = await loadMaterial();
    if (!material) {
      throw new Error('Material not found after content normalization.');
    }
  }

  if (!material.reader_structure) {
    const readerStructure = buildReaderStructure(normalizedContent);
    await prisma.material.update({
      where: { id: materialId },
      data: {
        reader_structure: readerStructure as unknown as Prisma.InputJsonValue,
        processing_status: 'EXTRACTED' as any,
      } as any,
    });
    actions.push('rebuilt_reader_structure');
    material = await loadMaterial();
    if (!material) {
      throw new Error('Material not found after reader structure rebuild.');
    }
  }

  const expectedChunks = chunkText(normalizedContent, 2000);
  const currentEmbeddings = await prisma.materialEmbedding.findMany({
    where: { material_id: materialId },
    select: {
      chunk_index: true,
      chunk_text: true,
    },
    orderBy: { chunk_index: 'asc' },
  });

  const embeddingsMatch =
    currentEmbeddings.length === expectedChunks.length &&
    currentEmbeddings.every((embedding, index) => embedding.chunk_index === index && embedding.chunk_text === expectedChunks[index]);

  if (!embeddingsMatch) {
    await rebuildMaterialEmbeddings(materialId, normalizedContent);
    actions.push(currentEmbeddings.length ? 'rebuilt_embeddings' : 'generated_embeddings');
  }

  if (material.processing_status !== 'EXTRACTED') {
    await prisma.material.update({
      where: { id: materialId },
      data: {
        processing_status: 'EXTRACTED' as any,
        processing_error: null,
      } as any,
    });
    actions.push('marked_extracted');
  }

  return { actions };
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

export async function regenerateTeacherBrain(materialId: string, options?: { force?: boolean }) {
  console.log('teacher_brain_regeneration_requested', {
    materialId,
    force: options?.force === true,
  });

  const material = await loadMaterialForTeacherBrain(materialId);
  if (!material) {
    throw new Error('Material not found.');
  }

  if (!material.content || !material.reader_structure) {
    throw new Error('Material content and reader structure are required.');
  }

  if (material.teacher_brain && !options?.force) {
    return material.teacher_brain;
  }

  const record = await generateMaterialTeacherBrain(materialId).catch(async (error) => {
    console.error('teacher_brain_generation_failed', {
      materialId,
      message: error instanceof Error ? error.message : 'Unknown regeneration error',
      stage: 'regeneration',
    });
    return createFallbackTeacherBrain(materialId);
  });

  console.log('teacher_brain_regeneration_completed', {
    materialId,
    force: options?.force === true,
  });
  return record;
}

export async function backfillTeacherBrains(options?: {
  limit?: number;
  courseCode?: string;
  department?: string;
  subjectFamily?: string;
  missingOnly?: boolean;
  force?: boolean;
}) {
  const limit = Math.min(Math.max(Number(options?.limit) || 20, 1), 100);
  const missingOnly = options?.missingOnly !== false;
  const force = options?.force === true;

  console.log('teacher_brain_backfill_started', {
    limit,
    courseCode: options?.courseCode || null,
    department: options?.department || null,
    subjectFamily: options?.subjectFamily || null,
    missingOnly,
    force,
  });

  const materials = await prisma.material.findMany({
    where: {
      file_ref: { not: '' },
      OR: [
        { processing_status: 'EXTRACTED' as any },
        { content: { not: null } },
      ],
      ...(options?.courseCode ? { course_code: options.courseCode } : {}),
      ...(options?.department ? { department: options.department } : {}),
      ...(options?.subjectFamily
        ? {
            teacher_brain: {
              is: {
                subject_family: options.subjectFamily,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      teacher_brain: {
        select: { id: true },
      },
    },
    take: limit,
    orderBy: { created_at: 'desc' },
  });

  const result = {
    scanned: materials.length,
    compatibilityRepaired: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    errors: [] as Array<{ materialId: string; message: string }>,
  };

  for (const material of materials) {
    try {
      const compatibility = await ensureMaterialStudyCompanionCompatibility(material.id);
      if (compatibility.actions.length) {
        result.compatibilityRepaired += 1;
      }

      if (material.teacher_brain && !force) {
        result.skipped += 1;
        continue;
      }

      await regenerateTeacherBrain(material.id, { force });
      result.generated += 1;
    } catch (error) {
      result.failed += 1;
      const message = error instanceof Error ? error.message : 'Unknown backfill error';
      result.errors.push({ materialId: material.id, message });
      console.error('teacher_brain_backfill_failed_item', {
        materialId: material.id,
        message,
      });
    }
  }

  console.log('teacher_brain_backfill_completed', {
    scanned: result.scanned,
    compatibilityRepaired: result.compatibilityRepaired,
    generated: result.generated,
    skipped: result.skipped,
    failed: result.failed,
  });

  return result;
}
