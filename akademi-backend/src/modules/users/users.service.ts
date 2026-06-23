import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { UpdateAcademicProfileRequest, UpdateProfileRequest } from './users.types';
import { Feature, AccessType } from '@prisma/client';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

export class UsersService {
  private async resolveUserDepartment(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId, is_deleted: false },
      select: {
        university: true,
        faculty: true,
        department: true,
        level: true,
      },
    });

    if (!user?.university || !user.department || !user.level) {
      throw new Error('Complete your academic profile first');
    }

    const university = await prisma.university.findFirst({
      where: { name: user.university },
      select: { id: true, name: true },
    });

    if (!university) {
      throw new Error('University record not found');
    }

    const department = await prisma.department.findFirst({
      where: {
        university_id: university.id,
        name: user.department,
      },
      select: {
        id: true,
        name: true,
        faculty: true,
      },
    });

    if (!department) {
      throw new Error('Department record not found');
    }

    return {
      user,
      university,
      department,
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId, is_deleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        university: true,
        faculty: true,
        department: true,
        level: true,
        profile_photo_url: true,
        created_at: true,
        updated_at: true,
        push_token: true,
        courses: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const admin = await prisma.admin.findUnique({
      where: { email: user.email },
      select: { role: true }
    });

    return { ...user, admin_role: admin?.role || null };
  }

  async updateProfile(userId: string, data: UpdateProfileRequest) {
    return prisma.user.update({
      where: { id: userId, is_deleted: false },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        university: true,
        faculty: true,
        department: true,
        level: true,
        profile_photo_url: true,
        created_at: true,
        updated_at: true,
        push_token: true,
        courses: true,
      },
    });
  }

  async uploadPhoto(userId: string, file: Express.Multer.File) {
    const fileKey = `profile-photos/${userId}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.r2BucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    const photoUrl = `${config.r2PublicUrl}/${fileKey}`;

    await prisma.user.update({
      where: { id: userId },
      data: { profile_photo_url: photoUrl },
    });

    return { photoUrl };
  }

  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profile_photo_url: true },
    });

    if (user?.profile_photo_url) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: config.r2BucketName,
            Key: `profile-photos/${userId}`,
          })
        );
      } catch (error) {
        console.error('Failed to delete photo from R2:', error);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        is_deleted: true,
        profile_photo_url: null,
      },
    });

    await prisma.refreshToken.updateMany({
      where: { user_id: userId },
      data: { is_active: false },
    });
  }

  async getLearningProfile(userId: string) {
    return prisma.learningProfile.findUnique({
      where: { user_id: userId },
    });
  }

  async getAcademicProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId, is_deleted: false },
      select: {
        id: true,
        university: true,
        faculty: true,
        department: true,
        level: true,
        courses: true,
        student_courses: {
          select: {
            id: true,
            code: true,
            name: true,
            level: true,
            semester: true,
            semester_start: true,
            semester_end: true,
            source: true,
          },
          orderBy: [{ level: 'asc' }, { semester: 'asc' }, { code: 'asc' }],
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async getCourseOptions(userId: string) {
    const { department, user } = await this.resolveUserDepartment(userId);

    const [seededCourses, studentCourses] = await Promise.all([
      prisma.course.findMany({
        where: {
          department_id: department.id,
          level: user.level,
        },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.studentCourse.groupBy({
        by: ['code', 'name', 'level', 'semester'],
        where: {
          department_id: department.id,
          level: user.level,
        },
        _count: { code: true },
        orderBy: [{ _count: { code: 'desc' } }, { code: 'asc' }],
        take: 100,
      }),
    ]);

    const merged = new Map<string, any>();

    for (const course of seededCourses) {
      merged.set(`${course.code}-${course.level}-${course.semester}`, {
        id: course.id,
        code: course.code,
        name: course.name,
        level: course.level,
        semester: course.semester,
        source: course.source || 'seeded',
        usageCount: 0,
      });
    }

    for (const course of studentCourses) {
      const key = `${course.code}-${course.level}-${course.semester}`;
      const existing = merged.get(key);
      merged.set(key, {
        id: existing?.id || key,
        code: course.code,
        name: existing?.name || course.name || null,
        level: course.level,
        semester: course.semester,
        source: existing ? 'seeded_and_crowdsourced' : 'crowdsourced',
        usageCount: course._count.code,
      });
    }

    return Array.from(merged.values()).sort((a, b) => {
      if (a.code !== b.code) return a.code.localeCompare(b.code);
      if (a.semester !== b.semester) return a.semester - b.semester;
      return a.level - b.level;
    });
  }

  async updateAcademicProfile(userId: string, data: UpdateAcademicProfileRequest) {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId, is_deleted: false },
      select: { university: true, faculty: true, department: true, level: true },
    });

    if (!currentUser) {
      throw new Error('User not found');
    }

    const universityName = data.university?.trim() || currentUser.university;
    const faculty = data.faculty?.trim() || currentUser.faculty;
    const departmentName = data.department?.trim() || currentUser.department;
    const level = data.level || currentUser.level;
    const courseInputs = (data.courses || [])
      .map((course) => ({
        code: course.code?.trim().toUpperCase(),
        name: course.name?.trim() || null,
        level: course.level || level,
        semester: course.semester,
        semester_start: new Date(course.semester_start),
        semester_end: new Date(course.semester_end),
      }))
      .filter((course) => !!course.code);

    if (!universityName || !faculty || !departmentName || !level) {
      throw new Error('University, faculty, department, and level are required');
    }

    if (courseInputs.length === 0) {
      throw new Error('Add at least one course code');
    }

    for (const course of courseInputs) {
      if (![1, 2].includes(course.semester)) {
        throw new Error('Semester must be 1 or 2');
      }
      if (Number.isNaN(course.semester_start.getTime()) || Number.isNaN(course.semester_end.getTime())) {
        throw new Error('Enter valid semester start and end dates');
      }
      if (course.semester_start >= course.semester_end) {
        throw new Error('Semester end date must be after start date');
      }
    }

    const uniqueCourseInputs = Array.from(
      new Map(courseInputs.map((course) => [`${course.code}-${course.level}-${course.semester}`, course])).values(),
    );

    return prisma.$transaction(async (tx) => {
      const university = await tx.university.upsert({
        where: { name: universityName },
        update: {},
        create: { name: universityName, location: 'Nigeria' },
      });

      const department = await tx.department.upsert({
        where: {
          name_university_id: {
            name: departmentName,
            university_id: university.id,
          },
        },
        update: { faculty },
        create: {
          name: departmentName,
          university_id: university.id,
          faculty,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          university: universityName,
          faculty,
          department: departmentName,
          level,
          courses: uniqueCourseInputs.map((course) => course.code),
        },
      });

      await tx.studentCourse.deleteMany({ where: { user_id: userId } });
      await tx.studentCourse.createMany({
        data: uniqueCourseInputs.map((course) => ({
          user_id: userId,
          department_id: department.id,
          code: course.code,
          name: course.name,
          level: course.level,
          semester: course.semester,
          semester_start: course.semester_start,
          semester_end: course.semester_end,
          source: 'student',
        })),
      });

      return tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          university: true,
          faculty: true,
          department: true,
          level: true,
          courses: true,
          student_courses: {
            select: {
              id: true,
              code: true,
              name: true,
              level: true,
              semester: true,
              semester_start: true,
              semester_end: true,
              source: true,
            },
            orderBy: [{ level: 'asc' }, { semester: 'asc' }, { code: 'asc' }],
          },
        },
      });
    });
  }

  async getSessions(userId: string) {
    return prisma.session.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async getProgress(userId: string) {
    const [user, sessions, uploads, questionAttempts, mockAttempts, examPlans, studentCourses] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId, is_deleted: false },
        select: {
          id: true,
          name: true,
          university: true,
          faculty: true,
          department: true,
          level: true,
          courses: true,
        },
      }),
      prisma.session.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          course_code: true,
          topic: true,
          duration: true,
          created_at: true,
          ended_at: true,
          session_type: true,
          messages: {
            select: { id: true },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.material.findMany({
        where: { uploaded_by: userId },
        select: {
          id: true,
          course_code: true,
          verification_status: true,
          created_at: true,
        },
      }),
      prisma.questionAttempt.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          is_correct: true,
          created_at: true,
          question: {
            select: { course_code: true },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.mockAttempt.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          score: true,
          started_at: true,
          completed_at: true,
          mock_exam: {
            select: {
              plan: {
                select: { course_code: true },
              },
            },
          },
        },
        orderBy: { started_at: 'desc' },
      }),
      prisma.examPrepPlan.findMany({
        where: { user_id: userId },
        select: { id: true, course_code: true, exam_date: true, created_at: true },
      }),
      prisma.studentCourse.findMany({
        where: { user_id: userId },
        select: { code: true, name: true, level: true, semester: true },
        orderBy: [{ level: 'asc' }, { semester: 'asc' }, { code: 'asc' }],
      }),
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - diffToMonday);

    const activityDates = [
      ...sessions.map((session) => session.created_at),
      ...questionAttempts.map((attempt) => attempt.created_at),
      ...mockAttempts.map((attempt) => attempt.completed_at || attempt.started_at),
      ...uploads.map((upload) => upload.created_at),
    ];

    const dayKeys = new Set(activityDates.map((date) => this.toDayKey(date)));
    const weeklyActivity = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const dateKey = this.toDayKey(date);

      return {
        day: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][index],
        date: dateKey,
        sessions: sessions.filter((session) => this.toDayKey(session.created_at) === dateKey).length,
        solved: questionAttempts.filter((attempt) => this.toDayKey(attempt.created_at) === dateKey).length,
        mocks: mockAttempts.filter((attempt) => this.toDayKey(attempt.completed_at || attempt.started_at) === dateKey).length,
        uploads: uploads.filter((upload) => this.toDayKey(upload.created_at) === dateKey).length,
      };
    });

    const courseMap = new Map<string, {
      code: string;
      name?: string | null;
      sessions: number;
      solved: number;
      correct: number;
      mocks: number;
      uploads: number;
      averageMockScore: number | null;
    }>();

    const ensureCourse = (code?: string | null) => {
      const safeCode = code?.trim() || 'General';
      if (!courseMap.has(safeCode)) {
        const registered = studentCourses.find((course) => course.code.toLowerCase() === safeCode.toLowerCase());
        courseMap.set(safeCode, {
          code: safeCode,
          name: registered?.name,
          sessions: 0,
          solved: 0,
          correct: 0,
          mocks: 0,
          uploads: 0,
          averageMockScore: null,
        });
      }
      return courseMap.get(safeCode)!;
    };

    for (const course of studentCourses) ensureCourse(course.code);
    for (const session of sessions) ensureCourse(session.course_code).sessions += 1;
    for (const attempt of questionAttempts) {
      const course = ensureCourse(attempt.question.course_code);
      course.solved += 1;
      if (attempt.is_correct) course.correct += 1;
    }
    for (const upload of uploads) ensureCourse(upload.course_code).uploads += 1;

    const mockScores = new Map<string, number[]>();
    for (const attempt of mockAttempts) {
      const code = attempt.mock_exam.plan.course_code || 'General';
      ensureCourse(code).mocks += 1;
      const scores = mockScores.get(code) || [];
      scores.push(attempt.score);
      mockScores.set(code, scores);
    }

    for (const [code, scores] of mockScores.entries()) {
      ensureCourse(code).averageMockScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    }

    const correctAnswers = questionAttempts.filter((attempt) => attempt.is_correct).length;
    const solvedCount = questionAttempts.length;
    const completedMocks = mockAttempts.filter((attempt) => attempt.completed_at).length;
    const activeDays = dayKeys.size;

    return {
      user,
      summary: {
        sessions: sessions.length,
        solved: solvedCount,
        correct: correctAnswers,
        accuracy: solvedCount ? Math.round((correctAnswers / solvedCount) * 100) : 0,
        uploads: uploads.length,
        approvedUploads: uploads.filter((upload) => upload.verification_status === 'VERIFIED').length,
        examPlans: examPlans.length,
        mockAttempts: mockAttempts.length,
        completedMocks,
        activeDays,
        streak: this.calculateStreak(dayKeys),
      },
      weeklyActivity,
      courses: Array.from(courseMap.values()).sort((a, b) => {
        const aActivity = a.sessions + a.solved + a.mocks + a.uploads;
        const bActivity = b.sessions + b.solved + b.mocks + b.uploads;
        return bActivity - aActivity || a.code.localeCompare(b.code);
      }),
      recent: {
        sessions: sessions.slice(0, 3).map((session) => ({
          id: session.id,
          courseCode: session.course_code,
          topic: session.topic,
          duration: session.duration,
          messageCount: session.messages.length,
          createdAt: session.created_at,
        })),
        mocks: mockAttempts.slice(0, 3).map((attempt) => ({
          id: attempt.id,
          courseCode: attempt.mock_exam.plan.course_code,
          score: attempt.score,
          completedAt: attempt.completed_at,
        })),
      },
      insight: this.buildProgressInsight({
        sessions: sessions.length,
        solved: solvedCount,
        accuracy: solvedCount ? Math.round((correctAnswers / solvedCount) * 100) : 0,
        streak: this.calculateStreak(dayKeys),
        uploads: uploads.length,
        mockAttempts: mockAttempts.length,
      }),
    };
  }

  async getDevices(userId: string) {
    return prisma.refreshToken.findMany({
      where: { user_id: userId, is_active: true },
      select: {
        id: true,
        device_name: true,
        device_type: true,
        created_at: true,
      },
    });
  }

  async logoutDevice(userId: string, deviceId: string) {
    const result = await prisma.refreshToken.updateMany({
      where: { id: deviceId, user_id: userId },
      data: { is_active: false },
    });

    if (result.count === 0) {
      throw new Error('Device not found or already logged out');
    }
  }

  async getFeatureAccess(userId: string) {
    if (config.unlockAllFeatures) {
      return Object.values(Feature).map((feature) => ({
        id: 'bypassed',
        user_id: userId,
        feature,
        access_type: AccessType.TIME_WINDOW,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        uses_remaining: null,
        purchased_at: new Date(),
        payment_ref: 'BYPASS',
      }));
    }

    return prisma.featureAccess.findMany({
      where: { user_id: userId },
    });
  }

  async getUploads(userId: string) {
    return prisma.material.findMany({
      where: { uploaded_by: userId },
    });
  }

  private toDayKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private calculateStreak(dayKeys: Set<string>) {
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (dayKeys.has(this.toDayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    if (streak > 0) return streak;

    cursor.setDate(cursor.getDate() - 1);
    while (dayKeys.has(this.toDayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }

  private buildProgressInsight(input: { sessions: number; solved: number; accuracy: number; streak: number; uploads: number; mockAttempts: number }) {
    if (input.streak >= 3) {
      return `You are on a ${input.streak}-day streak. Keep one small study action today so the chain stays alive.`;
    }

    if (input.solved >= 5 && input.accuracy < 60) {
      return `You have attempted ${input.solved} questions. Accuracy is ${input.accuracy}%, so review weak answers before starting another mock.`;
    }

    if (input.mockAttempts > 0) {
      return 'Your mock exam history is now part of progress. Revisit weak areas after each attempt to raise your next score.';
    }

    if (input.sessions > 0) {
      return 'Your study sessions are being tracked. Add a mock or CBT attempt next so Akademi can spot stronger weak areas.';
    }

    if (input.uploads > 0) {
      return 'Your uploads are saved. Open one material, study it, then practice CBT to start building measurable progress.';
    }

    return 'Start with one material, one assignment solve, or one mock exam. Your progress screen will fill up as you work.';
  }
}
