import { FileType, VerificationStatus } from '@prisma/client';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';
import { buildExplainBackContract } from '../modules/ai/ai.prompts';
import { getOrCreateSystemUser } from '../modules/textbooks/system-user';
import { generateMaterialTeacherBrain, createFallbackTeacherBrain } from '../modules/materials/teacher-brain.service';
import type { ReaderPage, ReaderStructure } from '../modules/materials/reader-structure';

const EMBEDDING_BATCH_SIZE = Math.max(Number(process.env.MATERIAL_EMBEDDING_BATCH_SIZE || 5), 1);

// Same throwing-parser shape as decomposeCurriculum.job.ts — a parse failure on a section is a
// real generation failure, not something to silently paper over with fallback prose.
function parseJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('AI did not return valid JSON');
  }
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.substring(i, i + size));
  }
  return chunks;
}

function buildTextbookSectionPrompt(params: {
  title: string;
  learningOutcome: string;
  prevGist: string | null;
  nextTitle: string | null;
  nextLearningOutcome: string | null;
  terminologyRegistry: Record<string, string>;
}) {
  const registryEntries = Object.entries(params.terminologyRegistry);

  return [
    buildExplainBackContract(),
    '',
    'You are writing ONE section of an Akademi Generated Textbook — a syllabus-aligned study material for a Nigerian university course. Write the section for the topic below, following the Explain-Back Contract above exactly.',
    `Topic: ${params.title}`,
    `Learning outcome: ${params.learningOutcome}`,
    params.prevGist
      ? `Context only — the section immediately before this one ended with: "${params.prevGist}..." Do not re-explain it, just transition naturally from it.`
      : 'Context only — this is the first section of the textbook.',
    params.nextTitle
      ? `Context only — the section immediately after this one will cover: "${params.nextTitle}" (${params.nextLearningOutcome}). Do not cover that material here, just avoid an abrupt ending.`
      : 'Context only — this is the last section of the textbook.',
    registryEntries.length > 0
      ? `These terms/notation are already introduced elsewhere in this textbook — reuse them exactly as written, do not invent alternate names or notation for the same concept:\n${registryEntries.map(([term, def]) => `- ${term}: ${def}`).join('\n')}`
      : 'No terminology has been registered yet — if you introduce a term/notation worth reusing later, report it in new_terms.',
    '',
    '============================================================',
    'NON-NEGOTIABLE — LEGAL REQUIREMENT (DO NOT REMOVE OR SOFTEN)',
    'Never copy any sentence verbatim from the CCMAS curriculum or any',
    'reference curriculum text. Never reproduce the wording of any',
    'specific existing textbook. Use the topic and learning outcome only',
    'as a guide to WHAT to cover — write the explanation completely',
    'fresh, in your own words.',
    '============================================================',
    '',
    'Also decide whether this topic needs a diagram to teach well (e.g. a process, a labeled structure, a graph). If so, write a plain-text description of exactly what image is needed — do not search for or describe an image search yourself, just describe what should be shown.',
    '',
    'Format as JSON: { "content": string, "needs_diagram": boolean, "diagram_description": string|null, "new_terms": { "term": "short definition" } }',
    '"new_terms" should only contain terms/notation you introduced in THIS section that are not already in the registry above — omit it or leave it empty if none.',
  ].join('\n');
}

async function maybePublishMinimalMaterial(outlineId: string) {
  const outstandingLeaf = await prisma.generatedTextbookOutlineNode.findFirst({
    where: { outline_id: outlineId, children: { none: {} }, status: { not: 'GENERATED' } },
    select: { id: true },
  });
  if (outstandingLeaf) return;

  const outline = await prisma.generatedTextbookOutline.findUnique({
    where: { id: outlineId },
    include: { ccmas_document: true },
  });
  if (!outline || outline.material_id) return;

  const leafNodes = await prisma.generatedTextbookOutlineNode.findMany({
    where: { outline_id: outlineId, children: { none: {} } },
    orderBy: { order_index: 'asc' },
    include: { section: true, parent: { select: { title: true } } },
  });

  const publishable = leafNodes.filter((node) => node.section?.content?.trim());
  if (publishable.length === 0) {
    console.error(`[textbook-section] outline ${outlineId} has no generated content to publish; skipping.`);
    return;
  }

  const readerPages: ReaderPage[] = publishable.map((node, index) => ({
    id: node.id,
    chapterTitle: node.parent?.title || node.title,
    pageTitle: node.title,
    content: node.section!.content.trim(),
    pageNumber: index + 1,
    pageCountInChapter: publishable.filter((n) => (n.parent?.title || n.title) === (node.parent?.title || node.title)).length,
    blocks: [],
  }));

  const readerStructure: ReaderStructure = {
    version: 2,
    generated_at: new Date().toISOString(),
    pages: readerPages,
  };

  const flattenedContent = publishable
    .map((node) => `${node.title}\n\n${node.section!.content.trim()}`)
    .join('\n\n');

  const systemUser = await getOrCreateSystemUser();
  const ccmasDoc = outline.ccmas_document;

  const material = await prisma.material.create({
    data: {
      title: `${outline.course_code} — Akademi Textbook`,
      course_code: outline.course_code,
      course_id: null,
      university: 'AKADEMI_NATIONAL',
      faculty: ccmasDoc.faculty,
      department: ccmasDoc.department,
      level: ccmasDoc.level ?? 0,
      file_ref: '',
      file_type: FileType.DOC,
      verification_status: VerificationStatus.VERIFIED,
      processing_status: 'EXTRACTED' as any,
      uploaded_by: systemUser.id,
      contributor_ids: [],
      content: flattenedContent,
      reader_structure: readerStructure as any,
      is_akademi_generated: true,
      generated_outline_id: outline.id,
    },
  });

  await prisma.generatedTextbookOutline.update({
    where: { id: outline.id },
    data: { material_id: material.id, is_current: true },
  });

  const chunks = chunkText(flattenedContent, 2000);
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    await Promise.all(
      batch.map(async (chunk, batchIndex) => {
        const embedding = await aiProvider.generateEmbedding(chunk);
        await prisma.materialEmbedding.create({
          data: {
            material_id: material.id,
            chunk_index: i + batchIndex,
            chunk_text: chunk,
            embedding: embedding as any,
          },
        });
      }),
    );
  }

  try {
    await generateMaterialTeacherBrain(material.id);
  } catch (error) {
    console.error('[textbook-section] teacher_brain_generation_failed', {
      materialId: material.id,
      message: error instanceof Error ? error.message : 'Unknown teacher brain error',
    });
    try {
      await createFallbackTeacherBrain(material.id);
    } catch (fallbackError) {
      console.error('[textbook-section] teacher_brain_fallback_failed', {
        materialId: material.id,
        message: fallbackError instanceof Error ? fallbackError.message : 'Fallback teacher brain creation failed',
      });
    }
  }

  console.log(`[textbook-section] published Material ${material.id} for outline ${outline.id} (${outline.course_code}).`);
}

export async function generateTextbookSectionJob(nodeId: string): Promise<void> {
  const node = await prisma.generatedTextbookOutlineNode.findUnique({ where: { id: nodeId } });
  if (!node) throw new Error(`Outline node ${nodeId} not found`);

  await prisma.generatedTextbookOutlineNode.update({
    where: { id: nodeId },
    data: { status: 'GENERATING' },
  });

  const siblings = await prisma.generatedTextbookOutlineNode.findMany({
    where: { outline_id: node.outline_id, parent_id: node.parent_id },
    orderBy: { order_index: 'asc' },
    include: { section: { select: { content: true } } },
  });
  const selfIndex = siblings.findIndex((sibling) => sibling.id === node.id);
  const prevSibling = selfIndex > 0 ? siblings[selfIndex - 1] : null;
  const nextSibling = selfIndex >= 0 && selfIndex < siblings.length - 1 ? siblings[selfIndex + 1] : null;

  const outline = await prisma.generatedTextbookOutline.findUnique({
    where: { id: node.outline_id },
    select: { terminology_registry: true },
  });
  const terminologyRegistry = (outline?.terminology_registry as Record<string, string>) || {};

  const prompt = buildTextbookSectionPrompt({
    title: node.title,
    learningOutcome: node.learning_outcome,
    prevGist: prevSibling?.section?.content ? prevSibling.section.content.trim().slice(0, 200) : null,
    nextTitle: nextSibling?.title || null,
    nextLearningOutcome: nextSibling?.learning_outcome || null,
    terminologyRegistry,
  });

  let parsed: any;
  try {
    const aiOutput = await aiProvider.generateResponse(prompt, {
      systemPrompt:
        'You are an expert academic writer producing original, student-facing textbook prose. Return ONLY valid JSON, no prose outside the JSON object.',
      maxTokens: 3000,
      extendedTimeouts: true,
    });
    parsed = parseJsonObject(aiOutput);
  } catch (error) {
    // No safe synthetic fallback for a generated section. The enum has no distinct
    // "generation failed" state, so PENDING is the least-surprising fit — Phase B's presence
    // check picks this node back up for retry.
    await prisma.generatedTextbookOutlineNode.update({ where: { id: nodeId }, data: { status: 'PENDING' } });
    throw error;
  }

  const content = String(parsed?.content || '').trim();
  if (!content) {
    await prisma.generatedTextbookOutlineNode.update({ where: { id: nodeId }, data: { status: 'PENDING' } });
    throw new Error(`AI returned no content for node ${nodeId}`);
  }

  const needsDiagram = Boolean(parsed?.needs_diagram);
  const diagramDescription = needsDiagram && parsed?.diagram_description ? String(parsed.diagram_description).trim() : null;
  const newTerms =
    parsed?.new_terms && typeof parsed.new_terms === 'object' && !Array.isArray(parsed.new_terms)
      ? (parsed.new_terms as Record<string, string>)
      : {};

  await prisma.$transaction(async (tx) => {
    await tx.generatedTextbookSection.upsert({
      where: { node_id: nodeId },
      create: { node_id: nodeId, content, needs_diagram: needsDiagram, diagram_description: diagramDescription },
      update: { content, needs_diagram: needsDiagram, diagram_description: diagramDescription },
    });
    await tx.generatedTextbookOutlineNode.update({ where: { id: nodeId }, data: { status: 'GENERATED' } });

    if (Object.keys(newTerms).length > 0) {
      const fresh = await tx.generatedTextbookOutline.findUnique({
        where: { id: node.outline_id },
        select: { terminology_registry: true },
      });
      const merged = { ...((fresh?.terminology_registry as Record<string, string>) || {}), ...newTerms };
      await tx.generatedTextbookOutline.update({ where: { id: node.outline_id }, data: { terminology_registry: merged } });
    }
  });

  await maybePublishMinimalMaterial(node.outline_id);
}
