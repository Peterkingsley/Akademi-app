import prisma from '../../config/db';
import { Difficulty } from '@prisma/client';

export class ExamPrepService {
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

    return plan;
  }

  async getAllPlans(userId: string) {
    return prisma.examPrepPlan.findMany({
      where: { user_id: userId },
      include: { tasks: true },
    });
  }

  async getPlan(userId: string, planId: string) {
    const plan = await prisma.examPrepPlan.findFirst({
      where: { id: planId, user_id: userId },
      include: { tasks: true, mock_exams: true },
    });
    if (!plan) throw new Error('Plan not found');
    return plan;
  }

  async updateProgress(userId: string, planId: string, taskId: string, completed: boolean) {
    const task = await prisma.prepTask.findFirst({
      where: { id: taskId, plan_id: planId, plan: { user_id: userId } },
    });
    if (!task) throw new Error('Task not found');

    return prisma.prepTask.update({
      where: { id: taskId },
      data: {
        completed,
        completed_at: completed ? new Date() : null,
      },
    });
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

    // In a real implementation, pick random questions based on course context
    const questions = await prisma.question.findMany({
      where: { course_code: plan.course_code },
      take: 10,
    });

    const mockExam = await prisma.mockExam.create({
      data: {
        plan_id: planId,
        title: `Mock Exam for ${plan.course_code}`,
        questions: { connect: questions.map(q => ({ id: q.id })) },
      },
    });

    return mockExam;
  }

  async getMockExam(userId: string, examId: string) {
    const exam = await prisma.mockExam.findFirst({
      where: { id: examId, plan: { user_id: userId } },
      include: { questions: true },
    });
    if (!exam) throw new Error('Mock exam not found');
    return exam;
  }

  async submitMock(userId: string, examId: string, answers: { questionId: string; answer: string }[]) {
    // In a real implementation, would score each answer
    const score = Math.random() * 100;
    const feedback = 'Detailed AI feedback on mock exam performance.';

    const exam = await prisma.mockExam.findFirst({
      where: { id: examId, plan: { user_id: userId } }
    });
    if (!exam) throw new Error('Mock exam not found or unauthorized');

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
    const exam = await prisma.mockExam.findFirst({
      where: { id: examId, plan: { user_id: userId } }
    });
    if (!exam) throw new Error('Mock exam not found or unauthorized');

    return prisma.mockAttempt.findFirst({
      where: { mock_exam_id: examId, user_id: userId },
      orderBy: { completed_at: 'desc' },
    });
  }
}
