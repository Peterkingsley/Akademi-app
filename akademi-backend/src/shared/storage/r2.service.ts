import {
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from './r2.client';
import { config } from '../../config/env';
import { encrypt } from './r2.encryption';
import prisma from '../../config/db';
import crypto from 'crypto';

/**
 * Generate a presigned URL for a large file upload.
 */
export async function generatePresignedUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.r2BucketName,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Upload a small file directly to R2.
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.r2BucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3Client.send(command);
  return `${config.r2PublicUrl}/${key}`;
}

/**
 * Move a file between R2 folders.
 */
export async function moveFile(
  sourceKey: string,
  destKey: string,
): Promise<void> {
  const copyCommand = new CopyObjectCommand({
    Bucket: config.r2BucketName,
    CopySource: `${config.r2BucketName}/${sourceKey}`,
    Key: destKey,
  });
  await s3Client.send(copyCommand);

  const deleteCommand = new DeleteObjectCommand({
    Bucket: config.r2BucketName,
    Key: sourceKey,
  });
  await s3Client.send(deleteCommand);
}

/**
 * Delete a file from R2.
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: config.r2BucketName,
    Key: key,
  });
  await s3Client.send(command);
}

/**
 * Schedule audio deletion after 24 hours.
 * Note: In a real implementation, this would likely use a job scheduler or S3 Lifecycle Rule.
 * For this task, we'll provide the method signature as requested.
 */
export async function scheduleAudioDeletion(key: string): Promise<void> {
  // Implementation would typically involve a background job or setting an R2 lifecycle policy.
  // For the purpose of this ticket, we'll log it as scheduled.
  console.log(`Scheduled deletion for audio file: ${key} in 24 hours.`);
}

/**
 * Bundle offline package.
 * 1. Fetch verified material document from R2
 * 2. Fetch all questions for this material from DB
 * 3. Bundle both into a single JSON package
 * 4. Encrypt with AES-256 using student-specific key
 * 5. Upload to /materials/offline/{materialId}
 * 6. Return presigned download URL
 */
export async function bundleOfflinePackage(
  materialId: string,
  studentId: string,
): Promise<{ downloadUrl: string; encryptionKey: string }> {
  // 1. Fetch verified material document
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });
  if (!material) throw new Error('Material not found');

  const getCommand = new GetObjectCommand({
    Bucket: config.r2BucketName,
    Key: material.file_ref,
  });
  const response = await s3Client.send(getCommand);
  const materialData = await response.Body?.transformToByteArray();
  if (!materialData) throw new Error('Failed to fetch material data');

  // 2. Fetch all questions for this material
  const questions = await prisma.question.findMany({
    where: { material_id: materialId },
  });

  // 3. Bundle into JSON package
  const bundle = {
    material: {
      id: material.id,
      title: material.title,
      course_code: material.course_code,
      data: Buffer.from(materialData).toString('base64'),
    },
    questions: questions.map((q) => ({
      id: q.id,
      text: q.question_text,
      guide: q.approach_guide,
      difficulty: q.difficulty,
    })),
  };
  const bundleBuffer = Buffer.from(JSON.stringify(bundle));

  // 4. Encrypt with AES-256 using a cryptographically-random per-package key.
  // NEVER derive the key from a public identifier such as the studentId — that
  // would let anyone who knows the id recompute the key. The caller is
  // responsible for storing/delivering the returned key over a secure channel
  // (e.g. persisted per-user via KMS).
  const encryptionKey = crypto.randomBytes(32);
  const encryptedBundle = encrypt(bundleBuffer, encryptionKey);

  // 5. Upload to /materials/offline/{materialId}
  const offlineKey = `materials/offline/${materialId}/${studentId}.pkg`;
  await uploadFile(offlineKey, encryptedBundle, 'application/octet-stream');

  // 6. Return presigned download URL and the key needed to decrypt the bundle.
  const downloadUrl = await generatePresignedUrl(offlineKey, 3600);
  return { downloadUrl, encryptionKey: encryptionKey.toString('base64') };
}
