import api from "./api";

export interface ExamPrepPlan {
  id: string;
  course_code: string;
  course_id?: string | null;
  course_name: string;
  assessment_type?: "TEST" | "EXAM";
  assessment_label?: string;
  exam_date?: string | null;
  duration_minutes?: number;
  objective_question_count?: number;
  theory_question_count?: number;
  progress: number;
  readiness_score: number;
  readiness_grade: string;
  readinessScore?: number;
  readinessGrade?: string;
  subject: string;
  days_left?: number | null;
}

export interface CourseHubItem {
  course_code: string;
  course_name?: string | null;
  mastery_level: number;
  readiness_grade: string;
  assessment_label?: string;
  exam_date?: string | null;
  days_left?: number | null;
  plan_id?: string | null;
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
  responseType?: "OBJECTIVE" | "THEORY";
}

export interface MockExam {
  id: string;
  title?: string;
  plan_id?: string;
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
  responseType?: "OBJECTIVE" | "THEORY";
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

export interface MockHistoryItem {
  id: string;
  mockExamId: string;
  mock_exam_id?: string;
  title: string;
  score: number;
  aggregate: string;
  feedback?: string;
  completedAt: string;
  completed_at?: string;
  questionCount: number;
  question_count?: number;
}

const examPrepService = {
  getCourseHub: async () => {
    const { data } = await api.get<CourseHubItem[]>("/exam-prep/courses");
    return data;
  },

  startMockExamForCourse: async (courseCode: string) => {
    const { data } = await api.post<MockExam>(`/exam-prep/courses/${encodeURIComponent(courseCode)}/mock-exam`);
    return data;
  },

  upsertPlanSettings: async (
    courseCode: string,
    exam_date?: string | null,
    assessment_type: "TEST" | "EXAM" = "EXAM",
    duration_minutes = 120,
    objective_question_count = 40,
    theory_question_count = 5,
  ) => {
    const { data } = await api.patch<ExamPrepPlan>(`/exam-prep/courses/${encodeURIComponent(courseCode)}/settings`, {
      exam_date,
      assessment_type,
      duration_minutes,
      objective_question_count,
      theory_question_count,
    });
    return data;
  },

  getAllPlans: async () => {
    const { data } = await api.get<ExamPrepPlan[]>("/exam-prep");
    return data;
  },

  getReadiness: async (id: string) => {
    const { data } = await api.get<ReadinessResponse>(`/exam-prep/${id}/readiness`);
    return data;
  },

  getPlanDetails: async (id: string) => {
    const { data } = await api.get<ExamPrepPlan>(`/exam-prep/${id}`);
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

  getMockHistory: async (planId: string) => {
    const { data } = await api.get<MockHistoryItem[]>(`/exam-prep/${planId}/mock-history`);
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
