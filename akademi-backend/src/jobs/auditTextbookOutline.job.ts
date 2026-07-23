import { FileType, VerificationStatus } from '@prisma/client';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';
import { systemQueue, JOB_NAMES } from '../config/queue';
import { getOrCreateSystemUser } from '../modules/textbooks/system-user';
import { generateMaterialTeacherBrain, createFallbackTeacherBrain } from '../modules/materials/teacher-brain.service';
import type { ReaderPage, ReaderStructure } from '../modules/materials/reader-structure';

export const MAX_QUALITY_RETRY_ATTEMPTS = 3;

const EMBEDDING_BATCH_SIZE = Math.max(Number(process.env.MATERIAL_EMBEDDING_BATCH_SIZE || 5), 1);

// Same throwing-parser shape used across the textbook pipeline.
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

// Genuinely assesses whether the content teaches its learning outcome — not a presence check.
async function assessSectionQuality(
  node: { title: string; learning_outcome: string },
  content: string,
): Promise<{ passed: boolean; notes: string }> {
  const prompt = [
    'Assess whether the following textbook section genuinely fulfills its stated learning outcome — not "does content exist," but "does this content actually teach what it claims to teach."',
    `Topic: ${node.title}`,
    `Learning outcome: ${node.learning_outcome}`,
    '',
    'Section content:',
    content,
    '',
    'Format as JSON: { "passed": boolean, "notes": string }',
    'If passed is false, notes must specifically describe what is missing or wrong, in enough detail that a rewrite can directly address it — never a vague "needs improvement."',
  ].join('\n');

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt:
      'You are a strict academic reviewer verifying that textbook content actually teaches its stated learning outcome. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 600,
  });

  const parsed = parseJsonObject(aiOutput);
  return {
    passed: Boolean(parsed?.passed),
    notes: String(parsed?.notes || '').trim(),
  };
}

async function publishGeneratedTextbook(outlineId: string) {
  const outline = await prisma.generatedTextbookOutline.findUnique({
    where: { id: outlineId },
    include: { ccmas_document: true },
  });
  if (!outline || outline.material_id) return; // already published, or outline vanished

  const leafNodes = await prisma.generatedTextbookOutlineNode.findMany({
    where: { outline_id: outlineId, children: { none: {} } },
    orderBy: { order_index: 'asc' },
    include: { section: true, parent: { select: { title: true } } },
  });

  // Every leaf here has already been resolved by auditTextbookOutlineJob (quality-check passed,
  // or retries exhausted into ADMIN_QUEUED) before this function is ever called — admin-queued
  // sections still publish with whatever content they have, per spec: fixed reactively through
  // admin review, not blocked pre-publish.
  const publishable = leafNodes.filter((node) => node.section?.content?.trim());
  if (publishable.length === 0) {
    console.error(`[audit-textbook-outline] outline ${outlineId} has no generated content to publish; skipping.`);
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

  let targetUniversity = 'AKADEMI_NATIONAL';
  if (outline.scope_type === 'SCHOOL_SPECIFIC' && outline.university_id) {
    const uni = await prisma.university.findUnique({ where: { id: outline.university_id } });
    if (uni) {
      targetUniversity = uni.name.trim();
    }
  }

  const material = await prisma.material.create({
    data: {
      title: `${outline.course_code} — Akademi Textbook`,
      course_code: outline.course_code,
      course_id: null,
      university: targetUniversity,
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

  await prisma.generatedTextbookOutline.updateMany({
    where: {
      course_code: outline.course_code,
      university_id: outline.university_id,
      id: { not: outline.id },
    },
    data: { is_current: false },
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
    console.error('[audit-textbook-outline] teacher_brain_generation_failed', {
      materialId: material.id,
      message: error instanceof Error ? error.message : 'Unknown teacher brain error',
    });
    try {
      await createFallbackTeacherBrain(material.id);
    } catch (fallbackError) {
      console.error('[audit-textbook-outline] teacher_brain_fallback_failed', {
        materialId: material.id,
        message: fallbackError instanceof Error ? fallbackError.message : 'Fallback teacher brain creation failed',
      });
    }
  }

  console.log(`[audit-textbook-outline] published Material ${material.id} for outline ${outline.id} (${outline.course_code}).`);
}

export async function auditTextbookOutlineJob(outlineId: string): Promise<void> {
  const leafNodes = await prisma.generatedTextbookOutlineNode.findMany({
    where: { outline_id: outlineId, children: { none: {} } },
    orderBy: { order_index: 'asc' },
    include: { section: true },
  });

  let anyRegenerationTriggered = false;

  for (const node of leafNodes) {
    // Already resolved in an earlier audit pass — never re-processed.
    if (node.status === 'ADMIN_QUEUED') continue;

    if (!node.section) {
      // Defensive: shouldn't happen (section + GENERATED status are written transactionally
      // together in generateTextbookSectionJob), but treat it as a failed check rather than crash.
      anyRegenerationTriggered = (await handleFailedCheck(node, 'No section content was found for this node.')) || anyRegenerationTriggered;
      continue;
    }

    if (node.section.quality_check_passed) continue; // already audited and passed in an earlier round

    let verdict: { passed: boolean; notes: string };
    try {
      verdict = await assessSectionQuality(node, node.section.content);
    } catch (error) {
      console.error('[audit-textbook-outline] quality assessment failed', { nodeId: node.id, error });
      anyRegenerationTriggered = (await handleFailedCheck(node, 'The automated quality check itself failed to run — retrying generation.')) || anyRegenerationTriggered;
      continue;
    }

    if (verdict.passed) {
      await prisma.generatedTextbookSection.update({
        where: { node_id: node.id },
        data: { quality_check_passed: true, quality_check_notes: verdict.notes || null },
      });
      continue;
    }

    anyRegenerationTriggered = (await handleFailedCheck(node, verdict.notes || 'Did not fulfill the learning outcome.')) || anyRegenerationTriggered;
  }

  if (anyRegenerationTriggered) {
    // Some sections are being regenerated; generateTextbookSectionJob re-enqueues this same
    // audit once every leaf is GENERATED again, so publish will be reconsidered then.
    return;
  }

  await publishGeneratedTextbook(outlineId);
}

// Records the failure, then either queues a regeneration (with the failure notes attached so the
// retry actually addresses the problem) or, once retries are exhausted, marks the node
// ADMIN_QUEUED and leaves its existing content in place. Returns true if a regeneration was
// triggered (i.e. the outline is not yet ready to publish).
async function handleFailedCheck(
  node: { id: string; retry_count: number },
  notes: string,
): Promise<boolean> {
  await prisma.generatedTextbookSection.update({
    where: { node_id: node.id },
    data: { quality_check_passed: false, quality_check_notes: notes },
  });

  const nextRetryCount = node.retry_count + 1;

  if (nextRetryCount >= MAX_QUALITY_RETRY_ATTEMPTS) {
    await prisma.generatedTextbookOutlineNode.update({
      where: { id: node.id },
      data: { retry_count: nextRetryCount, status: 'ADMIN_QUEUED' },
    });
    console.warn(`[audit-textbook-outline] node ${node.id} exhausted quality retries (${nextRetryCount}); queued for admin review.`);
    return false;
  }

  await prisma.generatedTextbookOutlineNode.update({
    where: { id: node.id },
    data: { retry_count: nextRetryCount, status: 'PENDING' },
  });

  systemQueue.add(JOB_NAMES.GENERATE_TEXTBOOK_SECTION, { nodeId: node.id }).catch((error: unknown) => {
    console.error('[audit-textbook-outline] failed to re-enqueue section regeneration', { nodeId: node.id, error });
  });

  return true;
}
