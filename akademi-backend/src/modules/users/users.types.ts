export interface UpdateProfileRequest {
  name?: string;
  university?: string;
  faculty?: string;
  department?: string;
  level?: number;
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
