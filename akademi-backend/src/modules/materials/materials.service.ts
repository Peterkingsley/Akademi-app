import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { MaterialFilter, UploadMaterialRequest, ReportMaterialRequest } from './materials.types';
import { Feature, VerificationStatus } from '@prisma/client';
import { systemQueue, JOB_NAMES } from '../../config/queue';
import { checkFeatureAccess } from '../../shared/utils/feature-access';
import { generateQuestionsJob } from '../../jobs/generateQuestions.job';
import { buildReaderStructure } from './reader-structure';
import { ingestMaterialJob } from '../../jobs/ingestMaterial.job';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

export class MaterialsService {
  private shuffleQuestions<T>(items: T[]) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  async listMaterials(filter: MaterialFilter) {
    return prisma.material.findMany({
      where: {
        university: filter.university,
        faculty: filter.faculty,
        department: filter.department,
        course_code: filter.course_code,
        level: filter.level ? Number(filter.level) : undefined,
        semester: filter.semester ? Number(filter.semester) : undefined,
        verification_status: VerificationStatus.VERIFIED,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getMaterial(id: string) {
    let docImageDiagnostic: { code: string; message: string; detail?: string } | null = null;
    let material = await prisma.material.findUnique({
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

    const needsDocReingest =
      material.file_type === 'DOC' &&
      (
        !material.reader_structure ||
        !Array.isArray((material.reader_structure as any)?.pages) ||
        !(material.reader_structure as any).pages.some((page: any) =>
          Array.isArray(page.blocks) && page.blocks.some((block: any) => block?.type === 'image' && block?.src)
        )
      );

    if (needsDocReingest) {
      try {
        await ingestMaterialJob(id);
        material = await prisma.material.findUnique({
          where: { id },
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        });
      } catch (error) {
        console.error(`Failed to re-ingest DOC material ${id} for reader images:`, error);
        docImageDiagnostic = {
          code: 'DOC_REINGEST_FAILED',
          message: 'This document could not be re-processed for embedded images.',
          detail: error instanceof Error ? error.message : 'Unknown re-ingest error',
        };
      }
    }

    if (!material) {
      throw new Error('Material not found');
    }

    if (!material.reader_structure && material.content?.trim()) {
      const readerStructure = buildReaderStructure(material.content);
      material = await prisma.material.update({
        where: { id },
        data: {
          reader_structure: readerStructure as any,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });
    }

    const diagnostics = this.buildMaterialDiagnostics(material, docImageDiagnostic);

    return {
      ...material,
      diagnostics,
    };
  }

  async createUpload(userId: string, data: UploadMaterialRequest) {
    const courseCode = data.course_code?.trim().toUpperCase() || null;
    const matchingStudentCourse = courseCode
      ? await prisma.studentCourse.findFirst({
          where: {
            user_id: userId,
            code: courseCode,
            level: data.level,
            ...(data.semester ? { semester: Number(data.semester) } : {}),
          },
          orderBy: [{ semester: 'asc' }, { created_at: 'desc' }],
        })
      : null;

    const semester = data.semester ? Number(data.semester) : matchingStudentCourse?.semester || null;
    const semesterStart = data.semester_start
      ? new Date(data.semester_start)
      : matchingStudentCourse?.semester_start || null;
    const semesterEnd = data.semester_end
      ? new Date(data.semester_end)
      : matchingStudentCourse?.semester_end || null;

    const material = await prisma.material.create({
      data: {
        title: data.title,
        course_code: courseCode,
        university: data.university,
        faculty: data.faculty,
        department: data.department,
        level: data.level,
        semester,
        semester_start: semesterStart,
        semester_end: semesterEnd,
        academic_year: data.academic_year?.trim() || this.getAcademicYear(semesterStart),
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

  async getQuestions(id: string, userId: string, limit?: number) {
    const material = await prisma.material.findUnique({
      where: { id, verification_status: VerificationStatus.VERIFIED },
    });

    if (!material) {
      throw new Error('Verified material not found');
    }

    const hasAccess = await checkFeatureAccess(userId, Feature.EXAM_PREP, 'MATERIAL', id);
    if (!hasAccess) {
      throw new Error('Material CBT Day Pass required');
    }

    const take = Math.min(Math.max(Number(limit) || 10, 5), 50);

    const attemptedQuestionIds = await prisma.questionAttempt.findMany({
      where: {
        user_id: userId,
        question: {
          material_id: id,
        },
      },
      select: {
        question_id: true,
      },
      distinct: ['question_id'],
    });

    const attemptedSet = new Set(attemptedQuestionIds.map((attempt) => attempt.question_id));

    const loadAvailableQuestions = async () =>
      prisma.question.findMany({
        where: {
          material_id: id,
          id: {
            notIn: [...attemptedSet],
          },
        },
        orderBy: { generated_at: 'desc' },
      });

    let availableQuestions = await loadAvailableQuestions();

    if (availableQuestions.length < take) {
      const existingQuestions = await prisma.question.findMany({
        where: { material_id: id },
        select: { question_text: true },
      });

      const generationTarget = Math.max(take - availableQuestions.length + 5, 10);
      try {
        await generateQuestionsJob(id, {
          count: generationTarget,
          excludeQuestionTexts: existingQuestions.map((question) => question.question_text),
        });
      } catch (error) {
        console.error(`Failed to generate additional CBT questions for material ${id}:`, error);
      }

      availableQuestions = await loadAvailableQuestions();
    }

    if (availableQuestions.length === 0) {
      throw new Error('No CBT questions are available for this material yet.');
    }

    return this.shuffleQuestions(availableQuestions).slice(0, take);
  }

  async submitQuestionAttempts(
    materialId: string,
    userId: string,
    answers: Array<{ questionId: string; answer?: string | null }>
  ) {
    const questionIds = answers.map((entry) => entry.questionId).filter(Boolean);
    if (questionIds.length === 0) {
      return { created: 0 };
    }

    const questions = await prisma.question.findMany({
      where: {
        id: { in: questionIds },
        material_id: materialId,
      },
      select: {
        id: true,
        correct_answer: true,
        explanation: true,
        approach_guide: true,
      },
    });

    const byId = new Map(questions.map((question) => [question.id, question]));

    const payload = answers
      .map((entry) => {
        const question = byId.get(entry.questionId);
        if (!question) return null;
        const answer = String(entry.answer || '').trim();
        const correct = String(question.correct_answer || '').trim();
        const isCorrect =
          !!correct && !!answer && answer.toLowerCase() === correct.toLowerCase();

        return {
          user_id: userId,
          question_id: question.id,
          answer,
          is_correct: isCorrect,
          feedback: isCorrect
            ? 'Correct. Nice work.'
            : question.explanation || question.approach_guide,
        };
      })
      .filter(Boolean) as Array<{
        user_id: string;
        question_id: string;
        answer: string;
        is_correct: boolean;
        feedback: string;
      }>;

    if (payload.length === 0) {
      return { created: 0 };
    }

    await prisma.questionAttempt.createMany({
      data: payload,
    });

    return { created: payload.length };
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

    await prisma.material.update({
      where: { id },
      data: {
        verification_status: VerificationStatus.PENDING,
      },
    });

    try {
      // If chunks exist, trigger assembly
      if (material.upload_chunks.length > 0) {
        await systemQueue.add(JOB_NAMES.ASSEMBLE_CHUNKS, { materialId: id });
      } else {
        // Direct upload, trigger ingestion
        await systemQueue.add(JOB_NAMES.INGEST_MATERIAL, { materialId: id });
      }
    } catch (error) {
      console.error(`Material ${id} upload confirmed, but ingestion failed:`, error);
    }

    return this.getMaterial(id);
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
    await systemQueue.add(JOB_NAMES.GENERATE_QUESTIONS, { materialId: id });

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

  private getAcademicYear(date?: Date | null) {
    if (!date || Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const startsPreviousYear = date.getMonth() < 7;
    const startYear = startsPreviousYear ? year - 1 : year;
    return `${startYear}/${startYear + 1}`;
  }

  private buildMaterialDiagnostics(
    material: any,
    existingDiagnostic?: { code: string; message: string; detail?: string } | null,
  ) {
    const pages = Array.isArray(material?.reader_structure?.pages) ? material.reader_structure.pages : [];
    const imageBlocks = pages.flatMap((page: any) =>
      Array.isArray(page?.blocks) ? page.blocks.filter((block: any) => block?.type === 'image' && block?.src) : []
    );
    const contentText = String(material?.content || '');
    const hasFigureLanguage = /(figure\s*\d+|diagram|chart|graph|illustration|image)/i.test(contentText);

    const warnings: Array<{ code: string; message: string; detail?: string }> = [];

    if (existingDiagnostic) {
      warnings.push(existingDiagnostic);
    }

    if (material?.file_type === 'DOC' && hasFigureLanguage && imageBlocks.length === 0) {
      warnings.push({
        code: 'DOC_IMAGES_MISSING',
        message: 'This material mentions figures or diagrams, but no embedded images were extracted.',
        detail: 'The DOCX text was extracted, but the image layer did not make it into the reader payload.',
      });
    }

    if (material?.file_type === 'DOC' && pages.length === 0 && contentText.trim()) {
      warnings.push({
        code: 'READER_STRUCTURE_EMPTY',
        message: 'The reader structure could not be built from this document.',
        detail: 'Text exists, but page blocks were not generated as expected.',
      });
    }

    return {
      fileType: material?.file_type || null,
      pageCount: pages.length,
      imageBlockCount: imageBlocks.length,
      hasFigureLanguage,
      warnings,
    };
  }
}
