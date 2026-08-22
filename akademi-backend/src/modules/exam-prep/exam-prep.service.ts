import prisma from '../../config/db';
import {
  Difficulty,
  Feature,
  Prisma,
  SessionType,
  VerificationStatus,
  UsageMetric,
} from '@prisma/client';
import { orchestrateAIResponse } from '../../shared/utils/ai-orchestrator';
import { generateQuestionsJob } from '../../jobs/generateQuestions.job';
import { resolveDepartmentId, findOrCreateCourse } from '../../shared/utils/department-resolver';
import { UsersService } from '../users/users.service';
import { usageService } from '../usage/usage.service';
import { checkFeatureAccess } from '../../shared/utils/feature-access';
import { MaterialsService } from '../materials/materials.service';
import { ExamPrepFeedbackService, buildFallbackFeedback } from './exam-prep-feedback.service';
import {
  ExamPrepError,
  ExamPrepMaterialItem,
  ExamPrepSessionSummary,
  ExamPrepTeachingFeedback,
  FeedbackGenerationInput,
  GUIDED_EXAM_PREP_MODE,
  GUIDED_EXAM_PREP_QUESTION_COUNT,
  GUIDED_EXAM_PREP_VERSION,
  GuidedExamPrepProgress,
  GuidedExamPrepQuestion,
  GuidedExamPrepSession,
  GuidedSessionMetadata,
} from './exam-prep.types';

export function normalizeExamPrepAnswer(answer: string) {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

const normalizeAnswer = normalizeExamPrepAnswer;

export function resolveCanonicalAnswer(optionsValue: unknown, storedAnswer: string | null | undefined) {
  const options = Array.isArray(optionsValue)
    ? optionsValue.map((option) => String(option).trim()).filter(Boolean)
    : [];
  const answer = String(storedAnswer || '').trim();
  if (!answer || options.length === 0) return null;

  const exact = options.find((option) => normalizeExamPrepAnswer(option) === normalizeExamPrepAnswer(answer));
  if (exact) return exact;

  // Legacy questions stored A/B/C/D, while current generation stores the full option text.
  const labelMatch = answer.match(/^\s*([A-D])(?:[.)\]:-])?\s*$/i);
  if (labelMatch) {
    return options[labelMatch[1].toUpperCase().charCodeAt(0) - 65] || null;
  }

  return null;
}

export function sanitizeGuidedExamPrepQuestion(question: {
  id: string;
  question_text: string;
  options: Prisma.JsonValue;
  difficulty: Difficulty;
  question_type: GuidedExamPrepQuestion['questionType'];
}): GuidedExamPrepQuestion {
  return {
    id: question.id,
    text: question.question_text,
    options: Array.isArray(question.options) ? question.options.map(String) : [],
    difficulty: question.difficulty,
    questionType: question.question_type,
  };
}

function toAnswerMap(answers: { questionId: string; answer: string }[] | Record<string, string>) {
  if (Array.isArray(answers)) {
    return answers.reduce<Record<string, string>>((acc, item) => {
      if (item.questionId) acc[item.questionId] = item.answer;
      return acc;
    }, {});
  }
  return answers || {};
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

const DIFFICULTY_WEIGHTS = { [Difficulty.EASY]: 1, [Difficulty.MEDIUM]: 2, [Difficulty.HARD]: 3 };

export class ExamPrepService {
  private usersService = new UsersService();
  private materialsService = new MaterialsService();

  constructor(private readonly feedbackService = new ExamPrepFeedbackService()) {}

  private normalizeAssessmentType(value?: string | null) {
    return value?.toUpperCase() === 'TEST' ? 'TEST' : 'EXAM';
  }

  private getAssessmentLabel(value?: string | null) {
    return this.normalizeAssessmentType(value) === 'TEST' ? 'Test' : 'Exam';
  }

  private getDaysLeft(examDate: Date | null) {
    if (!examDate) return null;
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / msPerDay));
  }

  private getReadinessGrade(score: number) {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'Needs work';
  }

  /**
   * Difficulty-weighted correctness % across a user's full QuestionAttempt history for a course.
   * This is the single source of truth for "Mastery Level" (hub cards, plan progress, and the
   * Mock Exam unlock gate) - no more fake task-completion ratios.
   */
  async getMasteryLevel(userId: string, courseRef: { courseId?: string | null; courseCode?: string | null }) {
    const orConditions: any[] = [];
    if (courseRef.courseCode) orConditions.push({ course_code: courseRef.courseCode });
    if (courseRef.courseId) orConditions.push({ course_id: courseRef.courseId });
    if (orConditions.length === 0) return 0;

    const attempts = await prisma.questionAttempt.findMany({
      where: { user_id: userId, question: { OR: orConditions } },
      include: { question: { select: { difficulty: true } } },
    });

    if (attempts.length === 0) return 0;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    attempts.forEach((a) => {
      const weight = DIFFICULTY_WEIGHTS[a.question.difficulty];
      totalWeight += weight;
      if (a.is_correct) {
        totalWeightedScore += weight;
      }
    });

    return Math.round((totalWeightedScore / totalWeight) * 100);
  }

  private async formatPlan(plan: any) {
    const masteryLevel = await this.getMasteryLevel(plan.user_id, {
      courseId: plan.course_id,
      courseCode: plan.course_code,
    });

    return {
      ...plan,
      assessment_type: this.normalizeAssessmentType(plan.assessment_type),
      assessment_label: this.getAssessmentLabel(plan.assessment_type),
      course_name: plan.course_code,
      subject: plan.course_code,
      exam_date: plan.exam_date,
      days_left: this.getDaysLeft(plan.exam_date),
      duration_minutes: plan.duration_minutes,
      objective_question_count: plan.objective_question_count,
      theory_question_count: plan.theory_question_count,
      progress: masteryLevel,
      readiness_score: masteryLevel,
      readinessScore: masteryLevel,
      readiness_grade: this.getReadinessGrade(masteryLevel),
      readinessGrade: this.getReadinessGrade(masteryLevel),
    };
  }

  private formatMockExam(exam: any) {
    return {
      ...exam,
      durationMinutes: exam.plan?.duration_minutes || Math.max(10, (exam.questions?.length || 1) * 2),
      questions: (exam.questions || []).map((question: any) => ({
        id: question.id,
        text: question.question_text,
        title: question.question_text,
        formula: undefined,
        responseType: Array.isArray(question.options) && question.options.length > 0 ? 'OBJECTIVE' : 'THEORY',
        options: Array.isArray(question.options) && question.options.length > 0
          ? question.options
          : [],
        difficulty: question.difficulty,
      })),
    };
  }

  private formatMockAttempt(attempt: any) {
    const completedAt = attempt.completed_at || attempt.started_at;
    return {
      id: attempt.id,
      mockExamId: attempt.mock_exam_id,
      mock_exam_id: attempt.mock_exam_id,
      title: attempt.mock_exam?.title || 'Mock Exam',
      score: Math.round(attempt.score),
      aggregate: `${Math.round(attempt.score)}%`,
      feedback: attempt.feedback,
      completedAt,
      completed_at: completedAt,
      questionCount: attempt.mock_exam?.questions?.length || 0,
      question_count: attempt.mock_exam?.questions?.length || 0,
    };
  }

  /**
   * Resolves (best-effort, never throws) the Course catalog row id for a user's academic
   * profile + a given course code, so plans can be linked via a real FK where possible.
   */
  private async resolveCourseId(userId: string, normalizedCourseCode: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { university: true, department: true, level: true },
    });

    if (!user?.university || !user.department || !user.level) return null;

    const departmentId = await resolveDepartmentId(user.university, user.department);
    if (!departmentId) return null;

    const course = await findOrCreateCourse({
      departmentId,
      code: normalizedCourseCode,
      level: user.level,
    });

    return course.id;
  }

  /**
   * Get-or-create a plan for this user+course. Plans are now a lightweight per-course settings
   * record (exam date, duration, question mix) rather than a mandatory gate before Study Now /
   * Mock Exam are usable - the hub lists courses directly from the user's academic profile.
   */
  async getOrCreatePlanForCourse(userId: string, courseCode: string) {
    const normalizedCourseCode = courseCode?.trim().toUpperCase();
    if (!normalizedCourseCode) {
      throw new Error('Select a course before creating a prep plan');
    }

    const existing = await prisma.examPrepPlan.findFirst({
      where: { user_id: userId, course_code: normalizedCourseCode },
    });
    if (existing) return existing;

    const courseId = await this.resolveCourseId(userId, normalizedCourseCode);

    try {
      return await prisma.examPrepPlan.create({
        data: {
          user_id: userId,
          course_code: normalizedCourseCode,
          course_id: courseId,
          assessment_type: 'EXAM',
          exam_date: null,
          duration_minutes: 120,
          objective_question_count: 40,
          theory_question_count: 5,
        },
      });
    } catch (error: any) {
      // Concurrent get-or-create race: another request created it first, fetch and return that one.
      if (error.code === 'P2002') {
        const raceWinner = await prisma.examPrepPlan.findFirst({
          where: { user_id: userId, course_code: normalizedCourseCode },
        });
        if (raceWinner) return raceWinner;
      }
      throw error;
    }
  }

  /**
   * Creates or updates a course's prep settings (exam date, duration, question mix). Replaces
   * the old mandatory "create a plan first" flow - AddExamScreen now calls this to customize an
   * auto-provisioned plan rather than gating Study Now / Mock Exam behind it.
   */
  async upsertPlanSettings(
    userId: string,
    courseCode: string,
    examDate?: string | null,
    assessmentType = 'EXAM',
    durationMinutes?: number,
    objectiveQuestionCount?: number,
    theoryQuestionCount?: number,
  ) {
    const plan = await this.getOrCreatePlanForCourse(userId, courseCode);

    const normalizedAssessmentType = this.normalizeAssessmentType(assessmentType);
    const normalizedDurationMinutes = Math.min(Math.max(Number(durationMinutes) || plan.duration_minutes || 120, 15), 360);
    const normalizedObjectiveQuestionCount = Math.min(Math.max(Number(objectiveQuestionCount) || plan.objective_question_count || 40, 5), 100);
    const normalizedTheoryQuestionCount = Math.min(Math.max(Number(theoryQuestionCount) || plan.theory_question_count || 5, 0), 20);

    const updated = await prisma.examPrepPlan.update({
      where: { id: plan.id },
      data: {
        exam_date: examDate ? new Date(examDate) : plan.exam_date,
        assessment_type: normalizedAssessmentType,
        duration_minutes: normalizedDurationMinutes,
        objective_question_count: normalizedObjectiveQuestionCount,
        theory_question_count: normalizedTheoryQuestionCount,
      },
    });

    return this.getPlan(userId, updated.id);
  }

  /**
   * The Exam Prep hub: lists every course the user is currently offering (from their academic
   * profile, not from pre-existing plans) with a real Mastery Level and any existing plan's
   * exam-date/countdown, computed in one batched pass (no N+1 per course).
   */
  async listCourseHub(userId: string) {
    const courseOptions = await this.usersService.getCourseOptions(userId);
    if (courseOptions.length === 0) return [];

    const uniqueByCode = new Map<string, { code: string; name?: string | null }>();
    for (const course of courseOptions) {
      const key = course.code.toUpperCase();
      if (!uniqueByCode.has(key)) {
        uniqueByCode.set(key, { code: course.code, name: course.name });
      }
    }
    const courseCodes = [...uniqueByCode.keys()];

    const [attempts, plans] = await Promise.all([
      prisma.questionAttempt.findMany({
        where: { user_id: userId, question: { course_code: { in: courseCodes } } },
        select: { is_correct: true, question: { select: { course_code: true, difficulty: true } } },
      }),
      prisma.examPrepPlan.findMany({
        where: { user_id: userId, course_code: { in: courseCodes } },
      }),
    ]);

    const byCourse = new Map<string, { weighted: number; total: number }>();
    for (const attempt of attempts) {
      const code = attempt.question.course_code?.toUpperCase();
      if (!code) continue;
      const weight = DIFFICULTY_WEIGHTS[attempt.question.difficulty];
      const entry = byCourse.get(code) || { weighted: 0, total: 0 };
      entry.total += weight;
      if (attempt.is_correct) entry.weighted += weight;
      byCourse.set(code, entry);
    }

    const planByCourse = new Map(plans.map((plan) => [plan.course_code!.toUpperCase(), plan]));

    return courseCodes.map((code) => {
      const entry = byCourse.get(code);
      const masteryLevel = entry && entry.total > 0 ? Math.round((entry.weighted / entry.total) * 100) : 0;
      const plan = planByCourse.get(code);
      const examDate = plan?.exam_date || null;

      return {
        course_code: code,
        course_name: uniqueByCode.get(code)?.name || code,
        mastery_level: masteryLevel,
        readiness_grade: this.getReadinessGrade(masteryLevel),
        assessment_label: plan ? this.getAssessmentLabel(plan.assessment_type) : 'Exam',
        exam_date: examDate,
        days_left: this.getDaysLeft(examDate),
        plan_id: plan?.id || null,
      };
    });
  }

  async getAllPlans(userId: string) {
    const plans = await prisma.examPrepPlan.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' },
    });
    return Promise.all(plans.map((plan) => this.formatPlan(plan)));
  }

  async getPlan(userId: string, planId: string) {
    const plan = await prisma.examPrepPlan.findFirst({
      where: { id: planId, user_id: userId },
    });
    if (!plan) throw new Error('Plan not found');
    return this.formatPlan(plan);
  }

  async getMockHistory(userId: string, planId: string) {
    const plan = await prisma.examPrepPlan.findFirst({
      where: { id: planId, user_id: userId },
    });
    if (!plan) throw new Error('Plan not found');

    const attempts = await prisma.mockAttempt.findMany({
      where: {
        user_id: userId,
        mock_exam: { plan_id: planId },
        completed_at: { not: null },
      },
      orderBy: { completed_at: 'desc' },
      include: {
        mock_exam: {
          include: { questions: true },
        },
      },
    });

    return attempts.map((attempt) => this.formatMockAttempt(attempt));
  }

  async getReadinessScore(userId: string, planId: string) {
    const plan = await prisma.examPrepPlan.findFirst({ where: { id: planId, user_id: userId } });
    if (!plan) throw new Error('Plan not found');
    return this.getMasteryLevel(userId, { courseId: plan.course_id, courseCode: plan.course_code });
  }

  /**
   * Course-wide question pool for a mock exam: unions questions across every verified material
   * under the plan's course, permanently excludes any question the user has ever attempted
   * (regardless of which past mock/session it came from), and tops up generation for whichever
   * sub-pool (objective/theory) is short, before splitting to the plan's configured counts.
   */
  private async getEligibleCourseQuestions(
    userId: string,
    plan: { course_id: string | null; course_code: string | null; objective_question_count: number; theory_question_count: number },
  ) {
    const materialWhere = plan.course_id
      ? { course_id: plan.course_id, verification_status: VerificationStatus.VERIFIED }
      : { course_code: plan.course_code, verification_status: VerificationStatus.VERIFIED };

    const materials = await prisma.material.findMany({ where: materialWhere, select: { id: true } });
    const materialIds = materials.map((m) => m.id);
    if (materialIds.length === 0) return [];

    const attemptedIds = await prisma.questionAttempt.findMany({
      where: { user_id: userId, question: { material_id: { in: materialIds } } },
      select: { question_id: true },
      distinct: ['question_id'],
    });
    const excludeSet = new Set(attemptedIds.map((a) => a.question_id));

    const loadPool = () =>
      prisma.question.findMany({
        where: { material_id: { in: materialIds }, id: { notIn: [...excludeSet] } },
        select: {
          id: true,
          material_id: true,
          question_text: true,
          options: true,
          correct_answer: true,
          explanation: true,
          approach_guide: true,
          difficulty: true,
        },
      });

    const splitPool = (items: Awaited<ReturnType<typeof loadPool>>) => ({
      objective: items.filter((q) => Array.isArray(q.options) && q.options.length > 0 && !!q.correct_answer),
      theory: items.filter((q) => !Array.isArray(q.options) || q.options.length === 0 || !q.correct_answer),
    });

    let pool = await loadPool();
    let { objective, theory } = splitPool(pool);

    const targetObjective = plan.objective_question_count || 40;
    const targetTheory = plan.theory_question_count || 5;
    const objectiveShortfall = Math.max(targetObjective - objective.length, 0);
    const theoryShortfall = Math.max(targetTheory - theory.length, 0);

    if (objectiveShortfall > 0 || theoryShortfall > 0) {
      const remainingByMaterial = new Map<string, number>();
      for (const id of materialIds) remainingByMaterial.set(id, 0);
      for (const q of pool) remainingByMaterial.set(q.material_id, (remainingByMaterial.get(q.material_id) || 0) + 1);
      const materialsNeedingMore = [...remainingByMaterial.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([materialId]) => materialId);

      let stillNeeded = objectiveShortfall + theoryShortfall;
      for (const materialId of materialsNeedingMore) {
        if (stillNeeded <= 0) break;
        try {
          const existingTexts = await prisma.question.findMany({
            where: { material_id: materialId },
            select: { question_text: true },
          });
          const generationTarget = Math.max(Math.ceil(stillNeeded / materialsNeedingMore.length) + 5, 10);
          const createdCount = await generateQuestionsJob(materialId, {
            count: generationTarget,
            excludeQuestionTexts: existingTexts.map((q) => q.question_text),
          });
          stillNeeded -= createdCount;
        } catch (error) {
          console.error(`Failed to top up course-wide questions for material ${materialId}:`, error);
        }
      }

      pool = await loadPool();
      ({ objective, theory } = splitPool(pool));
    }

    return [...shuffle(objective).slice(0, targetObjective), ...shuffle(theory).slice(0, targetTheory)];
  }

  async startMockExam(userId: string, planId: string) {
    const plan = await prisma.examPrepPlan.findUnique({ where: { id: planId } });
    if (!plan || plan.user_id !== userId) throw new Error('Plan not found');

    const masteryLevel = await this.getMasteryLevel(userId, { courseId: plan.course_id, courseCode: plan.course_code });
    if (masteryLevel < 60) {
      throw new Error('Reach 60% Mastery to unlock Mock Exam');
    }

    const selectedQuestions = await this.getEligibleCourseQuestions(userId, plan);

    if (selectedQuestions.length === 0) {
      throw new Error('No fresh course questions are available for this exam prep yet');
    }

    await usageService.consume(userId, UsageMetric.CBT_SESSION);

    const mockExam = await prisma.mockExam.create({
      data: {
        plan_id: planId,
        title: `Mock Exam for ${plan.course_code}`,
        questions: { connect: selectedQuestions.map((q) => ({ id: q.id })) },
      },
    });

    return this.formatMockExam({ ...mockExam, plan, questions: selectedQuestions });
  }

  /** Convenience wrapper used by the hub's "Mock Exam" tap - resolves/creates the plan then starts it. */
  async startMockExamForCourse(userId: string, courseCode: string) {
    const plan = await this.getOrCreatePlanForCourse(userId, courseCode);
    return this.startMockExam(userId, plan.id);
  }

  async getMockExam(userId: string, examId: string) {
    const exam = await prisma.mockExam.findUnique({
      where: { id: examId },
      include: { questions: true, plan: true },
    });
    if (!exam || exam.plan.user_id !== userId) throw new Error('Mock exam not found');
    return this.formatMockExam(exam);
  }

  async submitMock(userId: string, examId: string, answers: { questionId: string; answer: string }[] | Record<string, string>) {
    const exam = await prisma.mockExam.findUnique({
      where: { id: examId },
      include: { questions: true, plan: true },
    });
    if (!exam || exam.plan.user_id !== userId) throw new Error('Mock exam not found');

    const answerMap = toAnswerMap(answers);
    const scoredQuestions = exam.questions.filter((question) => !!question.correct_answer);
    const questionCount = Math.max(1, scoredQuestions.length);
    let correctCount = 0;

    for (const question of exam.questions) {
      const userAnswer = answerMap[question.id];
      const isCorrect = !!question.correct_answer && !!userAnswer && normalizeAnswer(userAnswer) === normalizeAnswer(question.correct_answer);
      if (isCorrect) correctCount += 1;

      if (userAnswer) {
        let feedback = isCorrect ? 'Correct.' : question.explanation || question.approach_guide;
        if (!question.correct_answer) {
          const aiFeedback = await orchestrateAIResponse(
            userId,
            '',
            `Evaluate the student's theory response for this course exam question.\n\nQuestion: ${question.question_text}\nStudent answer: ${userAnswer}\n\nGive concise feedback, mention what is correct or missing, and provide a model direction for a stronger answer.`,
            null,
          );
          feedback = aiFeedback.content;
        }
        await prisma.questionAttempt.create({
          data: {
            question_id: question.id,
            user_id: userId,
            answer: userAnswer,
            is_correct: isCorrect,
            feedback,
          },
        });
      }
    }

    const score = Math.round((correctCount / questionCount) * 100);
    const theoryCount = exam.questions.length - scoredQuestions.length;
    const feedback = theoryCount > 0
      ? `${correctCount} of ${questionCount} objective questions correct. ${theoryCount} theory response${theoryCount === 1 ? '' : 's'} reviewed separately.`
      : `${correctCount} of ${questionCount} questions correct.`;

    return prisma.mockAttempt.create({
      data: {
        mock_exam_id: examId,
        user_id: userId,
        score,
        feedback,
        completed_at: new Date(),
      },
    });
  }

  async getMockResults(userId: string, examId: string) {
    const attempt = await prisma.mockAttempt.findFirst({
      where: { mock_exam_id: examId, user_id: userId },
      orderBy: { completed_at: 'desc' },
      include: {
        mock_exam: {
          include: {
            questions: true,
            plan: true,
          },
        },
      },
    });
    if (!attempt) throw new Error('Mock result not found');

    const questionIds = attempt.mock_exam.questions.map(question => question.id);
    const latestAttempts = await prisma.questionAttempt.findMany({
      where: {
        user_id: userId,
        question_id: { in: questionIds },
        created_at: { lte: attempt.completed_at || new Date() },
      },
      orderBy: { created_at: 'desc' },
    });
    const attemptsByQuestion = new Map(latestAttempts.map(questionAttempt => [questionAttempt.question_id, questionAttempt]));

    return {
      score: Math.round(attempt.score),
      aggregate: `${Math.round(attempt.score)}%`,
      date: (attempt.completed_at || attempt.started_at).toLocaleDateString(),
      subtitle: attempt.feedback || `Mock exam for ${attempt.mock_exam.plan.course_code}`,
      breakdown: [
        {
          topic: attempt.mock_exam.plan.course_code || 'General',
          questions: attempt.mock_exam.questions.length,
          correct: Math.round((attempt.score / 100) * attempt.mock_exam.questions.length),
        },
      ],
      questions: attempt.mock_exam.questions.map((question, index) => {
        const questionAttempt = attemptsByQuestion.get(question.id);
        const isTheoryQuestion = !Array.isArray(question.options) || question.options.length === 0 || !question.correct_answer;
        return {
          id: question.id,
          title: `Question ${index + 1}`,
          text: question.question_text,
          userAnswer: questionAttempt?.answer || 'Not answered',
          correctAnswer: question.correct_answer || question.explanation || question.approach_guide || 'Theory response reviewed by Akademi',
          isCorrect: isTheoryQuestion ? !!questionAttempt?.answer : questionAttempt?.is_correct || false,
          aiExplanation: questionAttempt?.feedback || question.explanation || question.approach_guide,
          responseType: isTheoryQuestion ? 'THEORY' : 'OBJECTIVE',
          isLocked: false,
        };
      }),
    };
  }

  private readGuidedMetadata(value: Prisma.JsonValue): GuidedSessionMetadata {
    const metadata = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    const questionIds = Array.isArray(metadata.questionIds)
      ? metadata.questionIds.map(String).filter(Boolean)
      : [];
    const currentIndex = Number(metadata.currentIndex);
    if (
      metadata.mode !== GUIDED_EXAM_PREP_MODE ||
      metadata.version !== GUIDED_EXAM_PREP_VERSION ||
      questionIds.length === 0 ||
      !Number.isInteger(currentIndex) ||
      currentIndex < 0
    ) {
      throw new ExamPrepError('Guided Exam Prep session is invalid', 409, 'INVALID_SESSION_METADATA');
    }
    return {
      mode: GUIDED_EXAM_PREP_MODE,
      version: GUIDED_EXAM_PREP_VERSION,
      entitlementFeature: 'EXAM_PREP',
      questionIds,
      currentIndex: Math.min(currentIndex, questionIds.length - 1),
    };
  }

  private toSanitizedGuidedQuestion(question: {
    id: string;
    question_text: string;
    options: Prisma.JsonValue;
    difficulty: Difficulty;
    question_type: GuidedExamPrepQuestion['questionType'];
  }): GuidedExamPrepQuestion {
    return sanitizeGuidedExamPrepQuestion(question);
  }

  private isUsableGuidedQuestion(question: { options: Prisma.JsonValue; correct_answer: string | null }) {
    const options = Array.isArray(question.options)
      ? question.options.map((option) => String(option).trim()).filter(Boolean)
      : [];
    return options.length === 4 && new Set(options.map(normalizeExamPrepAnswer)).size === 4 &&
      Boolean(resolveCanonicalAnswer(options, question.correct_answer));
  }

  async listGuidedMaterials(userId: string): Promise<ExamPrepMaterialItem[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { university: true, faculty: true, department: true, level: true },
    });
    if (!user) throw new ExamPrepError('User not found', 404, 'USER_NOT_FOUND');

    // Reuse Library's verified-material scope rules, including nationally pooled courses.
    const materials = await this.materialsService.listMaterials({
      university: user.university,
      faculty: user.faculty,
      department: user.department,
      level: user.level,
    });
    if (materials.length === 0) return [];

    const questions = await prisma.question.findMany({
      where: { material_id: { in: materials.map((material) => material.id) } },
      select: { material_id: true, options: true, correct_answer: true },
    });
    const counts = new Map<string, number>();
    for (const question of questions) {
      if (this.isUsableGuidedQuestion(question)) {
        counts.set(question.material_id, (counts.get(question.material_id) || 0) + 1);
      }
    }

    return materials.map((material) => {
      const questionCount = counts.get(material.id) || 0;
      const canPrepare = Boolean(material.content?.trim()) &&
        material.processing_status !== 'FAILED' &&
        material.question_generation_status !== 'FAILED';
      return {
        id: material.id,
        title: material.title,
        courseCode: material.course_code,
        questionCount,
        status: questionCount > 0 ? 'READY' : canPrepare ? 'BUILDING' : 'UNAVAILABLE',
      };
    });
  }

  private async loadGuidedQuestionPool(materialId: string, userId: string) {
    const load = () => prisma.question.findMany({
      where: { material_id: materialId },
      select: {
        id: true,
        question_text: true,
        options: true,
        correct_answer: true,
        explanation: true,
        approach_guide: true,
        difficulty: true,
        question_type: true,
        source_page_start: true,
        source_page_end: true,
      },
      orderBy: { generated_at: 'desc' },
    });

    let pool = (await load()).filter((question) => this.isUsableGuidedQuestion(question));
    if (pool.length < GUIDED_EXAM_PREP_QUESTION_COUNT) {
      try {
        await generateQuestionsJob(materialId, {
          count: Math.min(Math.max(GUIDED_EXAM_PREP_QUESTION_COUNT - pool.length + 5, 5), 30),
          excludeQuestionTexts: pool.map((question) => question.question_text),
        });
        pool = (await load()).filter((question) => this.isUsableGuidedQuestion(question));
      } catch (error) {
        // Existing usable questions still provide a valid revision session.
        console.error(`Could not top up guided Exam Prep questions for material ${materialId}:`, error);
      }
    }
    if (pool.length === 0) {
      throw new ExamPrepError(
        'No study questions are available for this material yet.',
        409,
        'QUESTIONS_UNAVAILABLE',
      );
    }

    const attempted = await prisma.questionAttempt.findMany({
      where: { user_id: userId, question_id: { in: pool.map((question) => question.id) } },
      select: { question_id: true },
      distinct: ['question_id'],
    });
    const attemptedIds = new Set(attempted.map((attempt) => attempt.question_id));
    const unseen = shuffle(pool.filter((question) => !attemptedIds.has(question.id)));
    const revisits = shuffle(pool.filter((question) => attemptedIds.has(question.id)));
    return [...unseen, ...revisits].slice(0, GUIDED_EXAM_PREP_QUESTION_COUNT);
  }

  async startGuidedSession(userId: string, materialId: string): Promise<GuidedExamPrepSession> {
    const normalizedMaterialId = materialId?.trim();
    if (!normalizedMaterialId) {
      throw new ExamPrepError('Material is required', 400, 'MATERIAL_REQUIRED');
    }

    const activeSessions = await prisma.session.findMany({
      where: {
        user_id: userId,
        material_id: normalizedMaterialId,
        session_type: SessionType.EXAM_PREP,
        ended_at: null,
      },
      orderBy: { started_at: 'desc' },
      take: 5,
    });
    const resumable = activeSessions.find((session) => {
      const metadata = session.metadata as Record<string, unknown> | null;
      return metadata?.mode === GUIDED_EXAM_PREP_MODE;
    });
    if (resumable) return this.getGuidedSession(userId, resumable.id);

    let material: Awaited<ReturnType<MaterialsService['getMaterial']>>;
    try {
      material = await this.materialsService.getMaterial(normalizedMaterialId, { requestingUserId: userId });
    } catch {
      // Ownership-safe: callers cannot distinguish a missing material from one outside scope.
      throw new ExamPrepError('Material not found', 404, 'MATERIAL_NOT_FOUND');
    }
    if (
      material.verification_status !== VerificationStatus.VERIFIED ||
      material.unpublished_at
    ) {
      throw new ExamPrepError('Material not found', 404, 'MATERIAL_NOT_FOUND');
    }

    const selectedQuestions = await this.loadGuidedQuestionPool(material.id, userId);

    // Feature entitlement is consumed once for the whole guided session, never per question.
    await usageService.assertAvailable(userId, UsageMetric.CBT_SESSION);
    const hasAccess = await checkFeatureAccess(userId, Feature.EXAM_PREP);
    if (!hasAccess) {
      throw new ExamPrepError('Exam Prep access required', 403, 'EXAM_PREP_ACCESS_REQUIRED');
    }
    await usageService.consume(userId, UsageMetric.CBT_SESSION);

    const metadata: GuidedSessionMetadata = {
      mode: GUIDED_EXAM_PREP_MODE,
      version: GUIDED_EXAM_PREP_VERSION,
      entitlementFeature: 'EXAM_PREP',
      questionIds: selectedQuestions.map((question) => question.id),
      currentIndex: 0,
    };
    const session = await prisma.session.create({
      data: {
        user_id: userId,
        material_id: material.id,
        session_type: SessionType.EXAM_PREP,
        course_code: material.course_code,
        topic: material.title,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        university: material.university,
        department: material.department,
      },
    });
    return this.getGuidedSession(userId, session.id);
  }

  private async loadOwnedGuidedSession(userId: string, sessionId: string) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, user_id: userId, session_type: SessionType.EXAM_PREP },
      include: {
        material: {
          select: {
            id: true,
            title: true,
            course_code: true,
            content: true,
            reader_structure: true,
          },
        },
        question_attempts: { orderBy: { created_at: 'asc' } },
      },
    });
    const material = session?.material;
    if (!session || !material) {
      throw new ExamPrepError('Session not found', 404, 'SESSION_NOT_FOUND');
    }
    return {
      session: { ...session, material },
      metadata: this.readGuidedMetadata(session.metadata),
    };
  }

  private buildProgress(metadata: GuidedSessionMetadata, attempts: Array<{ is_correct: boolean }>): GuidedExamPrepProgress {
    return {
      current: Math.min(metadata.currentIndex + 1, metadata.questionIds.length),
      total: metadata.questionIds.length,
      completed: attempts.length,
      correct: attempts.filter((attempt) => attempt.is_correct).length,
    };
  }

  async getGuidedSession(userId: string, sessionId: string): Promise<GuidedExamPrepSession> {
    const { session, metadata } = await this.loadOwnedGuidedSession(userId, sessionId);
    const currentQuestionId = metadata.questionIds[metadata.currentIndex];
    const currentQuestion = currentQuestionId
      ? await prisma.question.findFirst({
          where: { id: currentQuestionId, material_id: session.material!.id },
          select: {
            id: true,
            question_text: true,
            options: true,
            difficulty: true,
            question_type: true,
          },
        })
      : null;
    if (!currentQuestion) {
      throw new ExamPrepError('Current question not found', 409, 'CURRENT_QUESTION_NOT_FOUND');
    }
    const attempt = session.question_attempts.find((item) => item.question_id === currentQuestion.id) || null;
    const feedback = attempt?.feedback_payload as unknown as ExamPrepTeachingFeedback | null;
    const isComplete = Boolean(session.ended_at);

    return {
      id: session.id,
      material: {
        id: session.material.id,
        title: session.material.title,
        courseCode: session.material.course_code,
      },
      currentIndex: metadata.currentIndex,
      totalQuestions: metadata.questionIds.length,
      completedCount: session.question_attempts.length,
      currentQuestion: this.toSanitizedGuidedQuestion(currentQuestion),
      currentAttempt: attempt && feedback ? {
        id: attempt.id,
        reasoning: attempt.reasoning || '',
        feedback,
      } : null,
      progress: this.buildProgress(metadata, session.question_attempts),
      isComplete,
    };
  }

  private relevantSourceContext(
    material: { content: string | null; reader_structure: Prisma.JsonValue },
    question: { source_page_start: number | null; source_page_end: number | null },
  ) {
    const reader = material.reader_structure && typeof material.reader_structure === 'object' && !Array.isArray(material.reader_structure)
      ? material.reader_structure as Record<string, unknown>
      : null;
    const pages = Array.isArray(reader?.pages) ? reader.pages : [];
    if (question.source_page_start != null && pages.length > 0) {
      const end = question.source_page_end ?? question.source_page_start;
      const pageContext = pages
        .filter((page) => {
          const number = Number((page as Record<string, unknown>)?.pageNumber);
          return number >= question.source_page_start! && number <= end;
        })
        .map((page) => String((page as Record<string, unknown>)?.content || '').trim())
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (pageContext) return pageContext.slice(0, 8_000);
    }
    return material.content?.trim().slice(0, 8_000) || null;
  }

  private submissionResponse(
    attempt: {
      id: string;
      question_id: string;
      reasoning: string | null;
      feedback_payload: Prisma.JsonValue | null;
    },
    feedback: ExamPrepTeachingFeedback,
    progress: GuidedExamPrepProgress,
    isComplete: boolean,
  ) {
    return {
      attemptId: attempt.id,
      questionId: attempt.question_id,
      reasoning: attempt.reasoning || '',
      ...feedback,
      progress,
      isComplete,
    };
  }

  async submitGuidedQuestion(
    userId: string,
    sessionId: string,
    questionId: string,
    body: { selectedAnswer?: unknown; reasoning?: unknown },
  ) {
    const selectedAnswer = typeof body?.selectedAnswer === 'string' ? body.selectedAnswer.trim() : '';
    const reasoning = typeof body?.reasoning === 'string' ? body.reasoning.trim() : '';
    if (reasoning.length < 5 || reasoning.length > 2_000) {
      throw new ExamPrepError('Reasoning must be between 5 and 2,000 characters', 400, 'INVALID_REASONING');
    }

    const { session, metadata } = await this.loadOwnedGuidedSession(userId, sessionId);
    if (!metadata.questionIds.includes(questionId)) {
      throw new ExamPrepError('Question not found in this session', 404, 'QUESTION_NOT_FOUND');
    }

    const existing = session.question_attempts.find((attempt) => attempt.question_id === questionId);
    if (existing?.feedback_payload) {
      return this.submissionResponse(
        existing,
        existing.feedback_payload as unknown as ExamPrepTeachingFeedback,
        this.buildProgress(metadata, session.question_attempts),
        Boolean(session.ended_at),
      );
    }
    if (session.ended_at) {
      throw new ExamPrepError('This guided session is complete', 409, 'SESSION_COMPLETE');
    }
    if (metadata.questionIds[metadata.currentIndex] !== questionId) {
      throw new ExamPrepError('This question is not currently eligible for submission', 409, 'QUESTION_NOT_CURRENT');
    }

    const question = await prisma.question.findFirst({
      where: { id: questionId, material_id: session.material.id },
      select: {
        id: true,
        question_text: true,
        options: true,
        correct_answer: true,
        explanation: true,
        approach_guide: true,
        source_page_start: true,
        source_page_end: true,
      },
    });
    if (!question) throw new ExamPrepError('Question not found in this session', 404, 'QUESTION_NOT_FOUND');

    const options = Array.isArray(question.options) ? question.options.map(String) : [];
    const matchedSelection = options.find((option) => normalizeExamPrepAnswer(option) === normalizeExamPrepAnswer(selectedAnswer));
    if (!matchedSelection) {
      throw new ExamPrepError('Selected answer must match one of the question options', 400, 'INVALID_OPTION');
    }
    const canonicalCorrectAnswer = resolveCanonicalAnswer(options, question.correct_answer);
    if (!canonicalCorrectAnswer) {
      throw new ExamPrepError('This question does not have a usable answer key', 409, 'INVALID_ANSWER_KEY');
    }
    const isCorrect = normalizeExamPrepAnswer(matchedSelection) === normalizeExamPrepAnswer(canonicalCorrectAnswer);
    const feedbackInput: FeedbackGenerationInput = {
      questionText: question.question_text,
      options,
      canonicalCorrectAnswer,
      canonicalExplanation: question.explanation,
      approachGuide: question.approach_guide,
      studentSelectedAnswer: matchedSelection,
      backendDeterminedIsCorrect: isCorrect,
      studentReasoning: reasoning,
      relevantSourceContext: this.relevantSourceContext(session.material, question),
      materialTitle: session.material.title,
      courseCode: session.material.course_code,
    };
    const fallback = buildFallbackFeedback(feedbackInput);

    // Persist deterministic scoring and canonical fallback before the live model call. The
    // unique session/question key makes retries safe and prevents repeated AI/quota usage.
    let attempt;
    try {
      attempt = await prisma.questionAttempt.create({
        data: {
          session_id: session.id,
          question_id: question.id,
          user_id: userId,
          answer: matchedSelection,
          is_correct: isCorrect,
          reasoning,
          reasoning_quality: null,
          feedback: fallback.reasoningAssessment.summary,
          feedback_payload: fallback as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      const racedAttempt = await prisma.questionAttempt.findUnique({
        where: { session_id_question_id: { session_id: session.id, question_id: question.id } },
      });
      if (!racedAttempt?.feedback_payload) throw error;
      const refreshed = await this.loadOwnedGuidedSession(userId, sessionId);
      return this.submissionResponse(
        racedAttempt,
        racedAttempt.feedback_payload as unknown as ExamPrepTeachingFeedback,
        this.buildProgress(refreshed.metadata, refreshed.session.question_attempts),
        Boolean(refreshed.session.ended_at),
      );
    }

    const feedback = await this.feedbackService.generate(feedbackInput);
    attempt = await prisma.questionAttempt.update({
      where: { id: attempt.id },
      data: {
        reasoning_quality: feedback.reasoningAssessment.qualityScore,
        feedback: feedback.reasoningAssessment.summary,
        feedback_payload: feedback as unknown as Prisma.InputJsonValue,
      },
    });

    const isFinalQuestion = metadata.currentIndex === metadata.questionIds.length - 1;
    if (isFinalQuestion) {
      await prisma.session.updateMany({
        where: { id: session.id, user_id: userId, ended_at: null },
        data: { ended_at: new Date() },
      });
    }
    const refreshed = await this.loadOwnedGuidedSession(userId, sessionId);
    return this.submissionResponse(
      attempt,
      feedback,
      this.buildProgress(refreshed.metadata, refreshed.session.question_attempts),
      Boolean(refreshed.session.ended_at),
    );
  }

  async advanceGuidedSession(userId: string, sessionId: string, completedQuestionId: string) {
    const { session, metadata } = await this.loadOwnedGuidedSession(userId, sessionId);
    const currentQuestionId = metadata.questionIds[metadata.currentIndex];

    // A retried Next request is idempotent: once the server has advanced beyond the supplied
    // completed question, simply return the already-current state instead of skipping again.
    if (currentQuestionId !== completedQuestionId) {
      if (metadata.questionIds.indexOf(completedQuestionId) < metadata.currentIndex) {
        return this.getGuidedSession(userId, sessionId);
      }
      throw new ExamPrepError('Question is not current for this session', 409, 'QUESTION_NOT_CURRENT');
    }
    if (session.ended_at) return this.getGuidedSession(userId, sessionId);
    const attempt = session.question_attempts.find((item) => item.question_id === currentQuestionId);
    if (!attempt?.feedback_payload) {
      throw new ExamPrepError('Submit your answer and reasoning before continuing', 409, 'QUESTION_NOT_SUBMITTED');
    }
    if (metadata.currentIndex >= metadata.questionIds.length - 1) {
      await prisma.session.updateMany({
        where: { id: session.id, ended_at: null },
        data: { ended_at: new Date() },
      });
      return this.getGuidedSession(userId, sessionId);
    }

    const nextMetadata: GuidedSessionMetadata = { ...metadata, currentIndex: metadata.currentIndex + 1 };
    await prisma.session.update({
      where: { id: session.id },
      data: { metadata: nextMetadata as unknown as Prisma.InputJsonValue },
    });
    return this.getGuidedSession(userId, sessionId);
  }

  async getGuidedSummary(userId: string, sessionId: string): Promise<ExamPrepSessionSummary> {
    const { session } = await this.loadOwnedGuidedSession(userId, sessionId);
    if (!session.ended_at) {
      throw new ExamPrepError('Complete the current study questions before viewing the summary', 409, 'SESSION_NOT_COMPLETE');
    }
    const attempts = session.question_attempts;
    const correctAnswers = attempts.filter((attempt) => attempt.is_correct).length;
    const qualityScores = attempts
      .map((attempt) => attempt.reasoning_quality)
      .filter((score): score is number => score !== null);
    const needsReviewIds = attempts
      .filter((attempt) => !attempt.is_correct || (attempt.reasoning_quality !== null && attempt.reasoning_quality < 60))
      .map((attempt) => attempt.question_id)
      .slice(0, 5);
    const needsReviewQuestions = needsReviewIds.length > 0
      ? await prisma.question.findMany({
          where: { id: { in: needsReviewIds } },
          select: { id: true, question_text: true },
        })
      : [];
    const needsReviewById = new Map(needsReviewQuestions.map((question) => [question.id, question.question_text]));

    return {
      sessionId: session.id,
      material: {
        id: session.material.id,
        title: session.material.title,
        courseCode: session.material.course_code,
      },
      questionsStudied: attempts.length,
      correctAnswers,
      percentage: attempts.length > 0 ? Math.round((correctAnswers / attempts.length) * 100) : 0,
      averageReasoningQuality: qualityScores.length > 0
        ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length)
        : null,
      needsReview: needsReviewIds
        .map((questionId) => needsReviewById.get(questionId))
        .filter((text): text is string => Boolean(text))
        .map((text) => text.length > 120 ? `${text.slice(0, 117)}…` : text),
      completedAt: session.ended_at?.toISOString() || null,
    };
  }
}
