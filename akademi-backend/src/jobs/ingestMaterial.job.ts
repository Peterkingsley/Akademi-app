import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../config/db';
import { config } from '../config/env';
import { FileType } from '@prisma/client';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import vision from '@google-cloud/vision';
import { checkVerificationThresholdJob } from './checkVerificationThreshold.job';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

const visionClient = new vision.ImageAnnotatorClient();

export async function ingestMaterialJob(materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });

  if (!material) throw new Error('Material not found');

  const command = new GetObjectCommand({
    Bucket: config.r2BucketName,
    Key: material.file_ref,
  });

  const response = await s3Client.send(command);
  const body = await response.Body?.transformToByteArray();
  if (!body) throw new Error('Failed to download material file');
  const buffer = Buffer.from(body);

  let extractedText = '';

  if (material.file_type === FileType.PDF) {
    const data = await (pdf as any)(buffer);
    extractedText = data.text;
  } else if (material.file_type === FileType.DOC) {
    const result = await mammoth.extractRawText({ buffer });
    extractedText = result.value;
  } else if (material.file_type === FileType.IMAGE) {
    const [result] = await visionClient.textDetection(buffer);
    const detections = result.textAnnotations;
    extractedText =
      detections && detections.length > 0
        ? detections[0].description || ''
        : '';
  }

  if (!extractedText) {
    throw new Error('No text extracted from material');
  }

  // Chunk text (~500 tokens, roughly 2000 characters for estimation)
  const chunks = chunkText(extractedText, 2000);

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];

    // Generate embedding (Mocking with Anthropic or OpenAI logic if available)
    const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());

    await prisma.materialEmbedding.create({
      data: {
        material_id: materialId,
        chunk_index: i,
        chunk_text: chunkText,
        embedding: mockEmbedding as any,
      },
    });
  }

  console.log(
    `Material ${materialId} ingested successfully. Triggering checkVerificationThresholdJob.`,
  );
  await checkVerificationThresholdJob(materialId);
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.substring(i, i + size));
  }
  return chunks;
}
