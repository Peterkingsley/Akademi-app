import { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Onboarding: undefined;
  Register: {
    university: string;
    faculty: string;
    department: string;
    level: string;
    selectedCourses?: string[];
  };
  UniversityPicker: undefined;
  DepartmentPicker: { universityId: string; universityName: string };
  CoursePicker: {
    university: string;
    faculty: string;
    department: string;
    level: string;
    selectedCourses?: string[];
  };
  EmailVerification: { email?: string };
  SetupComplete: {
    user: {
      id: string;
      email: string;
      name: string;
      university?: string;
      faculty?: string;
      department?: string;
      level?: number;
      courses?: string[];
      profile_photo_url?: string | null;
      is_verified?: boolean;
      admin_role?: string | null;
    };
    accessToken: string;
    refreshToken: string;
  };
  Login: undefined;
  ForgotPassword: { email?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Solve: undefined;
  Library: undefined;
  Profile: undefined;
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminMore: undefined;
  AdminTeam: undefined;
  AuditTrail: undefined;
  SecuritySettings: undefined;
  UserManagement: undefined;
  ContentModeration: undefined;
  DisciplineDocuments: undefined;
  DocumentDetail: { id: string };
  UploadDocument: undefined;
  PlatformAnalytics: undefined;
  FinancialManagement: undefined;
  SystemMonitoring: undefined;
  CoverageMap: undefined;
};

export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  AssignmentResult: { sessionId: string };
  StudyMode: { sessionId?: string; materialId?: string };
  MaterialPractice: { materialId: string; title?: string };
  Socratic: { sessionId: string };
  ChallengeResult: { sessionId: string };
  Camera: undefined;
  CropConfirm: { imageUri: string };
  AIProcessing: { type: "assignment" | "tutor"; sessionId?: string; reply_mode?: string };
  LiveTutorEntry: undefined;
  LiveTutorSession: { sessionId: string };
  TutorSessionSummary: { sessionId: string };
  ExamPrep: undefined;
  AddExam: undefined;
  PrepPlan: { examId: string };
  MockExam: { examId: string; mockExamId?: string };
  MockExamResults: { examId: string; mockExamId: string };
  Sessions: undefined;
  SessionDetail: { id: string };
  Progress: undefined;
  Achievements: undefined;
  Subscription: undefined;
  NotificationsSettings: undefined;
  Notifications: undefined;
  EditAcademicDetails: undefined;
  MyCourses: undefined;
  MyUploads: { uploadStatus?: "success" } | undefined;
  OfflineDownloads: undefined;
  AppLanguage: undefined;
  AppearanceSettings: undefined;
  ChangePassword: undefined;
  PrivacyData: undefined;
  HelpSupport: undefined;
  RateAkademi: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
  Admin: NavigatorScreenParams<AdminStackParamList>;
};
