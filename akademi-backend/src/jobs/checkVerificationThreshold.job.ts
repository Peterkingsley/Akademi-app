import prisma from '../config/db';
import { runAIReconciliationJob } from './runAIReconciliation.job';

export async function checkVerificationThresholdJob(materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: { embeddings: true },
  });

  if (!material) throw new Error('Material not found');

  // Fetch all other materials for the same course
  const otherMaterials = await prisma.material.findMany({
    where: {
      course_code: material.course_code,
      university: material.university,
      department: material.department,
      level: material.level,
      id: { not: materialId },
    },
    include: { embeddings: true },
  });

  let similarCount = 1; // Start with the current material
  const similarMaterialIds: string[] = [materialId];

  for (const other of otherMaterials) {
    const similarity = calculateSimilarity(
      material.embeddings,
      other.embeddings,
    );
    if (similarity > 0.85) {
      similarCount++;
      similarMaterialIds.push(other.id);
    }
  }

  console.log(
    `Material ${materialId} similarity check complete. Found ${similarCount} similar materials.`,
  );

  if (similarCount >= 10) {
    console.log(
      `Threshold reached for ${material.course_code}. Triggering runAIReconciliationJob.`,
    );
    // Pass the list of similar materials to the reconciliation job
    // The requirement says "material stays PENDING until 10 similar uploads received"
    // and "AI reconciliation triggered at 10 uploads"
    await runAIReconciliationJob(materialId);
  } else {
    // Notify uploader that material is pending (Log for now or trigger a notification)
    await prisma.material.update({
      where: { id: materialId },
      data: { upload_count: similarCount, contributor_ids: similarMaterialIds },
    });
    console.log(
      `Material ${materialId} update with count ${similarCount}. Still pending.`,
    );
  }
}

function calculateSimilarity(embeddings1: { embedding: any }[], embeddings2: { embedding: any }[]): number {
  if (embeddings1.length === 0 || embeddings2.length === 0) return 0;

  // Simple average cosine similarity between all chunks as a heuristic
  let totalSimilarity = 0;
  let comparisons = 0;

  for (const e1 of embeddings1) {
    for (const e2 of embeddings2) {
      totalSimilarity += cosineSimilarity(
        e1.embedding as number[],
        e2.embedding as number[],
      );
      comparisons++;
    }
  }

  return totalSimilarity / comparisons;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
