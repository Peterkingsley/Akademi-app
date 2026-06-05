import api from "./api";

export interface Task {
  id: string;
  name: string;
  type: "quiz" | "practice" | "revision";
  duration: string;
  completed: boolean;
  topic?: string;
}

export interface DailyTaskGroup {
  date: string;
  focus: string;
  tasks: Task[];
}

export interface ExamPrepPlan {
  id: string;
  course_code: string;
  course_name: string;
  exam_date: string;
  progress: number;
  readiness_score: number;
  readiness_grade: string;
  readinessScore?: number;
  readinessGrade?: string;
  subject: string;
  days_left: number;
  daily_tasks?: DailyTaskGroup[];
  dailyTasks?: DailyTaskGroup[];
}

export interface ReadinessResponse {
  score: number;
  grade: string;
}

export interface MockQuestion {
  id: string;
  text: string;
  options: string[];
  formula?: string;
}

export interface MockExam {
  id: string;
  questions: MockQuestion[];
  durationMinutes: number;
}

export interface MockResultTopic {
  topic: string;
  questions: number;
  correct: number;
}

export interface MockResultQuestion {
  id: string;
  title: string;
  text: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  aiExplanation: string;
  isLocked: boolean;
}

export interface MockResult {
  score: number;
  aggregate: string;
  date: string;
  subtitle: string;
  breakdown: MockResultTopic[];
  questions: MockResultQuestion[];
}

const examPrepService = {
  getAllPlans: async () => {
    const { data } = await api.get<ExamPrepPlan[]>("/exam-prep");
    return data;
  },

  getReadiness: async (id: string) => {
    const { data } = await api.get<ReadinessResponse>(`/exam-prep/${id}/readiness`);
    return data;
  },

  createPlan: async (course_code: string, exam_date: string) => {
    const { data } = await api.post<ExamPrepPlan>("/exam-prep", {
      course_code,
      exam_date,
    });
    return data;
  },

  getPlanDetails: async (id: string) => {
    const { data } = await api.get<ExamPrepPlan>(`/exam-prep/${id}`);
    return data;
  },

  updateTaskProgress: async (planId: string, taskId: string, completed: boolean) => {
    const { data } = await api.patch(`/exam-prep/${planId}/progress`, {
      taskId,
      completed,
    });
    return data;
  },

  startMockExam: async (planId: string) => {
    const { data } = await api.post<MockExam>(`/exam-prep/${planId}/mock-exam`);
    return data;
  },

  getMockExam: async (planId: string, examId: string) => {
    const { data } = await api.get<MockExam>(`/exam-prep/${planId}/mock-exam/${examId}`);
    return data;
  },

  submitMockExam: async (planId: string, examId: string, answers: Record<string, string>) => {
    const { data } = await api.post(`/exam-prep/${planId}/mock-exam/${examId}/submit`, {
      answers,
    });
    return data;
  },

  getMockResults: async (planId: string, examId: string) => {
    const { data } = await api.get<MockResult>(`/exam-prep/${planId}/mock-exam/${examId}/results`);
    return data;
  },
};

export default examPrepService;
