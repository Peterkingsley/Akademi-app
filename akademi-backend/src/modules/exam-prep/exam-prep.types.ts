export interface CreatePlanRequest {
  course_code: string;
  exam_date: string;
}

export interface ProgressUpdateRequest {
  taskId: string;
  completed: boolean;
}

export interface SubmitMockRequest {
  answers: { questionId: string; answer: string }[];
}
