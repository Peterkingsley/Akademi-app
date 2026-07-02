import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../config/db';
import { config } from '../config/env';
import { FileType } from '@prisma/client';
import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as vision from '@google-cloud/vision';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkVerificationThresholdJob } from './checkVerificationThreshold.job';
import { buildReaderStructure, buildReaderStructureFromHtml, normalizeExtractedText } from '../modules/materials/reader-structure';
import { computeMaterialRetryAt } from '../modules/materials/material-processing';
import { createFallbackTeacherBrain, generateMaterialTeacherBrain } from '../modules/materials/teacher-brain.service';
import { aiProvider } from '../modules/ai/ai.provider';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

let visionClient: vision.ImageAnnotatorClient | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

const getVisionClient = () => {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient(
      config.googleVisionApiKey ? { apiKey: config.googleVisionApiKey } : {},
    );
  }
  return visionClient;
};

const PLACEHOLDER_KEYWORDS = ['your_', 'replace_me', 'api_key', 'dummy'];

function hasUsableGeminiKey() {
  const key = config.geminiApiKey;
  return !!key && !PLACEHOLDER_KEYWORDS.some(keyword => key.toLowerCase().includes(keyword));
}

function getGeminiClient() {
  if (!hasUsableGeminiKey()) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(config.geminiApiKey);
  }
  return geminiClient;
}

async function extractPdfText(buffer: Buffer, geminiClient: GoogleGenerativeAI | null) {
  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent([
        {
          text: `Extract all text from this PDF document.
Important rules:
- Preserve ALL mathematical formulas exactly, writing them in LaTeX notation wrapped in \\( \\) for inline math or \\[ \\] for display math
- For example: if you see F = ma, write it as \\(F = ma\\)
- If you see a fraction, use LaTeX: \\(\\frac{numerator}{denominator}\\)
- If you see superscripts like v², write \\(v^2\\)
- If you see subscripts like a₁, write \\(a_1\\)
- Preserve all headings, paragraphs, bullet points, and tables
- Output plain text with LaTeX math notation only - no markdown, no HTML`,
        },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: buffer.toString('base64'),
          },
        },
      ]);

      const extracted = result.response.text().trim();
      if (extracted.length > 100) {
        return extracted;
      }
    } catch (error) {
      console.error('Gemini PDF extraction failed, falling back to pdf-parse:', error);
    }
  }

  const parserModule = pdfParse as any;
  const parse = parserModule.default || parserModule;

  if (typeof parse === 'function') {
    const data = await parse(buffer);
    return data.text || '';
  }

  if (typeof parserModule.PDFParse === 'function') {
    const parser = new parserModule.PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy?.();
    return data.text || '';
  }

  throw new Error('PDF parser is not available');
}

async function describeEmbeddedImage(buffer: Buffer, mimeType: string) {
  const client = getGeminiClient();

  if (client) {
    try {
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent([
        {
          text: 'Describe this image briefly for a student reading a study material. Focus on what the image shows, such as a diagram, chart, table, or labeled object. Keep it to 2 sentences maximum.',
        },
        {
          inlineData: {
            mimeType,
            data: buffer.toString('base64'),
          },
        },
      ]);
      return result.response.text().trim();
    } catch (error) {
      console.error('Gemini image description failed, falling back:', error);
    }
  }

  try {
    const [result] = await getVisionClient().textDetection(buffer);
    const text = result.textAnnotations?.[0]?.description?.trim();
    if (text) {
      return `Image contains visible text: ${text.slice(0, 220)}`;
    }
  } catch (error) {
    console.error('Vision image description fallback failed:', error);
  }

  return '';
}

function guessImageMimeType(fileRef: string) {
  const lower = String(fileRef || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

const EMBEDDING_BATCH_SIZE = Math.max(Number(process.env.MATERIAL_EMBEDDING_BATCH_SIZE || 5), 1);

export async function ingestMaterialJob(materialId: string) {
  type ProcessingMaterialRecord = {
    id: string;
    file_ref: string;
    file_type: FileType;
    processing_status: 'UPLOADED' | 'QUEUED' | 'EXTRACTING' | 'EXTRACTED' | 'FAILED';
    processing_attempts: number;
  };

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      file_ref: true,
      file_type: true,
      processing_status: true as any,
      processing_attempts: true as any,
    } as any,
  }) as ProcessingMaterialRecord | null;

  if (!material) throw new Error('Material not found');
  if ((material as any).processing_status === 'EXTRACTED') return;

  const claim = await prisma.material.updateMany({
    where: {
      id: materialId,
      processing_status: {
        in: ['UPLOADED', 'QUEUED', 'FAILED'],
      } as any,
    } as any,
    data: {
      processing_status: 'EXTRACTING',
      processing_started_at: new Date(),
      processing_error: null,
      next_retry_at: null,
      processing_attempts: {
        increment: 1,
      },
    } as any,
  });

  if (claim.count === 0) return;

  const claimedMaterial = await prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      file_ref: true,
      file_type: true,
      processing_attempts: true as any,
    } as any,
  }) as Pick<ProcessingMaterialRecord, 'id' | 'file_ref' | 'file_type' | 'processing_attempts'> | null;

  if (!claimedMaterial) throw new Error('Material not found');

  try {
    const command = new GetObjectCommand({
      Bucket: config.r2BucketName,
      Key: claimedMaterial.file_ref,
    });

    const response = await s3Client.send(command);
    const body = await response.Body?.transformToByteArray();
    if (!body) throw new Error('Failed to download material file');
    const buffer = Buffer.from(body);

    let extractedText = '';
    let readerStructure: any = null;

    if (claimedMaterial.file_type === FileType.PDF) {
      extractedText = await extractPdfText(buffer, getGeminiClient());
    } else if (claimedMaterial.file_type === FileType.DOC) {
      const rawTextResult = await mammoth.extractRawText({ buffer });
      extractedText = rawTextResult.value;

      const imageMetaBySrc = new Map<string, { description?: string; alt?: string }>();
      const htmlResult = await mammoth.convertToHtml(
        { buffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            const base64 = await image.read('base64');
            const src = `data:${image.contentType};base64,${base64}`;
            const imageBuffer = Buffer.from(base64, 'base64');
            const description = await describeEmbeddedImage(imageBuffer, image.contentType);
            imageMetaBySrc.set(src, {
              description,
            });
            return { src };
          }),
        },
      );

      readerStructure = buildReaderStructureFromHtml(
        htmlResult.value,
        normalizeExtractedText(extractedText),
        imageMetaBySrc,
      );
    } else if (claimedMaterial.file_type === FileType.IMAGE) {
      const client = getGeminiClient();
      if (client) {
        try {
          const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
          const result = await model.generateContent([
            {
              text: 'Extract all text from this image exactly as written. If it contains mathematical notation, preserve it accurately. Include all headings, examples, definitions, and formulas. Output plain text only.',
            },
            {
              inlineData: {
                mimeType: guessImageMimeType(claimedMaterial.file_ref),
                data: buffer.toString('base64'),
              },
            },
          ]);
          extractedText = result.response.text().trim();
        } catch (error) {
          console.error('Gemini image extraction failed, falling back to Vision OCR:', error);
        }
      }

      if (!extractedText) {
        const [result] = await getVisionClient().textDetection(buffer);
        const detections = result.textAnnotations;
        extractedText =
          detections && detections.length > 0
            ? detections[0].description || ''
            : '';
      }
    }

    if (!extractedText) {
      throw new Error('No text extracted from material');
    }

    const normalizedText = normalizeExtractedText(extractedText);
    const resolvedReaderStructure = readerStructure || buildReaderStructure(normalizedText);

    await prisma.material.update({
      where: { id: materialId },
      data: {
        content: normalizedText,
        reader_structure: resolvedReaderStructure as any,
        processing_status: 'EXTRACTED' as any,
        processing_completed_at: new Date(),
        processing_error: null,
        next_retry_at: null,
      } as any,
    });

    const chunks = chunkText(normalizedText, 2000);

    await prisma.materialEmbedding.deleteMany({
      where: { material_id: materialId },
    });

    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      await Promise.all(
        batch.map(async (chunk, batchIndex) => {
          const embedding = await aiProvider.generateEmbedding(chunk);
          await prisma.materialEmbedding.create({
            data: {
              material_id: materialId,
              chunk_index: i + batchIndex,
              chunk_text: chunk,
              embedding: embedding as any,
            },
          });
        }),
      );
    }

    try {
      await generateMaterialTeacherBrain(materialId);
    } catch (error) {
      console.error('teacher_brain_generation_failed', {
        materialId,
        message: error instanceof Error ? error.message : 'Unknown teacher brain error',
      });
      try {
        await createFallbackTeacherBrain(materialId);
      } catch (fallbackError) {
        console.error('teacher_brain_generation_failed', {
          materialId,
          message:
            fallbackError instanceof Error ? fallbackError.message : 'Fallback teacher brain creation failed',
          stage: 'fallback_creation',
        });
      }
    }

    console.log(
      `Material ${materialId} ingested successfully. Triggering checkVerificationThresholdJob.`,
    );
    await checkVerificationThresholdJob(materialId);
  } catch (error) {
    const attempts = Number((claimedMaterial as any).processing_attempts || 1);
    await prisma.material.update({
      where: { id: materialId },
      data: {
        processing_status: 'FAILED' as any,
        processing_error: error instanceof Error ? error.message : 'Unknown ingestion error',
        next_retry_at: computeMaterialRetryAt(attempts),
      } as any,
    });
    throw error;
  }
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.substring(i, i + size));
  }
  return chunks;
}
