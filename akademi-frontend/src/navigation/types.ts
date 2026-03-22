import { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Onboarding: undefined;
  Register: undefined;
  UniversityPicker: undefined;
  DepartmentPicker: { universityId?: string };
  CoursePicker: { departmentId?: string };
  EmailVerification: { email?: string };
  SetupComplete: undefined;
  Login: undefined;
  ForgotPassword: { email?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Solve: undefined;
  Library: undefined;
  Insights: undefined;
};

export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  AssignmentResult: { assignmentId: string };
  StudyMode: { materialId: string };
  Camera: undefined;
  CropConfirm: { imageUri: string };
  AIProcessing: { type: "assignment" | "tutor" };
  LiveTutorEntry: undefined;
  LiveTutorSession: { sessionId: string };
  TutorSessionSummary: { sessionId: string };
  ExamPrep: undefined;
  AddExam: undefined;
  PrepPlan: { examId: string };
  MockExam: { examId: string };
  MockExamResults: { examId: string };
  Sessions: undefined;
  Progress: undefined;
  Achievements: undefined;
  Profile: undefined;
  Subscription: undefined;
  NotificationsSettings: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};
