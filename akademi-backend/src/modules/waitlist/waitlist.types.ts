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
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  metadata?: Record<string, unknown>;
}

export interface WaitlistEventRequest {
  event_name: string;
  visitor_id: string;
  session_id?: string;
  page_url?: string;
  page_path?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  school_query?: string;
  school_name?: string;
  metadata?: Record<string, unknown>;
}
