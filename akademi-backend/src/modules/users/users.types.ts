export interface UpdateProfileRequest {
  name?: string;
  university?: string;
  faculty?: string;
  department?: string;
  level?: number;
  push_token?: string;
  courses?: string[];
  date_of_birth?: string;
}

export interface AcademicCourseInput {
  code: string;
  name?: string | null;
  level?: number;
  semester?: number;
  semester_start?: string;
  semester_end?: string;
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
  university: string | null;
  faculty: string | null;
  department: string | null;
  level: number | null;
  needs_onboarding: boolean;
  profile_photo_url: string | null;
  created_at: Date;
  updated_at: Date;
  date_of_birth: Date | null;
}

export interface DeviceResponse {
  id: string;
  device_name: string;
  device_type: string;
  created_at: Date;
}
