import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { aiProvider } from '../ai/ai.provider';
import {
  RoadmapSection,
  TeacherBrainSectionContext,
  CalculationTeachingContext,
  DiagramTeachingContext,
  StudySectionLessonPlanRecord,
  RelevantMaterialContext,
  StudySectionLessonPlanRow,
  MaterialEmbeddingRow,
} from './study-companion.types';
import { normalizeText } from './study-companion-prompt-directives';
import { truncate } from './study-companion-teacher-brain';
import {
  cosineSimilarity,
  parseEmbeddingVector,
  tokenOverlapScore,
  explainChunkRelevance,
  parseStudySectionLessonPlanRecord,
  buildFallbackLessonPlan,
  generateText,
} from './study-companion-quality-relevance';
import { companionSystemPrompt } from './study-companion-session-state';

export async function getOrCreateLessonPlan(args: {
  sessionId: string;
  companionStateId: string;
  userId: string;
  materialId: string;
  courseCode: string;
  section: RoadmapSection;
  sectionIndex: number;
  teacherBrainContext: string;
  calculationContext: CalculationTeachingContext;
  diagramContext: DiagramTeachingContext;
  studentMemoryPromptContext: string;
}) {
  const studySectionLessonPlan = (
    prisma as typeof prisma & {
      studySectionLessonPlan: {
        findFirst: (
          query: unknown,
        ) => Promise<StudySectionLessonPlanRow | null>;
        upsert: (query: unknown) => Promise<StudySectionLessonPlanRow>;
      };
    }
  ).studySectionLessonPlan;

  const existing = await studySectionLessonPlan.findFirst({
    where: {
      session_id: args.sessionId,
      section_index: args.sectionIndex,
    },
  });

  if (existing) {
    const parsed = parseStudySectionLessonPlanRecord(existing);
    console.log('lesson_plan_context_applied', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
      source: 'reused',
    });
    return parsed;
  }

  console.log('lesson_plan_generation_started', {
    sessionId: args.sessionId,
    materialId: args.materialId,
    sectionIndex: args.sectionIndex,
  });

  const fallback = buildFallbackLessonPlan({
    section: args.section,
    calculationContext: args.calculationContext,
    diagramContext: args.diagramContext,
    studentMemoryPromptContext: args.studentMemoryPromptContext,
    teacherBrainContext: args.teacherBrainContext,
  });

  try {
    const prompt = [
      'Return JSON only.',
      'No markdown.',
      `Course code: ${args.courseCode}`,
      `Section title: ${args.section.title}`,
      args.teacherBrainContext
        ? `Teacher Brain context:\n${args.teacherBrainContext}`
        : '',
      args.studentMemoryPromptContext
        ? `Student memory context:\n${args.studentMemoryPromptContext}`
        : '',
      args.calculationContext.detected
        ? `Calculation context:\n${args.calculationContext.summary}`
        : '',
      args.diagramContext.detected
        ? `Diagram context:\n${args.diagramContext.summary}`
        : '',
      `Section content:\n${truncate(args.section.content, 3200)}`,
      'Create a compact internal lesson plan JSON with keys: lesson_objective, prerequisite_refresh, teaching_sequence, analogy_plan, calculation_plan, diagram_plan, checkpoint_focus, exam_focus, fallback_plan.',
      'The plan is for internal tutoring only. Keep it concise, specific to the section, exam-aware, and suitable for a tertiary institution student.',
      'Use current section content as the source of truth.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const raw = await generateText(
      prompt,
      `${companionSystemPrompt()}\nCreate compact internal lesson plans for one section at a time. Return valid JSON only.`,
      900,
    );

    let parsedJson: Record<string, unknown> | null = null;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          parsedJson = JSON.parse(raw.slice(start, end + 1));
        } catch {
          parsedJson = null;
        }
      }
    }

    if (!parsedJson) {
      throw new Error('Lesson plan JSON parse failed.');
    }

    const normalized = parseStudySectionLessonPlanRecord({
      lesson_objective:
        typeof parsedJson.lesson_objective === 'string'
          ? parsedJson.lesson_objective
          : '',
      prerequisite_refresh: parsedJson.prerequisite_refresh,
      teaching_sequence: parsedJson.teaching_sequence,
      analogy_plan: parsedJson.analogy_plan,
      calculation_plan: parsedJson.calculation_plan,
      diagram_plan: parsedJson.diagram_plan,
      checkpoint_focus: parsedJson.checkpoint_focus,
      exam_focus: parsedJson.exam_focus,
      fallback_plan: parsedJson.fallback_plan,
    });

    await studySectionLessonPlan.upsert({
      where: { id: `missing-${args.sessionId}-${args.sectionIndex}` },
      create: {
        session_id: args.sessionId,
        companion_state_id: args.companionStateId,
        user_id: args.userId,
        material_id: args.materialId,
        course_code: args.courseCode,
        section_index: args.sectionIndex,
        section_title: args.section.title,
        lesson_objective:
          normalized.lessonObjective || fallback.lessonObjective,
        prerequisite_refresh:
          normalized.prerequisiteRefresh as unknown as Prisma.InputJsonValue,
        teaching_sequence:
          normalized.teachingSequence as unknown as Prisma.InputJsonValue,
        analogy_plan:
          normalized.analogyPlan as unknown as Prisma.InputJsonValue,
        calculation_plan:
          normalized.calculationPlan as unknown as Prisma.InputJsonValue,
        diagram_plan:
          normalized.diagramPlan as unknown as Prisma.InputJsonValue,
        checkpoint_focus:
          normalized.checkpointFocus as unknown as Prisma.InputJsonValue,
        exam_focus: normalized.examFocus as unknown as Prisma.InputJsonValue,
        fallback_plan:
          normalized.fallbackPlan as unknown as Prisma.InputJsonValue,
      },
      update: {
        section_title: args.section.title,
        lesson_objective:
          normalized.lessonObjective || fallback.lessonObjective,
        prerequisite_refresh:
          normalized.prerequisiteRefresh as unknown as Prisma.InputJsonValue,
        teaching_sequence:
          normalized.teachingSequence as unknown as Prisma.InputJsonValue,
        analogy_plan:
          normalized.analogyPlan as unknown as Prisma.InputJsonValue,
        calculation_plan:
          normalized.calculationPlan as unknown as Prisma.InputJsonValue,
        diagram_plan:
          normalized.diagramPlan as unknown as Prisma.InputJsonValue,
        checkpoint_focus:
          normalized.checkpointFocus as unknown as Prisma.InputJsonValue,
        exam_focus: normalized.examFocus as unknown as Prisma.InputJsonValue,
        fallback_plan:
          normalized.fallbackPlan as unknown as Prisma.InputJsonValue,
      },
    });

    console.log('lesson_plan_generation_completed', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
    });
    console.log('lesson_plan_context_applied', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
      source: 'generated',
    });
    return normalized.lessonObjective ? normalized : fallback;
  } catch (error) {
    console.error('lesson_plan_generation_failed', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
      message:
        error instanceof Error ? error.message : 'Unknown lesson plan error',
    });

    await studySectionLessonPlan.upsert({
      where: { id: `missing-${args.sessionId}-${args.sectionIndex}` },
      create: {
        session_id: args.sessionId,
        companion_state_id: args.companionStateId,
        user_id: args.userId,
        material_id: args.materialId,
        course_code: args.courseCode,
        section_index: args.sectionIndex,
        section_title: args.section.title,
        lesson_objective: fallback.lessonObjective,
        prerequisite_refresh:
          fallback.prerequisiteRefresh as unknown as Prisma.InputJsonValue,
        teaching_sequence:
          fallback.teachingSequence as unknown as Prisma.InputJsonValue,
        analogy_plan: fallback.analogyPlan as unknown as Prisma.InputJsonValue,
        calculation_plan:
          fallback.calculationPlan as unknown as Prisma.InputJsonValue,
        diagram_plan: fallback.diagramPlan as unknown as Prisma.InputJsonValue,
        checkpoint_focus:
          fallback.checkpointFocus as unknown as Prisma.InputJsonValue,
        exam_focus: fallback.examFocus as unknown as Prisma.InputJsonValue,
        fallback_plan:
          fallback.fallbackPlan as unknown as Prisma.InputJsonValue,
      },
      update: {
        section_title: args.section.title,
        lesson_objective: fallback.lessonObjective,
        prerequisite_refresh:
          fallback.prerequisiteRefresh as unknown as Prisma.InputJsonValue,
        teaching_sequence:
          fallback.teachingSequence as unknown as Prisma.InputJsonValue,
        analogy_plan: fallback.analogyPlan as unknown as Prisma.InputJsonValue,
        calculation_plan:
          fallback.calculationPlan as unknown as Prisma.InputJsonValue,
        diagram_plan: fallback.diagramPlan as unknown as Prisma.InputJsonValue,
        checkpoint_focus:
          fallback.checkpointFocus as unknown as Prisma.InputJsonValue,
        exam_focus: fallback.examFocus as unknown as Prisma.InputJsonValue,
        fallback_plan:
          fallback.fallbackPlan as unknown as Prisma.InputJsonValue,
      },
    });

    console.log('lesson_plan_context_applied', {
      sessionId: args.sessionId,
      materialId: args.materialId,
      sectionIndex: args.sectionIndex,
      source: 'fallback',
    });
    return fallback;
  }
}

export async function buildRelevantMaterialContext(
  materialId: string,
  section: RoadmapSection,
  teacherBrainContext: string,
  lessonPlan: StudySectionLessonPlanRecord,
  teacherBrainSectionContext?: TeacherBrainSectionContext,
  contextMeta?: { sessionId: string; sectionIndex: number },
): Promise<RelevantMaterialContext> {
  const materialEmbedding = (
    prisma as typeof prisma & {
      materialEmbedding: {
        findMany: (query: unknown) => Promise<MaterialEmbeddingRow[]>;
      };
    }
  ).materialEmbedding;

  const queryParts = [
    section.title,
    lessonPlan.lessonObjective,
    ...lessonPlan.prerequisiteRefresh,
    ...lessonPlan.calculationPlan,
    ...lessonPlan.examFocus,
    ...lessonPlan.checkpointFocus,
    ...(teacherBrainSectionContext?.formulas || []).map((item) =>
      `${item.name || 'Formula'} ${item.formula_latex || ''} ${item.when_to_use || ''}`.trim(),
    ),
    ...(teacherBrainSectionContext?.calculationMethods || []).map((item) =>
      `${item.topic || 'Method'} ${(item.method_steps || []).join(' ')}`.trim(),
    ),
    ...(teacherBrainSectionContext?.misconceptions || []).map((item) =>
      `${item.misconception || ''} ${item.correction || ''}`.trim(),
    ),
    teacherBrainContext,
  ].filter(Boolean);

  const embeddings = await materialEmbedding.findMany({
    where: { material_id: materialId },
    select: {
      chunk_index: true,
      chunk_text: true,
      embedding: true,
    },
    take: 120,
    orderBy: {
      chunk_index: 'asc',
    },
  });

  if (!embeddings.length) {
    console.log('relevant_material_context_missing', {
      materialId,
      sectionIndex: contextMeta?.sectionIndex,
      reason: 'no_embeddings',
    });
    return { chunks: [], promptContext: '' };
  }

  const queryText = truncate(queryParts.join('\n'), 4000);
  let queryVector: number[] = [];
  try {
    queryVector = await aiProvider.generateEmbedding(queryText);
  } catch (error) {
    console.error('relevant_material_context_missing', {
      materialId,
      sectionIndex: contextMeta?.sectionIndex,
      reason: error instanceof Error ? error.message : 'query_embedding_failed',
    });
  }

  const scoredChunks = embeddings
    .map((chunk) => {
      const chunkVector = parseEmbeddingVector(chunk.embedding);
      const cosineScore =
        queryVector.length && chunkVector.length
          ? cosineSimilarity(queryVector, chunkVector)
          : 0;
      const lexicalScore = tokenOverlapScore(queryText, chunk.chunk_text);
      const duplicatePenalty = tokenOverlapScore(
        section.content,
        chunk.chunk_text,
      );
      const score =
        cosineScore > 0
          ? cosineScore * 0.75 + lexicalScore * 0.25
          : lexicalScore;
      return {
        chunkIndex: chunk.chunk_index,
        excerpt: truncate(normalizeText(chunk.chunk_text), 220),
        whyRelevant: explainChunkRelevance(chunk.chunk_text, queryParts),
        score,
        duplicatePenalty,
      };
    })
    .filter((chunk) => chunk.duplicatePenalty < 0.72)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .filter((chunk) => chunk.score > 0.05);

  if (!scoredChunks.length) {
    console.log('relevant_material_context_missing', {
      materialId,
      sectionIndex: contextMeta?.sectionIndex,
      reason: 'no_relevant_chunks',
    });
    return { chunks: [], promptContext: '' };
  }

  const selected = scoredChunks.slice(0, 4);
  const promptContext = selected
    .map(
      (chunk) =>
        `Chunk ${chunk.chunkIndex}: ${chunk.excerpt}\nWhy relevant: ${chunk.whyRelevant}`,
    )
    .join('\n\n');

  console.log('relevant_material_context_loaded', {
    materialId,
    sectionIndex: contextMeta?.sectionIndex,
    chunkCount: selected.length,
  });

  return {
    chunks: selected,
    promptContext,
  };
}
