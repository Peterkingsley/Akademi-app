import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../config/db';
import { config } from '../config/env';
import { FileType } from '@prisma/client';
import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as vision from '@google-cloud/vision';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkVerificationThresholdJob } from './checkVerificationThreshold.job';

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

function normalizeVector(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return values;
  return values.map(value => Number((value / magnitude).toFixed(6)));
}

function hashTextEmbedding(text: string, dimensions = 256) {
  const vector = new Array(dimensions).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];

  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % dimensions;
    vector[index] += 1;
  }

  return normalizeVector(vector);
}

async function generateEmbedding(text: string) {
  const client = getGeminiClient();

  if (client) {
    try {
      const model = client.getGenerativeModel({ model: 'embedding-001' });
      const result = await model.embedContent(text.slice(0, 8000));
      const values = result.embedding.values;
      if (values?.length) return values;
    } catch (error) {
      console.error('Gemini embedding failed, using deterministic fallback:', error);
    }
  }

  return hashTextEmbedding(text);
}

async function extractPdfText(buffer: Buffer) {
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
    extractedText = await extractPdfText(buffer);
  } else if (material.file_type === FileType.DOC) {
    const result = await mammoth.extractRawText({ buffer });
    extractedText = result.value;
  } else if (material.file_type === FileType.IMAGE) {
    const [result] = await getVisionClient().textDetection(buffer);
    const detections = result.textAnnotations;
    extractedText =
      detections && detections.length > 0
        ? detections[0].description || ''
        : '';
  }

  if (!extractedText) {
    throw new Error('No text extracted from material');
  }

  // Save extracted text to material content
  await prisma.material.update({
    where: { id: materialId },
    data: { content: extractedText }
  });

  // Chunk text (~500 tokens, roughly 2000 characters for estimation)
  const chunks = chunkText(extractedText, 2000);

  await prisma.materialEmbedding.deleteMany({
    where: { material_id: materialId },
  });

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    const embedding = await generateEmbedding(chunkText);

    await prisma.materialEmbedding.create({
      data: {
        material_id: materialId,
        chunk_index: i,
        chunk_text: chunkText,
        embedding: embedding as any,
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
