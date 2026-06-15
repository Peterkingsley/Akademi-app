export interface JoinWaitlistRequest {
  full_name: string;
  email: string;
  phone?: string;
  university?: string;
  faculty?: string;
  department?: string;
  level?: number | string;
  main_struggle?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}
