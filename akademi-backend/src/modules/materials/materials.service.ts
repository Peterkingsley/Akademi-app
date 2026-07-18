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
import { stripQuestionAnswers } from '../../shared/utils/sanitize-question';
import { upsertDepartment, findOrCreateCourse } from '../../shared/utils/department-resolver';

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

  private sanitizeConstraintStringList(value: unknown, limit = 12) {
    return Array.isArray(value)
      ? value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, limit)
      : [];
  }

  private sanitizeConstraintTerminology(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [String(key || '').trim(), String(item || '').trim()] as const)
        .filter(([key, item]) => key && item)
        .slice(0, 12),
    );
  }

  private normalizeConstraintStrictness(value: unknown) {
    const normalized = String(value || 'medium').trim().toLowerCase();
    return ['low', 'medium', 'high'].includes(normalized) ? normalized : 'medium';
  }

  private async ensureCanManageMaterialTeachingConstraints(materialId: string, requester: { userId: string; email?: string | null }) {
    const adminRole = await this.getAdminRoleByEmail(requester.email);
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: {
        id: true,
        title: true,
        uploaded_by: true,
        course_code: true,
        university: true,
        faculty: true,
        department: true,
        level: true,
        semester: true,
      },
    });

    if (!material) {
      throw new Error('Material not found');
    }

    const isOwner = material.uploaded_by === requester.userId;
    if (!isOwner && !adminRole) {
      throw new Error('You are not allowed to manage teaching constraints for this material.');
    }

    return { material, adminRole, isOwner };
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

    const department = await upsertDepartment({
      universityName: payload.university,
      departmentName: payload.department,
      faculty: payload.faculty,
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

    const course = await findOrCreateCourse({
      departmentId: department.id,
      code: payload.courseCode,
      level: payload.level,
      semester,
      name: payload.courseCode,
      source: 'student_upload',
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

    return { departmentId: department.id, courseId: course.id, semester, semesterStart, semesterEnd };
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

  async auditMaterialIntelligenceReadiness(
    requester: { userId: string; email?: string | null },
    options?: {
      limit?: number;
      courseCode?: string;
      department?: string;
      status?: string;
      missingOnly?: boolean;
    },
  ) {
    const adminRole = await this.getAdminRoleByEmail(requester.email);
    if (!adminRole) {
      throw new Error('Only admins can audit material intelligence readiness.');
    }

    const limit = Math.min(Math.max(Number(options?.limit) || 50, 1), 200);
    const status = String(options?.status || '').trim().toUpperCase();

    const materials = await prisma.material.findMany({
      where: {
        ...(options?.courseCode ? { course_code: options.courseCode } : {}),
        ...(options?.department ? { department: options.department } : {}),
        ...(status ? { processing_status: status as any } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        course_code: true,
        department: true,
        level: true,
        file_type: true,
        processing_status: true as any,
        content: true,
        reader_structure: true,
        teacher_brain: {
          select: {
            generated_at: true,
            subject_family: true,
          },
        },
        _count: {
          select: {
            embeddings: true,
          },
        },
      },
    });

    const audited = materials.map((material) => {
      const contentText = String(material.content || '');
      const pages = Array.isArray((material.reader_structure as { pages?: unknown[] } | null)?.pages)
        ? ((material.reader_structure as { pages: unknown[] }).pages)
        : [];
      const hasContent = contentText.trim().length > 0;
      const hasReaderStructure = pages.length > 0;
      const embeddingCount = material._count.embeddings;
      const hasTeacherBrain = Boolean(material.teacher_brain);
      const hasExtractedStatus = material.processing_status === 'EXTRACTED';
      const missingArtifacts = [
        ...(hasContent ? [] : ['content']),
        ...(hasReaderStructure ? [] : ['reader_structure']),
        ...(embeddingCount > 0 ? [] : ['embeddings']),
        ...(hasTeacherBrain ? [] : ['teacher_brain']),
        ...(hasExtractedStatus ? [] : ['extracted_status']),
      ];

      const readinessStatus = material.processing_status === 'FAILED'
        ? 'FAILED_PROCESSING'
        : missingArtifacts.length === 0
          ? 'READY'
          : 'INCOMPLETE';

      return {
        id: material.id,
        title: material.title,
        course_code: material.course_code,
        department: material.department,
        level: material.level,
        file_type: material.file_type,
        processing_status: material.processing_status,
        hasContent,
        contentLength: contentText.length,
        hasReaderStructure,
        readerPageCount: pages.length,
        embeddingCount,
        hasTeacherBrain,
        teacherBrainGeneratedAt: material.teacher_brain?.generated_at || null,
        teacherBrainSubjectFamily: material.teacher_brain?.subject_family || null,
        readinessStatus,
        missingArtifacts,
      };
    }).filter((material) => {
      if (options?.missingOnly !== true) return true;
      return material.readinessStatus !== 'READY';
    });

    return {
      totalChecked: audited.length,
      readyCount: audited.filter((material) => material.readinessStatus === 'READY').length,
      incompleteCount: audited.filter((material) => material.readinessStatus !== 'READY').length,
      materials: audited,
    };
  }

  async listTeachingConstraints(
    materialId: string,
    requester: { userId: string; email?: string | null },
  ) {
    await this.ensureCanManageMaterialTeachingConstraints(materialId, requester);
    const constraints = await (prisma as typeof prisma & {
      lecturerTeachingConstraint: {
        findMany: (query: unknown) => Promise<unknown[]>;
      };
    }).lecturerTeachingConstraint.findMany({
      where: {
        material_id: materialId,
        is_active: true,
      },
      orderBy: [{ updated_at: 'desc' }],
    });
    return { materialId, constraints };
  }

  async createTeachingConstraint(
    materialId: string,
    requester: { userId: string; email?: string | null },
    input: Record<string, unknown>,
  ) {
    const { material } = await this.ensureCanManageMaterialTeachingConstraints(materialId, requester);
    const title = String(input.title || '').trim();
    if (!title) {
      throw new Error('Constraint title is required.');
    }

    const created = await (prisma as typeof prisma & {
      lecturerTeachingConstraint: {
        create: (query: unknown) => Promise<unknown>;
      };
    }).lecturerTeachingConstraint.create({
      data: {
        material_id: materialId,
        course_code: material.course_code,
        university: material.university,
        faculty: material.faculty,
        department: material.department,
        level: material.level,
        semester: material.semester,
        created_by: requester.userId,
        title,
        description: input.description ? String(input.description).trim() : null,
        required_order: this.sanitizeConstraintStringList(input.required_order),
        must_cover_topics: this.sanitizeConstraintStringList(input.must_cover_topics),
        do_not_skip_topics: this.sanitizeConstraintStringList(input.do_not_skip_topics),
        preferred_terminology: this.sanitizeConstraintTerminology(input.preferred_terminology),
        required_methods: this.sanitizeConstraintStringList(input.required_methods),
        forbidden_methods: this.sanitizeConstraintStringList(input.forbidden_methods),
        assessment_focus: this.sanitizeConstraintStringList(input.assessment_focus),
        unit_policy: input.unit_policy ? String(input.unit_policy).trim() : null,
        proof_policy: input.proof_policy ? String(input.proof_policy).trim() : null,
        calculation_policy: input.calculation_policy ? String(input.calculation_policy).trim() : null,
        diagram_policy: input.diagram_policy ? String(input.diagram_policy).trim() : null,
        strictness: this.normalizeConstraintStrictness(input.strictness),
        is_active: true,
      },
    });

    console.log('lecturer_constraint_created', {
      materialId,
      createdBy: requester.userId,
      title,
    });
    return created;
  }

  async updateTeachingConstraint(
    materialId: string,
    constraintId: string,
    requester: { userId: string; email?: string | null },
    input: Record<string, unknown>,
  ) {
    await this.ensureCanManageMaterialTeachingConstraints(materialId, requester);
    const existing = await (prisma as typeof prisma & {
      lecturerTeachingConstraint: {
        findFirst: (query: unknown) => Promise<{ id: string; material_id: string | null } | null>;
        update: (query: unknown) => Promise<unknown>;
      };
    }).lecturerTeachingConstraint.findFirst({
      where: { id: constraintId, material_id: materialId, is_active: true },
      select: { id: true, material_id: true },
    });

    if (!existing) {
      throw new Error('Teaching constraint not found.');
    }

    const updated = await (prisma as typeof prisma & {
      lecturerTeachingConstraint: {
        update: (query: unknown) => Promise<unknown>;
      };
    }).lecturerTeachingConstraint.update({
      where: { id: constraintId },
      data: {
        title: input.title !== undefined ? String(input.title || '').trim() : undefined,
        description: input.description !== undefined ? (input.description ? String(input.description).trim() : null) : undefined,
        required_order: input.required_order !== undefined ? this.sanitizeConstraintStringList(input.required_order) : undefined,
        must_cover_topics: input.must_cover_topics !== undefined ? this.sanitizeConstraintStringList(input.must_cover_topics) : undefined,
        do_not_skip_topics: input.do_not_skip_topics !== undefined ? this.sanitizeConstraintStringList(input.do_not_skip_topics) : undefined,
        preferred_terminology: input.preferred_terminology !== undefined ? this.sanitizeConstraintTerminology(input.preferred_terminology) : undefined,
        required_methods: input.required_methods !== undefined ? this.sanitizeConstraintStringList(input.required_methods) : undefined,
        forbidden_methods: input.forbidden_methods !== undefined ? this.sanitizeConstraintStringList(input.forbidden_methods) : undefined,
        assessment_focus: input.assessment_focus !== undefined ? this.sanitizeConstraintStringList(input.assessment_focus) : undefined,
        unit_policy: input.unit_policy !== undefined ? (input.unit_policy ? String(input.unit_policy).trim() : null) : undefined,
        proof_policy: input.proof_policy !== undefined ? (input.proof_policy ? String(input.proof_policy).trim() : null) : undefined,
        calculation_policy: input.calculation_policy !== undefined ? (input.calculation_policy ? String(input.calculation_policy).trim() : null) : undefined,
        diagram_policy: input.diagram_policy !== undefined ? (input.diagram_policy ? String(input.diagram_policy).trim() : null) : undefined,
        strictness: input.strictness !== undefined ? this.normalizeConstraintStrictness(input.strictness) : undefined,
      },
    });

    console.log('lecturer_constraint_updated', {
      materialId,
      constraintId,
      updatedBy: requester.userId,
    });
    return updated;
  }

  async disableTeachingConstraint(
    materialId: string,
    constraintId: string,
    requester: { userId: string; email?: string | null },
  ) {
    await this.ensureCanManageMaterialTeachingConstraints(materialId, requester);
    const existing = await (prisma as typeof prisma & {
      lecturerTeachingConstraint: {
        findFirst: (query: unknown) => Promise<{ id: string } | null>;
        update: (query: unknown) => Promise<unknown>;
      };
    }).lecturerTeachingConstraint.findFirst({
      where: { id: constraintId, material_id: materialId, is_active: true },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Teaching constraint not found.');
    }

    const disabled = await (prisma as typeof prisma & {
      lecturerTeachingConstraint: {
        update: (query: unknown) => Promise<unknown>;
      };
    }).lecturerTeachingConstraint.update({
      where: { id: constraintId },
      data: { is_active: false },
    });

    console.log('lecturer_constraint_disabled', {
      materialId,
      constraintId,
      disabledBy: requester.userId,
    });
    return disabled;
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
        course_id: ensuredCourse?.courseId ?? null,
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

  async getQuestions(id: string, userId: string, limit?: number, pageStart?: number, pageEnd?: number) {
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

    if ((pageStart == null) !== (pageEnd == null)) {
      throw new Error('Invalid page range: both pageStart and pageEnd must be provided together.');
    }

    if (pageStart != null && pageEnd != null) {
      if (!Number.isInteger(pageStart) || !Number.isInteger(pageEnd) || pageStart > pageEnd) {
        throw new Error('Invalid page range: pageStart must be a whole number less than or equal to pageEnd.');
      }

      const totalPages = Array.isArray((material.reader_structure as any)?.pages)
        ? ((material.reader_structure as any).pages as unknown[]).length
        : 0;

      if (pageStart < 1 || (totalPages > 0 && pageEnd > totalPages)) {
        throw new Error(`Invalid page range: pages must fall within 1-${totalPages || pageEnd}.`);
      }
    }

    const take = Math.min(Math.max(Number(limit) || 10, 5), 50);
    const hasPageRange = pageStart != null && pageEnd != null;

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
          ...(hasPageRange
            ? {
                source_page_start: { lte: pageEnd },
                source_page_end: { gte: pageStart },
              }
            : {}),
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
          ...(hasPageRange ? { pageStart, pageEnd } : {}),
        });
      } catch (error) {
        console.error(`Failed to generate additional CBT questions for material ${id}:`, error);
      }

      availableQuestions = await loadAvailableQuestions();
    }

    if (availableQuestions.length === 0) {
      throw new Error(
        hasPageRange
          ? `No CBT questions are available for pages ${pageStart}-${pageEnd} yet.`
          : 'No CBT questions are available for this material yet.',
      );
    }

    // Never return the answer key before the student attempts the question.
    return stripQuestionAnswers(this.shuffleQuestions(availableQuestions).slice(0, take));
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
