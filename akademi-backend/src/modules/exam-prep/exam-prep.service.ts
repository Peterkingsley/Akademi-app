import prisma from '../../config/db';
import { VerificationStatus } from '@prisma/client';
import { orchestrateAIResponse } from '../../shared/utils/ai-orchestrator';
import { generateQuestionsJob, ensureQuestionBuffer } from '../../jobs/generateQuestions.job';
import { resolveDepartmentId, findOrCreateCourse } from '../../shared/utils/department-resolver';
import { UsersService } from '../users/users.service';

function normalizeAnswer(answer: string) {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
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

export class ExamPrepService {
  private usersService = new UsersService();

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

  private async formatPlan(plan: any) {
    const lastAttempt = await prisma.mockAttempt.findFirst({
      where: { user_id: plan.user_id, mock_exam: { plan_id: plan.id }, completed_at: { not: null } },
      orderBy: { completed_at: 'desc' },
    });
    const mockCount = await prisma.mockAttempt.count({
      where: { user_id: plan.user_id, mock_exam: { plan_id: plan.id }, completed_at: { not: null } },
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
      last_mock_score: lastAttempt ? Math.round(lastAttempt.score) : null,
      mock_count: mockCount,
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
   * Get-or-create a plan for this user+course. Plans are a lightweight per-course settings
   * record (exam date, duration, question mix) - the hub lists courses directly from the
   * user's academic profile, so a plan only needs to exist once a course is customized or a
   * mock exam is started.
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

  async getOrCreateFormattedPlanForCourse(userId: string, courseCode: string) {
    const plan = await this.getOrCreatePlanForCourse(userId, courseCode);
    return this.formatPlan(plan);
  }

  /**
   * Creates or updates a course's prep settings (exam date, duration, question mix).
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
   * profile, not from pre-existing plans), with each course's exam-date/countdown and last mock
   * score if one exists, computed in one batched pass (no N+1 per course).
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

    const plans = await prisma.examPrepPlan.findMany({
      where: { user_id: userId, course_code: { in: courseCodes } },
    });
    const planIds = plans.map((plan) => plan.id);

    const lastAttempts = planIds.length
      ? await prisma.mockAttempt.findMany({
          where: { user_id: userId, mock_exam: { plan_id: { in: planIds } }, completed_at: { not: null } },
          orderBy: { completed_at: 'desc' },
          include: { mock_exam: { select: { plan_id: true } } },
        })
      : [];
    const lastScoreByPlanId = new Map<string, number>();
    for (const attempt of lastAttempts) {
      const planId = attempt.mock_exam.plan_id;
      if (!lastScoreByPlanId.has(planId)) {
        lastScoreByPlanId.set(planId, Math.round(attempt.score));
      }
    }

    const planByCourse = new Map(plans.map((plan) => [plan.course_code!.toUpperCase(), plan]));

    return courseCodes.map((code) => {
      const plan = planByCourse.get(code);
      const examDate = plan?.exam_date || null;

      return {
        course_code: code,
        course_name: uniqueByCode.get(code)?.name || code,
        assessment_label: plan ? this.getAssessmentLabel(plan.assessment_type) : 'Exam',
        exam_date: examDate,
        days_left: this.getDaysLeft(examDate),
        plan_id: plan?.id || null,
        last_mock_score: plan ? lastScoreByPlanId.get(plan.id) ?? null : null,
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

  /**
   * Course-wide question pool for a mock exam: unions questions across every verified material
   * under the plan's course, permanently excludes any question the user has ever attempted
   * (regardless of which past mock/session it came from), keeps every underlying material's
   * bank topped up in the background (see QUESTION_BUFFER_TARGET), and falls back to a
   * synchronous top-up only if this specific request would otherwise come up short right now.
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

    // Keep every underlying material's bank well ahead of consumption; never blocks this request.
    for (const materialId of materialIds) {
      ensureQuestionBuffer(materialId).catch((error) => {
        console.error(`Failed to queue question buffer top-up for material ${materialId}:`, error);
      });
    }

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
    const requestedTotal = targetObjective + targetTheory;
    const availableTotal = objective.length + theory.length;

    if (availableTotal < requestedTotal) {
      // Last-resort synchronous fill so *this* request still gets its full question count even
      // if the background buffer hasn't caught up yet (e.g. right after a course's first
      // material was uploaded, before any buffering has had a chance to run).
      const remainingByMaterial = new Map<string, number>();
      for (const id of materialIds) remainingByMaterial.set(id, 0);
      for (const q of pool) remainingByMaterial.set(q.material_id, (remainingByMaterial.get(q.material_id) || 0) + 1);
      const materialsNeedingMore = [...remainingByMaterial.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([materialId]) => materialId);

      let stillNeeded = requestedTotal - availableTotal;
      for (const materialId of materialsNeedingMore) {
        if (stillNeeded <= 0) break;
        try {
          const generationTarget = Math.max(Math.ceil(stillNeeded / materialsNeedingMore.length) + 5, 10);
          const createdCount = await generateQuestionsJob(materialId, { count: generationTarget });
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

    const selectedQuestions = await this.getEligibleCourseQuestions(userId, plan);

    if (selectedQuestions.length === 0) {
      throw new Error('No fresh course questions are available for this exam prep yet');
    }

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
}
