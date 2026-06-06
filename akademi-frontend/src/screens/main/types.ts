export interface Session {
  id: string;
  user_id: string;
  title?: string;
  type?: string;
  session_type?: string;
  course_code?: string;
  topic?: string | null;
  duration?: number | null;
  started_at?: string;
  ended_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface LearningProfile {
  id: string;
  user_id: string;
  session_count: number;
  subject_weaknesses: string[];
  last_activity?: string;
}

export interface PrepTask {
  id: string;
  plan_id: string;
  title: string;
  description: string;
  due_date: string;
  completed: boolean;
  completed_at?: string;
}

export interface ExamPrepPlan {
  id: string;
  user_id: string;
  course_code: string;
  exam_date: string;
  tasks?: PrepTask[];
}

export interface Recommendation {
  id: string;
  title: string;
  type: 'weakness' | 'material' | 'exam';
  description: string;
  metadata: {
    duration?: string;
    sections?: number;
    course_code?: string;
  };
  color: string;
}
