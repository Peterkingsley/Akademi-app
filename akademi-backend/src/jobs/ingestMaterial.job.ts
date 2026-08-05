import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../config/db';
import { config } from '../config/env';
import { FileType } from '@prisma/client';
import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as vision from '@google-cloud/vision';
import { checkVerificationThresholdJob } from './checkVerificationThreshold.job';
import { buildReaderStructure, buildReaderStructureFromHtml, normalizeExtractedText } from '../modules/materials/reader-structure';
import { computeMaterialRetryAt } from '../modules/materials/material-processing';
import { createFallbackTeacherBrain, generateMaterialTeacherBrain } from '../modules/materials/teacher-brain.service';
import { aiProvider } from '../modules/ai/ai.provider';

import { s3Client } from '../shared/storage/r2.client';

let visionClient: vision.ImageAnnotatorClient | null = null;

const getVisionClient = () => {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient(
      config.googleVisionApiKey ? { apiKey: config.googleVisionApiKey } : {},
    );
  }
  return visionClient;
};

// Below this average, we treat the text layer as effectively absent (e.g. a scanned/image-only
// PDF where pdf-parse's own page-marker joining — "-- 1 of 11 --" between empty pages — makes the
// string technically non-empty even though it contains no real content). Tunable without a
// redeploy since scan quality varies a lot across uploads.
const MIN_PDF_CHARS_PER_PAGE = Math.max(Number(process.env.MIN_PDF_CHARS_PER_PAGE || 40), 1);
// Vision's synchronous batchAnnotateFiles caps at 5 pages per request for inline (non-GCS) content.
const VISION_MAX_PAGES_PER_FILE_REQUEST = 5;

type PdfExtractionMethod = 'gemini' | 'pdf-parse' | 'vision-ocr';

function meaningfulCharCount(text: string): number {
  return text.replace(/\s+/g, '').length;
}

function hasSufficientTextLayer(text: string, pageCount: number): boolean {
  const pages = Math.max(pageCount, 1);
  return meaningfulCharCount(text) / pages >= MIN_PDF_CHARS_PER_PAGE;
}

// Uses pdf-parse's own page-by-page text (not just its concatenated .text, which is exactly what
// hides the scanned-PDF failure case) purely as a local, free way to know the true page count and
// a baseline candidate text — no network call.
async function parsePdfLocally(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const parserModule = pdfParse as any;
  if (typeof parserModule.PDFParse !== 'function') {
    throw new Error('PDF parser is not available');
  }
  const parser = new parserModule.PDFParse({ data: buffer });
  const data = await parser.getText();
  await parser.destroy?.();
  return { text: data.text || '', pageCount: data.total || data.pages?.length || 1 };
}

async function extractPdfTextWithGemini(buffer: Buffer): Promise<string> {
  return aiProvider.generateMultimodalResponse(
    [
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
    ],
    { extendedTimeouts: true },
  );
}

// Real OCR fallback for scanned/image-only PDFs, matching the Vision textDetection pattern already
// used for standalone IMAGE uploads below — but PDFs go through Vision's file-annotation API
// (DOCUMENT_TEXT_DETECTION over inline PDF bytes) since textDetection only accepts raster images.
// Chunked into groups of VISION_MAX_PAGES_PER_FILE_REQUEST since sync batchAnnotateFiles rejects
// more than 5 pages per request for inline content.
async function ocrPdfWithVision(buffer: Buffer, pageCount: number): Promise<string> {
  const client = getVisionClient();
  const pageTexts: string[] = [];

  for (let start = 1; start <= pageCount; start += VISION_MAX_PAGES_PER_FILE_REQUEST) {
    const pages: number[] = [];
    for (let p = start; p < start + VISION_MAX_PAGES_PER_FILE_REQUEST && p <= pageCount; p += 1) {
      pages.push(p);
    }

    const [result] = await client.batchAnnotateFiles({
      requests: [
        {
          inputConfig: { content: buffer, mimeType: 'application/pdf' },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          pages,
        },
      ],
    });

    const fileResponse = result.responses?.[0];
    if (fileResponse?.error) {
      throw new Error(`Vision PDF OCR failed on pages ${pages.join(',')}: ${fileResponse.error.message}`);
    }

    for (const pageResponse of fileResponse?.responses || []) {
      pageTexts.push(pageResponse.fullTextAnnotation?.text?.trim() || '');
    }
  }

  return pageTexts.filter(Boolean).join('\n\n');
}

async function extractPdfContent(
  buffer: Buffer,
  materialId: string,
): Promise<{ text: string; method: PdfExtractionMethod; pageCount: number }> {
  const { text: localText, pageCount } = await parsePdfLocally(buffer);

  let candidateText = localText;
  let method: PdfExtractionMethod = 'pdf-parse';

  try {
    const geminiText = await extractPdfTextWithGemini(buffer);
    if (geminiText.length > 100) {
      candidateText = geminiText;
      method = 'gemini';
    }
  } catch (error) {
    console.error('Gemini PDF extraction failed, falling back to pdf-parse:', error);
  }

  if (!hasSufficientTextLayer(candidateText, pageCount)) {
    console.log(
      `[ingest-material] material ${materialId}: ${method} extraction insufficient ` +
        `(${meaningfulCharCount(candidateText)} meaningful chars over ${pageCount} pages) — falling back to Vision OCR.`,
    );
    try {
      const ocrText = await ocrPdfWithVision(buffer, pageCount);
      if (meaningfulCharCount(ocrText) > meaningfulCharCount(candidateText)) {
        candidateText = ocrText;
        method = 'vision-ocr';
      }
    } catch (error) {
      console.error(`[ingest-material] material ${materialId}: Vision OCR fallback failed:`, error);
    }
  }

  if (meaningfulCharCount(candidateText) === 0) {
    throw new Error(`No usable text extracted from PDF after OCR fallback (${pageCount} pages)`);
  }

  console.log(
    `[ingest-material] material ${materialId}: PDF extraction path = ${method} ` +
      `(${pageCount} pages, ${meaningfulCharCount(candidateText)} meaningful chars).`,
  );

  return { text: candidateText, method, pageCount };
}

async function describeEmbeddedImage(buffer: Buffer, mimeType: string) {
  try {
    return await aiProvider.generateMultimodalResponse([
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
  } catch (error) {
    console.error('Gemini image description failed, falling back:', error);
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
    let extractionMethod = 'unknown';

    if (claimedMaterial.file_type === FileType.PDF) {
      const pdfResult = await extractPdfContent(buffer, materialId);
      extractedText = pdfResult.text;
      extractionMethod = pdfResult.method;
    } else if (claimedMaterial.file_type === FileType.DOC) {
      extractionMethod = 'mammoth';
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
      try {
        extractedText = await aiProvider.generateMultimodalResponse([
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
        extractionMethod = 'gemini-image';
      } catch (error) {
        console.error('Gemini image extraction failed, falling back to Vision OCR:', error);
      }

      if (!extractedText) {
        const [result] = await getVisionClient().textDetection(buffer);
        const detections = result.textAnnotations;
        extractedText =
          detections && detections.length > 0
            ? detections[0].description || ''
            : '';
        extractionMethod = 'vision-image-ocr';
      }
    }

    if (!extractedText) {
      throw new Error('No text extracted from material');
    }

    console.log(`[ingest-material] material ${materialId}: extraction_method=${extractionMethod}`);

    const normalizedText = normalizeExtractedText(extractedText);
    const resolvedReaderStructure = readerStructure || buildReaderStructure(normalizedText);
    resolvedReaderStructure.extraction_method = extractionMethod;

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
