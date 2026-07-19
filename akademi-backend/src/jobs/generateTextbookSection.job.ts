import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';
import { buildExplainBackContract } from '../modules/ai/ai.prompts';
import { systemQueue, JOB_NAMES } from '../config/queue';

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

function buildTextbookSectionPrompt(params: {
  title: string;
  learningOutcome: string;
  prevGist: string | null;
  nextTitle: string | null;
  nextLearningOutcome: string | null;
  terminologyRegistry: Record<string, string>;
  priorFailureNotes: string | null;
  internationalReferences: Array<{ reference_name: string | null; excerpt: string }>;
}) {
  const registryEntries = Object.entries(params.terminologyRegistry);

  return [
    buildExplainBackContract(),
    '',
    'You are writing ONE section of an Akademi Generated Textbook — a syllabus-aligned study material for a Nigerian university course. Write the section for the topic below, following the Explain-Back Contract above exactly.',
    `Topic: ${params.title}`,
    `Learning outcome: ${params.learningOutcome}`,
    params.priorFailureNotes
      ? `IMPORTANT — this is a REWRITE. A previous version of this section was reviewed and rejected for this specific reason: "${params.priorFailureNotes}" Your new version must directly fix that problem, not just reword the same content.`
      : '',
    params.prevGist
      ? `Context only — the section immediately before this one ended with: "${params.prevGist}..." Do not re-explain it, just transition naturally from it.`
      : 'Context only — this is the first section of the textbook.',
    params.nextTitle
      ? `Context only — the section immediately after this one will cover: "${params.nextTitle}" (${params.nextLearningOutcome}). Do not cover that material here, just avoid an abrupt ending.`
      : 'Context only — this is the last section of the textbook.',
    registryEntries.length > 0
      ? `These terms/notation are already introduced elsewhere in this textbook — reuse them exactly as written, do not invent alternate names or notation for the same concept:\n${registryEntries.map(([term, def]) => `- ${term}: ${def}`).join('\n')}`
      : 'No terminology has been registered yet — if you introduce a term/notation worth reusing later, report it in new_terms.',
    params.internationalReferences.length > 0
      ? [
          '',
          'INTERNATIONAL-STANDARD DEPTH:',
          'Write this section with the depth, rigor, and thoroughness a well-regarded international reference on this subject would have — not just the minimum the topic and learning outcome imply. The excerpt(s) below indicate what that standard concretely looks like for this discipline: use them ONLY to calibrate how deep, rigorous, and thorough your OWN original explanation should be — never as a source to copy or paraphrase from.',
          ...params.internationalReferences.map(
            (ref, index) => `Depth reference ${index + 1} (${ref.reference_name || 'unnamed'}): ${ref.excerpt}`,
          ),
        ].join('\n')
      : '',
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
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export async function generateTextbookSectionJob(nodeId: string): Promise<void> {
  const node = await prisma.generatedTextbookOutlineNode.findUnique({
    where: { id: nodeId },
    include: { section: { select: { quality_check_passed: true, quality_check_notes: true } } },
  });
  if (!node) throw new Error(`Outline node ${nodeId} not found`);

  // If this run follows a failed quality check (auditTextbookOutlineJob sets quality_check_notes
  // before re-enqueueing this job), feed that feedback into the rewrite so the retry actually
  // addresses the specific problem instead of blindly rerolling.
  const priorFailureNotes =
    node.section && node.section.quality_check_passed === false ? node.section.quality_check_notes : null;

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
    select: { terminology_registry: true, ccmas_document: { select: { faculty: true, department: true } } },
  });
  const terminologyRegistry = (outline?.terminology_registry as Record<string, string>) || {};

  // Same discipline-scoped INTERNATIONAL_REFERENCE lookup decomposeCurriculum.job.ts uses to pick
  // extra outline topics — reused here so the actual prose draws on the same named standard, not
  // just the outline shape. A short excerpt per reference is enough to calibrate depth; this runs
  // once per leaf node (unlike decomposition's once-per-outline call), so keep it lean.
  const internationalDocs = outline?.ccmas_document
    ? await prisma.disciplineDocument.findMany({
        where: {
          faculty: outline.ccmas_document.faculty,
          department: outline.ccmas_document.department,
          source_type: 'INTERNATIONAL_REFERENCE',
          is_active: true,
        },
        select: { reference_name: true, document_ref: true },
      })
    : [];
  const internationalReferences = internationalDocs.map((doc) => ({
    reference_name: doc.reference_name,
    excerpt: doc.document_ref.slice(0, 1500),
  }));

  const prompt = buildTextbookSectionPrompt({
    title: node.title,
    learningOutcome: node.learning_outcome,
    prevGist: prevSibling?.section?.content ? prevSibling.section.content.trim().slice(0, 200) : null,
    nextTitle: nextSibling?.title || null,
    nextLearningOutcome: nextSibling?.learning_outcome || null,
    terminologyRegistry,
    priorFailureNotes,
    internationalReferences,
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
    // "generation failed" state, so PENDING is the least-surprising fit — the audit job's
    // presence handling picks this node back up.
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

  const section = await prisma.$transaction(async (tx) => {
    const savedSection = await tx.generatedTextbookSection.upsert({
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

    return savedSection;
  });

  // Diagram sourcing is best-effort and never blocks anything — fire-and-forget.
  if (needsDiagram) {
    systemQueue.add(JOB_NAMES.FETCH_TEXTBOOK_DIAGRAM, { sectionId: section.id }).catch((error: unknown) => {
      console.error('[textbook-section] failed to enqueue diagram fetch', { sectionId: section.id, error });
    });
  }

  // Once every leaf node in this outline has reached a terminal state (GENERATED — including
  // ones already ADMIN_QUEUED from an earlier audit round, which never come back through this
  // job), hand off to the quality-check audit. Checking for "not GENERATED" alone would miss
  // this: after this outline's LAST retriable node finally regenerates, any sibling already
  // sitting in ADMIN_QUEUED would still read as "not GENERATED" and wrongly block the re-trigger
  // forever, since ADMIN_QUEUED nodes never route back through this job to flip that check.
  const outstandingLeaf = await prisma.generatedTextbookOutlineNode.findFirst({
    where: {
      outline_id: node.outline_id,
      children: { none: {} },
      status: { notIn: ['GENERATED', 'ADMIN_QUEUED'] },
    },
    select: { id: true },
  });
  if (!outstandingLeaf) {
    systemQueue.add(JOB_NAMES.AUDIT_TEXTBOOK_OUTLINE, { outlineId: node.outline_id }).catch((error: unknown) => {
      console.error('[textbook-section] failed to enqueue outline audit', { outlineId: node.outline_id, error });
    });
  }
}
