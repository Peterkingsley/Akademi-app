import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { MaterialFilter, UploadMaterialRequest, ReportMaterialRequest } from './materials.types';
import { VerificationStatus } from '@prisma/client';
import { systemQueue, JOB_NAMES } from '../../config/queue';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

export class MaterialsService {
  async listMaterials(filter: MaterialFilter) {
    return prisma.material.findMany({
      where: {
        university: filter.university,
        faculty: filter.faculty,
        department: filter.department,
        course_code: filter.course_code,
        level: filter.level ? Number(filter.level) : undefined,
        verification_status: VerificationStatus.VERIFIED,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getMaterial(id: string) {
    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!material) {
      throw new Error('Material not found');
    }

    return material;
  }

  async createUpload(userId: string, data: UploadMaterialRequest) {
    const material = await prisma.material.create({
      data: {
        title: data.title,
        course_code: data.course_code,
        university: data.university,
        faculty: data.faculty,
        department: data.department,
        level: data.level,
        file_type: data.file_type,
        verification_status: VerificationStatus.PENDING,
        uploaded_by: userId,
        file_ref: '', // Will be updated after upload or derived
        contributor_ids: [userId],
      },
    });

    const fileKey = `materials/pending/${material.id}`;

    // Update material with file_ref
    await prisma.material.update({
      where: { id: material.id },
      data: { file_ref: fileKey }
    });

    const command = new PutObjectCommand({
      Bucket: config.r2BucketName,
      Key: fileKey,
      ContentType: 'application/octet-stream', // Generic, or use file_type to map
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      materialId: material.id,
      presignedUrl,
    };
  }

  async getDownloadUrl(id: string) {
    const material = await this.getMaterial(id);

    const command = new GetObjectCommand({
      Bucket: config.r2BucketName,
      Key: material.file_ref,
    });

    return getSignedUrl(s3Client, command, { expiresIn: 3600 });
  }

  async getQuestions(id: string) {
    const material = await prisma.material.findUnique({
      where: { id, verification_status: VerificationStatus.VERIFIED },
    });

    if (!material) {
      throw new Error('Verified material not found');
    }

    return prisma.question.findMany({
      where: { material_id: id },
    });
  }

  async reportMaterial(id: string, userId: string, data: ReportMaterialRequest) {
    return prisma.material.update({
      where: { id },
      data: {
        verification_status: VerificationStatus.FLAGGED,
      },
    });
  }

  async confirmUpload(id: string, userId: string) {
    const material = await prisma.material.findUnique({
      where: { id, uploaded_by: userId },
      include: { upload_chunks: true }
    });

    if (!material) {
      throw new Error('Material not found');
    }

    console.log(`Confirming upload for material ${id}`);

    // If chunks exist, trigger assembly
    if (material.upload_chunks.length > 0) {
      systemQueue.add(JOB_NAMES.ASSEMBLE_CHUNKS, { materialId: id }).catch(console.error);
    } else {
      // Direct upload, trigger ingestion
      systemQueue.add(JOB_NAMES.INGEST_MATERIAL, { materialId: id }).catch(console.error);
    }

    return prisma.material.update({
      where: { id },
      data: {
        verification_status: VerificationStatus.PENDING,
      },
    });
  }

  // Helper method for admin or auto-verification to trigger question generation
  async verifyMaterial(id: string) {
    const material = await prisma.material.update({
      where: { id },
      data: {
        verification_status: VerificationStatus.VERIFIED,
        verified_at: new Date(),
      },
    });

    // Trigger question generation job
    systemQueue.add(JOB_NAMES.GENERATE_QUESTIONS, { materialId: id }).catch(console.error);

    return material;
  }

  async getPendingUploads(userId: string) {
    return prisma.material.findMany({
      where: {
        uploaded_by: userId,
        verification_status: VerificationStatus.PENDING,
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
