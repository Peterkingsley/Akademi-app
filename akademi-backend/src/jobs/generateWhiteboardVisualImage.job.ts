import crypto from 'crypto';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';
import { uploadFile } from '../shared/storage/r2.service';

function extensionForMime(mimeType: string) {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
}

function buildPrompt(cue: {
  visual_type: string;
  render_mode: string;
  payload: unknown;
  segment: {
    concept_title: string;
    script: string;
    session: {
      course_code: string | null;
      department: string;
      material: {
        title: string;
      } | null;
    };
  };
}) {
  return [
    'Create one polished educational whiteboard image for a mobile AI tutor.',
    'The image must be visual, not a paragraph. Use clear labels, simple shapes, and a clean dark-friendly board style.',
    'Do not include watermarks, logos, tiny text, UI controls, or photorealistic people.',
    'Avoid copying the narration as text. Turn the concept into a diagram, concept map, chart, labelled illustration, or process visual.',
    `Material: ${cue.segment.session.material?.title || 'Tutor material'}`,
    `Course: ${cue.segment.session.course_code || 'General'}`,
    `Department: ${cue.segment.session.department || 'General'}`,
    `Concept: ${cue.segment.concept_title}`,
    `Visual type: ${cue.visual_type}`,
    `Render mode: ${cue.render_mode}`,
    `Visual structure: ${JSON.stringify(cue.payload || {})}`,
    `Narration context: ${cue.segment.script.slice(0, 900)}`,
  ].join('\n');
}

export async function generateWhiteboardVisualImageJob(visualCueId: string) {
  const cue = await prisma.visualCue.findUnique({
    where: { id: visualCueId },
    include: {
      segment: {
        include: {
          session: {
            include: {
              material: {
                select: { title: true },
              },
            },
          },
        },
      },
    },
  });

  if (!cue) throw new Error('Whiteboard visual cue not found');
  if (cue.image_url && cue.generation_status === 'READY') return cue;

  const prompt = buildPrompt(cue);

  await prisma.visualCue.update({
    where: { id: visualCueId },
    data: {
      generation_status: 'PROCESSING',
      generation_error: null,
      generation_prompt: prompt,
    },
  });

  try {
    const generated = await aiProvider.generateEducationalImage(prompt);
    const ext = extensionForMime(generated.mimeType);
    const digest = crypto.createHash('sha1').update(`${visualCueId}:${Date.now()}`).digest('hex').slice(0, 12);
    const key = `tutor/whiteboard-visuals/${visualCueId}/${digest}.${ext}`;
    const imageUrl = await uploadFile(key, generated.buffer, generated.mimeType);

    return await prisma.visualCue.update({
      where: { id: visualCueId },
      data: {
        image_url: imageUrl,
        image_key: key,
        generation_status: 'READY',
        generation_error: null,
        generated_at: new Date(),
      },
    });
  } catch (error) {
    await prisma.visualCue.update({
      where: { id: visualCueId },
      data: {
        generation_status: 'FAILED',
        generation_error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
