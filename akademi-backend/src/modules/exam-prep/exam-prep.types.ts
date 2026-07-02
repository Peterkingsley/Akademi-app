export interface CreatePlanRequest {
  course_code: string;
  exam_date: string;
  assessment_type?: "TEST" | "EXAM";
  duration_minutes?: number;
  objective_question_count?: number;
  theory_question_count?: number;
}

export interface ProgressUpdateRequest {
  taskId: string;
  completed: boolean;
}

export interface SubmitMockRequest {
  answers: { questionId: string; answer: string }[];
}
