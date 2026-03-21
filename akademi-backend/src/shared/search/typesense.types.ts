export interface MaterialDocument {
  id: string;
  title: string;
  course_code: string;
  university: string;
  faculty: string;
  department: string;
  level: number;
  verification_status: string;
  verified_at?: number;
}

export interface QuestionDocument {
  id: string;
  question_text: string;
  course_code: string;
  department: string;
  difficulty: string;
  level: number;
}

export interface CourseDocument {
  id: string;
  course_code: string;
  department: string;
  university: string;
}

export interface UniversityDocument {
  id: string;
  name: string;
  location?: string;
}
