import { addMaterialToIndex, addCourseToIndex } from '../shared/search/typesense.sync';
import prisma from '../config/db';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';
import { VerificationStatus } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { notifyContributorsJob } from './notifyContributors.job';
import { generateQuestionsJob } from './generateQuestions.job';

const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

export async function runAIReconciliationJob(materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });

  if (!material) throw new Error('Material not found');

  // Fetch all materials identified as contributors
  const contributorIds = (material.contributor_ids as string[]) || [materialId];
  const similarMaterials = await prisma.material.findMany({
    where: { id: { in: contributorIds } },
    include: { embeddings: true },
  });

  const departmentContext = await prisma.disciplineDocument.findFirst({
    where: { department: material.department, is_active: true },
    orderBy: { version: 'desc' },
  });

  const materialVersions = similarMaterials.map((m) =>
    m.embeddings.map((e) => e.chunk_text).join('\n'),
  );

  const prompt = `As a subject matter expert, reconcile these 10 different versions of course material for ${material.course_code}.
  Produce a single, accurate, and comprehensive verified document.
  Versions: ${JSON.stringify(materialVersions)}
  Context: ${JSON.stringify(departmentContext)}
  Format your response as:
  ---
  CONFIDENCE: [HIGH/LOW]
  ---
  [Verified Content]`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: 'You are an expert academic material verifier.',
    messages: [{ role: 'user', content: prompt }],
  });

  const aiOutput = (response.content[0] as any).text;
  const confidence = aiOutput.includes('CONFIDENCE: HIGH') ? 'HIGH' : 'LOW';
  const contentStart = aiOutput.indexOf('---', aiOutput.indexOf('---') + 3) + 3;
  const verifiedContent = aiOutput.substring(contentStart).trim();

  if (confidence === 'HIGH') {
    const verifiedFileKey = `materials/verified/${materialId}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.r2BucketName,
        Key: verifiedFileKey,
        Body: verifiedContent,
      }),
    );

    await prisma.material.update({
      where: { id: materialId },
      data: {
        verification_status: VerificationStatus.VERIFIED,
        file_ref: verifiedFileKey,
        verified_at: new Date(),
      },
    });

    console.log(`Material ${materialId} VERIFIED with HIGH confidence.`);
    await addMaterialToIndex(materialId);
    await addCourseToIndex(material.course_code, material.university, material.department);
    await notifyContributorsJob(materialId);
    await generateQuestionsJob(materialId);
  } else {
    await prisma.material.update({
      where: { id: materialId },
      data: { verification_status: VerificationStatus.FLAGGED },
    });
    console.log(`Material ${materialId} FLAGGED due to LOW AI confidence.`);
  }
}
