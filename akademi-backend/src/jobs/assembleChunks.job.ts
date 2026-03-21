import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import prisma from '../config/db';
import { config } from '../config/env';
import { ChunkStatus } from '@prisma/client';
import { ingestMaterialJob } from './ingestMaterial.job';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

export async function assembleChunksJob(materialId: string) {
  const chunks = await prisma.uploadChunk.findMany({
    where: { material_id: materialId },
    orderBy: { chunk_index: 'asc' },
  });

  if (chunks.length === 0) {
    throw new Error('No chunks found for material');
  }

  const totalChunks = chunks[0].total_chunks;
  if (chunks.length !== totalChunks) {
    console.log(
      `Not all chunks uploaded yet for material ${materialId}. Found ${chunks.length}/${totalChunks}`,
    );
    return;
  }

  // Check if all chunks are UPLOADED
  if (chunks.some((c) => c.status !== ChunkStatus.UPLOADED)) {
    console.log(
      `Some chunks are not in UPLOADED status for material ${materialId}`,
    );
    return;
  }

  console.log(`Assembling ${totalChunks} chunks for material ${materialId}`);

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const command = new GetObjectCommand({
      Bucket: config.r2BucketName,
      Key: chunk.chunk_ref,
    });
    const response = await s3Client.send(command);
    const body = await response.Body?.transformToByteArray();
    if (!body) throw new Error(`Failed to download chunk ${chunk.chunk_index}`);
    buffers.push(Buffer.from(body));
  }

  const assembledBuffer = Buffer.concat(buffers);
  const fileKey = `materials/pending/${materialId}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.r2BucketName,
      Key: fileKey,
      Body: assembledBuffer,
    }),
  );

  // Delete chunks from R2 and update DB
  for (const chunk of chunks) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: config.r2BucketName,
        Key: chunk.chunk_ref,
      }),
    );
  }

  await prisma.uploadChunk.updateMany({
    where: { material_id: materialId },
    data: { status: ChunkStatus.ASSEMBLED },
  });

  await prisma.material.update({
    where: { id: materialId },
    data: { file_ref: fileKey },
  });

  console.log(
    `Material ${materialId} assembled successfully. Triggering ingestMaterialJob.`,
  );
  await ingestMaterialJob(materialId);
}
