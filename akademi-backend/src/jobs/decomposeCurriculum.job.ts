import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';
import { systemQueue, JOB_NAMES } from '../config/queue';
import { hasExistingTextbookOutline } from '../modules/textbooks/textbook-trigger';

interface DecompositionNode {
  title: string;
  learning_outcome: string;
  is_international_addition: boolean;
  children: DecompositionNode[];
}

// Throws rather than returning null on total failure (unlike teacher-brain.service.ts's
// tryParseJson): there is no safe synthetic fallback for an invented curriculum outline —
// a parse failure here must surface as a real job failure, not a silently-skipped step.
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

function normalizeNode(raw: any): DecompositionNode | null {
  const title = String(raw?.title || '').trim();
  const learningOutcome = String(raw?.learning_outcome || '').trim();
  if (!title || !learningOutcome) return null;

  const children = Array.isArray(raw?.children)
    ? (raw.children.map(normalizeNode).filter(Boolean) as DecompositionNode[])
    : [];

  return {
    title,
    learning_outcome: learningOutcome,
    is_international_addition: Boolean(raw?.is_international_addition),
    children,
  };
}

function buildDecompositionPrompt(
  ccmasDoc: { document_ref: string; department: string; course_code: string | null },
  internationalDocs: Array<{ document_ref: string; reference_name: string | null }>,
) {
  const lines = [
    'Decompose a course curriculum into a complete, hierarchical textbook outline.',
    `Course code: ${ccmasDoc.course_code}`,
    `Department: ${ccmasDoc.department}`,
    '',
    'CCMAS CURRICULUM (authoritative backbone — this is Nigeria\'s government curriculum for this course):',
    ccmasDoc.document_ref.slice(0, 20000),
  ];

  if (internationalDocs.length > 0) {
    lines.push(
      '',
      'INTERNATIONAL REFERENCE CURRICULA (cross-reference only, for gap-filling — never reorder the CCMAS backbone to match these):',
      ...internationalDocs.map(
        (doc, index) =>
          `Reference ${index + 1} (${doc.reference_name || 'Unnamed reference'}):\n${doc.document_ref.slice(0, 6000)}`,
      ),
    );
  }

  lines.push(
    '',
    'RULES (follow exactly):',
    '- Decompose the CCMAS curriculum into its full hierarchy: chapter -> topic -> subtopic -> learning outcome. Capture every level present in the source — do not flatten the structure.',
    internationalDocs.length > 0
      ? '- Cross-reference the international reference material for the same subject matter. Where a reference covers a topic CCMAS does not, add it as a new node, placed as a sibling interspersed near the CCMAS topic it most closely extends — you decide the placement, do not group international-only topics into a separate section at the end.'
      : '- No international reference material was provided for this course. Do not invent or assume any "international standard" content — build the outline from the CCMAS curriculum alone.',
    '- Where CCMAS and a reference cover the same topic, merge them into ONE node — never produce two nodes for the same topic.',
    '- Preserve the CCMAS curriculum\'s own topic ordering as the backbone sequence. Do not re-sequence topics into a different order, even if you think another order would teach better.',
    '- Every single node (chapter, topic, and subtopic) must have its own learning_outcome: an explicit "after this section, the student should be able to..." statement, not just a restated title.',
    '- Give every topic the same depth and treatment regardless of whether CCMAS marks it Compulsory, Recommended, or Elective.',
    '- Do not target any particular output length or page count. The number of nodes should be exactly however many the curriculum content actually requires — no more, no less.',
    '- Set is_international_addition to true only for nodes that exist because of the international reference material and are not present in CCMAS. This is internal bookkeeping only, never shown to students as a citation.',
    '',
    'Format as JSON: { "nodes": [{ "title": string, "learning_outcome": string, "is_international_addition": boolean, "children": [ ...same shape, recursively... ] }] }',
    'Leaf nodes (subtopics with no further children) should have an empty "children": [] array.',
  );

  return lines.join('\n');
}

export async function decomposeCurriculumJob(courseCode: string): Promise<void> {
  const code = courseCode.trim().toUpperCase();
  if (!code) return;

  const ccmasDoc = await prisma.disciplineDocument.findFirst({
    where: { course_code: code, source_type: 'CCMAS', is_active: true },
    orderBy: { version: 'desc' },
  });

  if (!ccmasDoc) {
    console.log(`[decompose-curriculum] no active CCMAS document for course_code ${code}; skipping.`);
    return;
  }

  // Cheap re-check: two triggers for the same code (e.g. two students enrolling close together,
  // or the backfill script running while a live enrollment already queued the same code) could
  // both pass ensureTextbookGenerationQueued's check before either job actually runs.
  if (await hasExistingTextbookOutline(code)) {
    console.log(`[decompose-curriculum] course_code ${code} already has an outline; skipping.`);
    return;
  }

  const internationalDocs = await prisma.disciplineDocument.findMany({
    where: {
      faculty: ccmasDoc.faculty,
      department: ccmasDoc.department,
      source_type: 'INTERNATIONAL_REFERENCE',
      is_active: true,
    },
  });

  const prompt = buildDecompositionPrompt(ccmasDoc, internationalDocs);

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt:
      'You are a curriculum design expert building a textbook outline for a Nigerian university course. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 6000,
    extendedTimeouts: true,
  });

  const parsed = parseJsonObject(aiOutput);
  const rawNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
  const nodes = rawNodes.map(normalizeNode).filter(Boolean) as DecompositionNode[];

  if (nodes.length === 0) {
    throw new Error(`Curriculum decomposition for ${code} returned no usable nodes`);
  }

  const outlineId = await prisma.$transaction(async (tx) => {
    const outline = await tx.generatedTextbookOutline.create({
      data: {
        course_code: code,
        ccmas_version: ccmasDoc.version,
        ccmas_document_id: ccmasDoc.id,
        terminology_registry: {},
        is_current: false,
      },
    });

    let orderCounter = 0;
    const createNodeTree = async (node: DecompositionNode, parentId: string | null, depth: number) => {
      const created = await tx.generatedTextbookOutlineNode.create({
        data: {
          outline_id: outline.id,
          parent_id: parentId,
          order_index: orderCounter++,
          depth,
          title: node.title,
          learning_outcome: node.learning_outcome,
          is_international_addition: node.is_international_addition,
          status: 'PENDING',
        },
      });

      for (const child of node.children) {
        await createNodeTree(child, created.id, depth + 1);
      }
    };

    for (const node of nodes) {
      await createNodeTree(node, null, 0);
    }

    return outline.id;
  });

  const leafNodes = await prisma.generatedTextbookOutlineNode.findMany({
    where: { outline_id: outlineId, children: { none: {} } },
    orderBy: { order_index: 'asc' },
    select: { id: true },
  });

  console.log(`[decompose-curriculum] outline ${outlineId} for ${code}: ${leafNodes.length} leaf sections to generate.`);

  for (const leaf of leafNodes) {
    systemQueue.add(JOB_NAMES.GENERATE_TEXTBOOK_SECTION, { nodeId: leaf.id }).catch((error: unknown) => {
      console.error('[decompose-curriculum] failed to enqueue section generation', { nodeId: leaf.id, error });
    });
  }
}
