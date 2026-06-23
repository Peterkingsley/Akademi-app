export interface UpdateProfileRequest {
  name?: string;
  university?: string;
  faculty?: string;
  department?: string;
  level?: number;
  push_token?: string;
  courses?: string[];
}

export interface AcademicCourseInput {
  code: string;
  name?: string | null;
  level: number;
  semester: number;
  semester_start: string;
  semester_end: string;
}

export interface UpdateAcademicProfileRequest {
  university?: string;
  faculty?: string;
  department?: string;
  level?: number;
  courses?: AcademicCourseInput[];
}

export interface CourseOptionResponse {
  id: string;
  code: string;
  name?: string | null;
  level: number;
  semester: number;
  source?: string;
  usageCount?: number;
}

export interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  university: string;
  faculty: string;
  department: string;
  level: number;
  profile_photo_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DeviceResponse {
  id: string;
  device_name: string;
  device_type: string;
  created_at: Date;
}
