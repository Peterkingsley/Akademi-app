export interface UniversityResponse {
  id: string;
  name: string;
  location: string | null;
}

export interface DepartmentResponse {
  id: string;
  name: string;
  faculty: string;
}
