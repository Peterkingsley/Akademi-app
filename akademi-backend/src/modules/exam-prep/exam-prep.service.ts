import prisma from '../../config/db';
import { Difficulty } from '@prisma/client';

const TASK_TYPE_BY_INDEX = ['revision', 'practice', 'quiz'] as const;

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

export class ExamPrepService {
  private getDaysLeft(examDate: Date) {
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

  private formatTask(task: any, index: number) {
    return {
      id: task.id,
      name: task.title,
      title: task.title,
      description: task.description,
      type: TASK_TYPE_BY_INDEX[index % TASK_TYPE_BY_INDEX.length],
      duration: index === 0 ? '25 min' : index === 1 ? '35 min' : '20 min',
      completed: task.completed,
      due_date: task.due_date,
      completed_at: task.completed_at,
    };
  }

  private async formatPlan(plan: any) {
    const tasks = plan.tasks || [];
    const completedTasks = tasks.filter((task: any) => task.completed).length;
    const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const readinessScore = Math.round(await this.getReadinessScore(plan.user_id, plan.id));
    const formattedTasks = tasks.map((task: any, index: number) => this.formatTask(task, index));
    const dailyTasks = [
      {
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        focus: plan.course_code || 'Exam preparation',
        tasks: formattedTasks,
      },
    ];

    return {
      ...plan,
      course_name: plan.course_code,
      subject: plan.course_code,
      days_left: this.getDaysLeft(plan.exam_date),
      progress,
      readiness_score: readinessScore,
      readinessScore,
      readiness_grade: this.getReadinessGrade(readinessScore),
      readinessGrade: this.getReadinessGrade(readinessScore),
      daily_tasks: dailyTasks,
      dailyTasks,
      tasks: formattedTasks,
    };
  }

  private formatMockExam(exam: any) {
    return {
      ...exam,
      durationMinutes: Math.max(10, (exam.questions?.length || 1) * 2),
      questions: (exam.questions || []).map((question: any) => ({
        id: question.id,
        text: question.question_text,
        title: question.question_text,
        formula: undefined,
        options: Array.isArray(question.options) && question.options.length > 0
          ? question.options
          : ['I know this', 'I am unsure', 'Need a hint', 'Review later'],
        difficulty: question.difficulty,
      })),
    };
  }

  async createPlan(userId: string, courseCode: string, examDate: string) {
    const plan = await prisma.examPrepPlan.create({
      data: {
        user_id: userId,
        course_code: courseCode,
        exam_date: new Date(examDate),
      },
    });

    // Generate initial tasks
    const tasksData = [
      { title: 'Material Review', description: 'Review lecture notes and summaries', due_date: new Date() },
      { title: 'Practice Questions', description: 'Complete 10 easy questions', due_date: new Date() },
      { title: 'Weak Area Focus', description: 'Deep dive into weak topics', due_date: new Date() },
    ];

    await prisma.prepTask.createMany({
      data: tasksData.map(t => ({ ...t, plan_id: plan.id })),
    });

    return this.getPlan(userId, plan.id);
  }

  async getAllPlans(userId: string) {
    const plans = await prisma.examPrepPlan.findMany({
      where: { user_id: userId },
      include: { tasks: true },
      orderBy: { exam_date: 'asc' },
    });
    return Promise.all(plans.map((plan) => this.formatPlan(plan)));
  }

  async getPlan(userId: string, planId: string) {
    const plan = await prisma.examPrepPlan.findFirst({
      where: { id: planId, user_id: userId },
      include: { tasks: true, mock_exams: true },
    });
    if (!plan) throw new Error('Plan not found');
    return this.formatPlan(plan);
  }

  async updateProgress(userId: string, planId: string, taskId: string, completed: boolean) {
    const task = await prisma.prepTask.findFirst({
      where: { id: taskId, plan_id: planId, plan: { user_id: userId } },
    });
    if (!task) throw new Error('Task not found');

    const updatedTask = await prisma.prepTask.update({
      where: { id: taskId },
      data: {
        completed,
        completed_at: completed ? new Date() : null,
      },
    });

    return this.formatTask(updatedTask, 0);
  }

  async getReadinessScore(userId: string, planId: string) {
    const attempts = await prisma.questionAttempt.findMany({
      where: {
        user_id: userId,
        question: { course_code: { in: await prisma.examPrepPlan.findUnique({ where: { id: planId } }).then(p => [p?.course_code || '']) } },
      },
      include: { question: true },
    });

    if (attempts.length === 0) return 0;

    const weights = { [Difficulty.EASY]: 1, [Difficulty.MEDIUM]: 2, [Difficulty.HARD]: 3 };
    let totalWeightedScore = 0;
    let totalWeight = 0;

    attempts.forEach(a => {
      const weight = weights[a.question.difficulty];
      totalWeight += weight;
      if (a.is_correct) {
        totalWeightedScore += weight;
      }
    });

    return (totalWeightedScore / totalWeight) * 100;
  }

  async startMockExam(userId: string, planId: string) {
    const plan = await prisma.examPrepPlan.findUnique({
      where: { id: planId },
      include: { tasks: true },
    });

    if (!plan || plan.user_id !== userId) throw new Error('Plan not found');

    const completedTasks = plan.tasks.filter(t => t.completed).length;
    const totalTasks = plan.tasks.length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    if (completionRate < 0.6) {
      throw new Error('Complete 60% of your prep plan to unlock mock exam');
    }

    const questions = await prisma.question.findMany({
      where: {
        course_code: plan.course_code,
        correct_answer: { not: null },
      },
      take: 10,
    });

    if (questions.length === 0) {
      throw new Error('No scored questions are available for this course yet');
    }

    const mockExam = await prisma.mockExam.create({
      data: {
        plan_id: planId,
        title: `Mock Exam for ${plan.course_code}`,
        questions: { connect: questions.map(q => ({ id: q.id })) },
      },
    });

    return this.formatMockExam({ ...mockExam, questions });
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
    const questionCount = Math.max(1, exam.questions.length);
    let correctCount = 0;

    for (const question of exam.questions) {
      const userAnswer = answerMap[question.id];
      const isCorrect = !!question.correct_answer && !!userAnswer && normalizeAnswer(userAnswer) === normalizeAnswer(question.correct_answer);
      if (isCorrect) correctCount += 1;

      if (userAnswer) {
        await prisma.questionAttempt.create({
          data: {
            question_id: question.id,
            user_id: userId,
            answer: userAnswer,
            is_correct: isCorrect,
            feedback: isCorrect ? 'Correct.' : question.explanation || question.approach_guide,
          },
        });
      }
    }

    const score = Math.round((correctCount / questionCount) * 100);
    const feedback = `${correctCount} of ${questionCount} questions correct.`;

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
        return {
          id: question.id,
          title: `Question ${index + 1}`,
          text: question.question_text,
          userAnswer: questionAttempt?.answer || 'Not answered',
          correctAnswer: question.correct_answer || 'Not available',
          isCorrect: questionAttempt?.is_correct || false,
          aiExplanation: questionAttempt?.feedback || question.explanation || question.approach_guide,
          isLocked: false,
        };
      }),
    };
  }
}
