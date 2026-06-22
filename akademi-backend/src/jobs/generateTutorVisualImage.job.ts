import crypto from 'crypto';
import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';
import { uploadFile } from '../shared/storage/r2.service';

function extensionForMime(mimeType: string) {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
}

function buildPrompt(asset: {
  topic: string;
  concept: string;
  course_code: string | null;
  department: string | null;
  difficulty: string;
  visual_type: string;
  payload: unknown;
}) {
  return [
    'Create a clean educational visual for a mobile learning app.',
    'The visual must help a Nigerian university student understand the concept quickly.',
    'Use a light, readable diagram style with clear labels and no clutter.',
    'Avoid photorealistic people, distracting decoration, watermarks, logos, and tiny text.',
    `Topic: ${asset.topic}`,
    `Concept: ${asset.concept}`,
    `Course: ${asset.course_code || 'General'}`,
    `Department: ${asset.department || 'General'}`,
    `Difficulty: ${asset.difficulty}`,
    `Visual type: ${asset.visual_type}`,
    `Suggested structure: ${JSON.stringify(asset.payload || {})}`,
  ].join('\n');
}

export async function generateTutorVisualImageJob(visualAssetId: string) {
  const asset = await prisma.tutorVisualAsset.findUnique({
    where: { id: visualAssetId },
  });

  if (!asset) {
    throw new Error('Tutor visual asset not found');
  }

  if (asset.image_url && asset.generation_status === 'READY') {
    return asset;
  }

  const prompt = buildPrompt(asset);

  await prisma.tutorVisualAsset.update({
    where: { id: visualAssetId },
    data: {
      generation_status: 'PROCESSING',
      generation_error: null,
      generation_prompt: prompt,
    },
  });

  try {
    const generated = await aiProvider.generateEducationalImage(prompt);
    const ext = extensionForMime(generated.mimeType);
    const digest = crypto.createHash('sha1').update(`${visualAssetId}:${Date.now()}`).digest('hex').slice(0, 12);
    const key = `tutor/visual-assets/${visualAssetId}/${digest}.${ext}`;
    const imageUrl = await uploadFile(key, generated.buffer, generated.mimeType);

    return await prisma.tutorVisualAsset.update({
      where: { id: visualAssetId },
      data: {
        image_url: imageUrl,
        image_key: key,
        generation_status: 'READY',
        generation_error: null,
        generated_at: new Date(),
      },
    });
  } catch (error) {
    await prisma.tutorVisualAsset.update({
      where: { id: visualAssetId },
      data: {
        generation_status: 'FAILED',
        generation_error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
