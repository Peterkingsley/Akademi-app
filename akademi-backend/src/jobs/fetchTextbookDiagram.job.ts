import prisma from '../config/db';
import { aiProvider, TransientCapacityError } from '../modules/ai/ai.provider';
import { searchImages, ImageCandidate } from '../shared/search/google-image-search.client';

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

// Deliberately compares multiple candidates rather than taking the top search result — the AI
// call ranks them against the diagram description using search metadata (title/snippet/source/
// dimensions), since aiProvider is text-only and can't inspect the actual pixels. Returns null
// (never throws) if evaluation fails or no candidate is genuinely relevant — a wrong diagram is
// worse than no diagram, and this is best-effort by design (see fetchTextbookDiagramJob below).
async function pickBestCandidate(
  context: { title: string; learningOutcome: string; diagramDescription: string },
  candidates: ImageCandidate[],
): Promise<ImageCandidate | null> {
  const prompt = [
    'Pick the single best image candidate for a textbook diagram. You cannot see the images themselves — judge only from the metadata below.',
    `Diagram needed: ${context.diagramDescription}`,
    `Topic: ${context.title}`,
    `Learning outcome: ${context.learningOutcome}`,
    '',
    'Candidates:',
    ...candidates.map((candidate, index) => {
      const dimensions = candidate.width && candidate.height ? ` | size: ${candidate.width}x${candidate.height}` : '';
      return `${index}. title: "${candidate.title}" | snippet: "${candidate.snippet}" | source: ${candidate.contextLink || candidate.url}${dimensions}`;
    }),
    '',
    'Format as JSON: { "chosen_index": number|null, "reason": string }',
    'Set chosen_index to null if none of the candidates are genuinely relevant and accurate for this diagram — do not force a pick just to fill the slot.',
  ].join('\n');

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt:
      'You are selecting the most accurate, relevant educational diagram from search result metadata. Return ONLY valid JSON, no prose outside the JSON object.',
    maxTokens: 500,
  });

  const parsed = parseJsonObject(aiOutput);
  const index = Number(parsed?.chosen_index);
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) return null;
  return candidates[index];
}

// Best-effort and non-blocking by design: never throws. Any failure (search, evaluation,
// nothing suitable) is logged and leaves diagram_image_url null — a missing diagram must never
// block a section or the book it belongs to from publishing.
export async function fetchTextbookDiagramJob(sectionId: string): Promise<void> {
  try {
    const section = await prisma.generatedTextbookSection.findUnique({
      where: { id: sectionId },
      include: { node: { select: { title: true, learning_outcome: true } } },
    });

    if (!section) {
      console.warn(`[fetch-textbook-diagram] section ${sectionId} not found; skipping.`);
      return;
    }
    if (!section.needs_diagram || !section.diagram_description?.trim()) {
      return;
    }
    if (section.diagram_image_url) {
      return; // already resolved (e.g. re-enqueued after a section regeneration)
    }

    let candidates: ImageCandidate[] = [];
    try {
      candidates = await searchImages(section.diagram_description);
    } catch (error) {
      console.error('[fetch-textbook-diagram] image search failed', { sectionId, error });
      return;
    }

    if (candidates.length === 0) {
      console.log(`[fetch-textbook-diagram] no image candidates found for section ${sectionId}`);
      return;
    }

    let chosen: ImageCandidate | null = null;
    try {
      chosen = await pickBestCandidate(
        {
          title: section.node.title,
          learningOutcome: section.node.learning_outcome,
          diagramDescription: section.diagram_description,
        },
        candidates,
      );
    } catch (error) {
      if (error instanceof TransientCapacityError) {
        await prisma.generatedTextbookOutlineNode.update({ where: { id: section.node_id }, data: { status: 'AWAITING_CAPACITY' } });
        return;
      }
      console.error('[fetch-textbook-diagram] candidate evaluation failed', { sectionId, error });
      return;
    }

    if (!chosen) {
      console.log(`[fetch-textbook-diagram] no candidate was judged relevant/accurate for section ${sectionId}`);
      return;
    }

    await prisma.generatedTextbookSection.update({
      where: { id: sectionId },
      data: { diagram_image_url: chosen.url },
    });

    console.log(`[fetch-textbook-diagram] set diagram for section ${sectionId}: ${chosen.url}`);
  } catch (error) {
    // Belt-and-suspenders: nothing in this job should ever propagate a throw.
    console.error('[fetch-textbook-diagram] unexpected failure', { sectionId, error });
  }
}
