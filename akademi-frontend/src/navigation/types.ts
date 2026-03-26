import { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Onboarding: undefined;
  Register: {
    university: string;
    faculty: string;
    department: string;
    level: string;
  };
  UniversityPicker: undefined;
  DepartmentPicker: { university: string };
  CoursePicker: {
    university: string;
    faculty: string;
    department: string;
    level: string;
  };
  EmailVerification: { email?: string };
  SetupComplete: undefined;
  Login: undefined;
  ForgotPassword: { email?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Solve: undefined;
  Library: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  AssignmentResult: { assignmentId: string };
  StudyMode: { materialId: string };
  Socratic: { sessionId: string };
  ChallengeResult: { sessionId: string };
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
  Subscription: undefined;
  NotificationsSettings: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};
