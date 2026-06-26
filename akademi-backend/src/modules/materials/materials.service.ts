import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { MaterialFilter, UploadMaterialRequest, ReportMaterialRequest } from './materials.types';
import { AdminRole, Feature, FileType, VerificationStatus } from '@prisma/client';
import { systemQueue, JOB_NAMES } from '../../config/queue';
import { checkFeatureAccess } from '../../shared/utils/feature-access';
import { generateQuestionsJob } from '../../jobs/generateQuestions.job';
import { buildReaderStructure } from './reader-structure';
import { ingestMaterialJob } from '../../jobs/ingestMaterial.job';
import { queueMaterialIngestion } from './material-processing';
import { backfillTeacherBrains, regenerateTeacherBrain } from './teacher-brain.service';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

export class MaterialsService {
  private async getAdminRoleByEmail(email?: string | null) {
    if (!email) return null;
    const admin = await prisma.admin.findFirst({
      where: { email, status: 'active' as any },
      select: { role: true },
    });
    return admin?.role || null;
  }

  private mapStorageError(error: unknown, fallbackMessage: string) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${fallbackMessage} Please try again shortly. (${detail})`);
  }

  private readonly allowedUploadMimeTypes: Record<FileType, string[]> = {
    PDF: ['application/pdf'],
    DOC: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'text/json',
    ],
    IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  };

  private readonly allowedUploadExtensions: Record<FileType, string[]> = {
    PDF: ['pdf'],
    DOC: ['doc', 'docx', 'txt', 'md', 'csv', 'json'],
    IMAGE: ['jpg', 'jpeg', 'png', 'webp'],
  };

  private readonly uploadSizeLimits: Record<FileType, number> = {
    PDF: 20 * 1024 * 1024,
    DOC: 20 * 1024 * 1024,
    IMAGE: 10 * 1024 * 1024,
  };

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

  private getFileExtension(fileName: string) {
    const parts = fileName.trim().split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }

  private normalizeMimeType(mimeType: string) {
    return mimeType.trim().toLowerCase();
  }

  private sanitizeFileName(fileName: string) {
    return fileName.replace(/[^\w.\-() ]+/g, '_').trim();
  }

  private assertUploadPayload(data: UploadMaterialRequest) {
    const title = data.title?.trim();
    if (!title || title.length < 3 || title.length > 180) {
      throw new Error('Title must be between 3 and 180 characters');
    }

    if (!data.university?.trim() || !data.faculty?.trim() || !data.department?.trim()) {
      throw new Error('Academic profile details are required for uploads');
    }

    const fileName = this.sanitizeFileName(data.file_name || '');
    if (!fileName || fileName.length > 180) {
      throw new Error('A valid file name is required');
    }

    const fileSize = Number(data.file_size);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error('A valid file size is required');
    }

    const mimeType = this.normalizeMimeType(data.mime_type || '');
    if (!mimeType) {
      throw new Error('A valid MIME type is required');
    }

    const extension = this.getFileExtension(fileName);
    const allowedMimeTypes = this.allowedUploadMimeTypes[data.file_type] || [];
    const allowedExtensions = this.allowedUploadExtensions[data.file_type] || [];
    const maxSize = this.uploadSizeLimits[data.file_type];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error(`Unsupported MIME type for ${data.file_type} upload`);
    }

    if (!allowedExtensions.includes(extension)) {
      throw new Error(`Unsupported file extension for ${data.file_type} upload`);
    }

    if (fileSize > maxSize) {
      throw new Error(`File exceeds the ${Math.round(maxSize / (1024 * 1024))}MB upload limit for ${data.file_type}`);
    }

    return {
      title,
      fileName,
      fileSize,
      mimeType,
      extension,
      courseCode: data.course_code?.trim().toUpperCase() || null,
      academicYear: data.academic_year?.trim() || null,
      university: data.university.trim(),
      faculty: data.faculty.trim(),
      department: data.department.trim(),
    };
  }

  private canAccessMaterial(material: { verification_status: VerificationStatus; uploaded_by: string }, requestingUserId?: string | null, requestingAdminRole?: AdminRole | null) {
    if (material.verification_status === VerificationStatus.VERIFIED) {
      return true;
    }

    if (requestingAdminRole) {
      return true;
    }

    return Boolean(requestingUserId && material.uploaded_by === requestingUserId);
  }

  private async ensureCourseCodeExistsForUpload(
    userId: string,
    payload: {
      courseCode: string | null;
      university: string;
      faculty: string;
      department: string;
      level: number;
      semester?: number | null;
      semester_start?: string | null;
      semester_end?: string | null;
    },
  ) {
    if (!payload.courseCode) {
      return null;
    }

    const departmentUniversity = await prisma.university.upsert({
      where: { name: payload.university },
      update: {},
      create: { name: payload.university, location: 'Nigeria' },
      select: { id: true },
    });

    const department = await prisma.department.upsert({
      where: {
        name_university_id: {
          name: payload.department,
          university_id: departmentUniversity.id,
        },
      },
      update: { faculty: payload.faculty },
      create: {
        name: payload.department,
        faculty: payload.faculty,
        university_id: departmentUniversity.id,
      },
      select: { id: true },
    });

    const fallbackStudentCourse = await prisma.studentCourse.findFirst({
      where: {
        user_id: userId,
        level: payload.level,
      },
      orderBy: [{ updated_at: 'desc' }],
      select: {
        semester: true,
        semester_start: true,
        semester_end: true,
      },
    });

    const semester = payload.semester || fallbackStudentCourse?.semester || 1;
    const semesterStart = payload.semester_start
      ? new Date(payload.semester_start)
      : fallbackStudentCourse?.semester_start || null;
    const semesterEnd = payload.semester_end
      ? new Date(payload.semester_end)
      : fallbackStudentCourse?.semester_end || null;

    await prisma.course.upsert({
      where: {
        code_department_id: {
          code: payload.courseCode,
          department_id: department.id,
        },
      },
      update: {
        level: payload.level,
        semester,
      },
      create: {
        code: payload.courseCode,
        name: payload.courseCode,
        level: payload.level,
        semester,
        source: 'student_upload',
        department_id: department.id,
      },
    });

    if (semesterStart && semesterEnd) {
      await prisma.studentCourse.upsert({
        where: {
          user_id_code_level_semester: {
            user_id: userId,
            code: payload.courseCode,
            level: payload.level,
            semester,
          },
        },
        update: {
          department_id: department.id,
          name: payload.courseCode,
          semester_start: semesterStart,
          semester_end: semesterEnd,
          source: 'student_upload',
        },
        create: {
          user_id: userId,
          department_id: department.id,
          code: payload.courseCode,
          name: payload.courseCode,
          level: payload.level,
          semester,
          semester_start: semesterStart,
          semester_end: semesterEnd,
          source: 'student_upload',
        },
      });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { courses: true },
    });

    const nextCourses = Array.from(new Set([...(currentUser?.courses || []), payload.courseCode]));

    await prisma.user.update({
      where: { id: userId },
      data: {
        courses: nextCourses,
      },
    });

    return { departmentId: department.id, semester, semesterStart, semesterEnd };
  }

  async getMaterial(id: string, access?: { requestingUserId?: string | null; requestingAdminRole?: AdminRole | null }) {
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

    if (!this.canAccessMaterial(material, access?.requestingUserId, access?.requestingAdminRole)) {
      throw new Error('You do not have access to this material');
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

  async getTeacherBrain(
    materialId: string,
    requester: { userId: string; email?: string | null },
  ) {
    const adminRole = await this.getAdminRoleByEmail(requester.email);
    const material = await this.getMaterial(materialId, {
      requestingUserId: requester.userId,
      requestingAdminRole: adminRole,
    });

    const teacherBrain = await prisma.materialTeacherBrain.findUnique({
      where: { material_id: materialId },
      select: {
        id: true,
        material_id: true,
        course_code: true,
        university: true,
        faculty: true,
        department: true,
        level: true,
        summary: true,
        chapter_summaries: true,
        concept_graph: true,
        prerequisites: true,
        formulas: true,
        calculation_methods: true,
        diagrams: true,
        misconceptions: true,
        exam_angles: true,
        teacher_notes: true,
        subject_family: true,
        confidence: true,
        generated_at: true,
        updated_at: true,
      },
    });

    if (!teacherBrain) {
      throw new Error('Teacher Brain not found for this material.');
    }

    return {
      materialId: material.id,
      title: material.title,
      teacherBrain,
    };
  }

  async regenerateMaterialTeacherBrain(
    materialId: string,
    requester: { userId: string; email?: string | null },
    options?: { force?: boolean },
  ) {
    const adminRole = await this.getAdminRoleByEmail(requester.email);
    await this.getMaterial(materialId, {
      requestingUserId: requester.userId,
      requestingAdminRole: adminRole,
    });

    return regenerateTeacherBrain(materialId, options);
  }

  async backfillMaterialTeacherBrains(
    requester: { userId: string; email?: string | null },
    options?: {
      limit?: number;
      courseCode?: string;
      department?: string;
      subjectFamily?: string;
      missingOnly?: boolean;
      force?: boolean;
    },
  ) {
    const adminRole = await this.getAdminRoleByEmail(requester.email);
    if (!adminRole) {
      throw new Error('Only admins can backfill teacher brains.');
    }

    return backfillTeacherBrains(options);
  }

  async createUpload(userId: string, data: UploadMaterialRequest) {
    const validated = this.assertUploadPayload(data);
    const courseCode = validated.courseCode;
    const ensuredCourse = await this.ensureCourseCodeExistsForUpload(userId, {
      courseCode,
      university: validated.university,
      faculty: validated.faculty,
      department: validated.department,
      level: data.level,
      semester: data.semester,
      semester_start: data.semester_start,
      semester_end: data.semester_end,
    });
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

    const semester = data.semester ? Number(data.semester) : matchingStudentCourse?.semester || ensuredCourse?.semester || null;
    const semesterStart = data.semester_start
      ? new Date(data.semester_start)
      : matchingStudentCourse?.semester_start || ensuredCourse?.semesterStart || null;
    const semesterEnd = data.semester_end
      ? new Date(data.semester_end)
      : matchingStudentCourse?.semester_end || ensuredCourse?.semesterEnd || null;

    const material = await prisma.material.create({
      data: {
        title: validated.title,
        course_code: courseCode,
        university: validated.university,
        faculty: validated.faculty,
        department: validated.department,
        level: data.level,
        semester,
        semester_start: semesterStart,
        semester_end: semesterEnd,
        academic_year: validated.academicYear || this.getAcademicYear(semesterStart),
        file_type: data.file_type,
        verification_status: VerificationStatus.PENDING,
        processing_status: 'UPLOADED' as any,
        processing_attempts: 0,
        processing_error: null,
        processing_started_at: null,
        processing_completed_at: null,
        next_retry_at: null,
        uploaded_by: userId,
        file_ref: '', // Will be updated after upload or derived
        contributor_ids: [userId],
      },
    });

    const fileKey = `materials/pending/${material.id}.${validated.extension}`;

    // Update material with file_ref
    await prisma.material.update({
      where: { id: material.id },
      data: { file_ref: fileKey }
    });

    const command = new PutObjectCommand({
      Bucket: config.r2BucketName,
      Key: fileKey,
      ContentType: validated.mimeType,
      ContentLength: validated.fileSize,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }).catch((error) => {
      this.mapStorageError(error, 'Material storage is currently unavailable.');
    });

    return {
      materialId: material.id,
      presignedUrl,
    };
  }

  async getDownloadUrl(id: string, access?: { requestingUserId?: string | null; requestingAdminRole?: AdminRole | null }) {
    const material = await this.getMaterial(id, access);

    const command = new GetObjectCommand({
      Bucket: config.r2BucketName,
      Key: material.file_ref,
      ResponseContentDisposition: `attachment; filename="${this.sanitizeFileName(material.title || 'material')}"`,
    });

    return getSignedUrl(s3Client, command, { expiresIn: 900 });
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
        processing_status: 'QUEUED' as any,
        processing_error: null,
        processing_started_at: null,
        processing_completed_at: null,
        next_retry_at: null,
      },
    });

    let processingNotice:
      | {
          status: 'queued' | 'degraded';
          message: string;
        }
      | undefined;

    try {
      // If chunks exist, trigger assembly
      if (material.upload_chunks.length > 0) {
        await queueMaterialIngestion(id, true);
      } else {
        await queueMaterialIngestion(id, false);
      }
      processingNotice = {
        status: 'queued',
        message: 'Upload confirmed and queued for processing.',
      };
    } catch (error) {
      console.error(`Material ${id} upload confirmed, but ingestion failed:`, error);
      await prisma.material.update({
        where: { id },
        data: {
          processing_status: 'FAILED' as any,
          processing_error: error instanceof Error ? error.message : 'Unknown queue error',
        } as any,
      }).catch((updateError) => {
        console.error(`Failed to persist processing failure for material ${id}:`, updateError);
      });
      processingNotice = {
        status: 'degraded',
        message: 'Upload saved, but processing is delayed right now. The material will need a retry when queue health recovers.',
      };
    }

    const result = await this.getMaterial(id, { requestingUserId: userId });
    return processingNotice ? { ...result, processingNotice } : result;
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
    try {
      await systemQueue.add(JOB_NAMES.GENERATE_QUESTIONS, { materialId: id });
      return {
        ...material,
        processingNotice: {
          status: 'queued',
          message: 'Question generation queued successfully.',
        },
      };
    } catch (error) {
      console.error(`Material ${id} verified, but question generation failed:`, error);
      return {
        ...material,
        processingNotice: {
          status: 'degraded',
          message: 'Material verified, but CBT generation is delayed until queue health recovers.',
        },
      };
    }
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
