export interface SearchQuery {
  q: string;
  type?: 'material' | 'question' | 'course';
  university?: string;
  department?: string;
  course_code?: string;
  level?: number;
}
