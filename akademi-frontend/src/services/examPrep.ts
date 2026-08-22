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

export interface ExamPrepMaterialItem {
  id: string;
  title: string;
  courseCode: string | null;
  questionCount: number;
  status: "READY" | "BUILDING" | "UNAVAILABLE";
}

export interface GuidedExamPrepQuestion {
  id: string;
  text: string;
  options: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionType: "RECALL" | "APPLICATION" | "CALCULATION" | "REASONING" | "MISCONCEPTION";
}

export interface ReasoningAssessment {
  qualityScore: number | null;
  summary: string;
  whatYouGotRight: string[];
  whatYouMissed: string[];
  misconception: string | null;
}

export interface OptionTeachingFeedback {
  option: string;
  isCorrect: boolean;
  whyItFitsOrDoesNotFit: string;
  whatItRepresents: string;
  whenItWouldBeCorrect: string | null;
}

export interface ExamPrepTeachingFeedback {
  isCorrect: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  verdict: "CORRECT" | "INCORRECT";
  reasoningAssessment: ReasoningAssessment;
  teachingExplanation: {
    whyCorrect: string;
    keyConcept: string;
    conciseLesson: string;
  };
  optionBreakdown: OptionTeachingFeedback[];
  takeaway: string;
  personalized: boolean;
}

export interface GuidedExamPrepProgress {
  current: number;
  total: number;
  completed: number;
  correct: number;
}

export interface GuidedExamPrepSession {
  id: string;
  material: { id: string; title: string; courseCode: string | null };
  currentIndex: number;
  totalQuestions: number;
  completedCount: number;
  currentQuestion: GuidedExamPrepQuestion | null;
  currentAttempt: {
    id: string;
    reasoning: string;
    feedback: ExamPrepTeachingFeedback;
  } | null;
  progress: GuidedExamPrepProgress;
  isComplete: boolean;
}

export interface GuidedExamPrepSubmission extends ExamPrepTeachingFeedback {
  attemptId: string;
  questionId: string;
  reasoning: string;
  progress: GuidedExamPrepProgress;
  isComplete: boolean;
}

export interface ExamPrepSessionSummary {
  sessionId: string;
  material: { id: string; title: string; courseCode: string | null };
  questionsStudied: number;
  correctAnswers: number;
  percentage: number;
  averageReasoningQuality: number | null;
  needsReview: string[];
  completedAt: string | null;
}

const examPrepService = {
  getMaterials: async () => {
    const { data } = await api.get<ExamPrepMaterialItem[]>("/exam-prep/materials");
    return data;
  },

  startGuidedSession: async (materialId: string) => {
    const { data } = await api.post<GuidedExamPrepSession>(
      `/exam-prep/materials/${encodeURIComponent(materialId)}/sessions`,
    );
    return data;
  },

  getGuidedSession: async (sessionId: string) => {
    const { data } = await api.get<GuidedExamPrepSession>(
      `/exam-prep/sessions/${encodeURIComponent(sessionId)}`,
    );
    return data;
  },

  submitGuidedQuestion: async (
    sessionId: string,
    questionId: string,
    selectedAnswer: string,
    reasoning: string,
  ) => {
    const { data } = await api.post<GuidedExamPrepSubmission>(
      `/exam-prep/sessions/${encodeURIComponent(sessionId)}/questions/${encodeURIComponent(questionId)}/submit`,
      { selectedAnswer, reasoning },
    );
    return data;
  },

  advanceGuidedSession: async (sessionId: string, questionId: string) => {
    const { data } = await api.post<GuidedExamPrepSession>(
      `/exam-prep/sessions/${encodeURIComponent(sessionId)}/next`,
      { questionId },
    );
    return data;
  },

  getGuidedSummary: async (sessionId: string) => {
    const { data } = await api.get<ExamPrepSessionSummary>(
      `/exam-prep/sessions/${encodeURIComponent(sessionId)}/summary`,
    );
    return data;
  },

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
