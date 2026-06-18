import { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Onboarding: undefined;
  Register: {
    university: string;
    faculty: string;
    department: string;
    level: string;
    semester: number;
    semesterStart: string;
    semesterEnd: string;
    selectedCourses?: string[];
    academicCourses?: Array<{
      code: string;
      name?: string | null;
      level: number;
      semester: number;
    }>;
  };
  UniversityPicker: undefined;
  DepartmentPicker: { universityId: string; universityName: string };
  CoursePicker: {
    universityId: string;
    departmentId: string;
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
  PrivacyData: undefined;
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
  AdminTournaments: undefined;
  AdminTournamentCreate: undefined;
  AdminTournamentCampaigns: undefined;
  AdminTournamentRooms: undefined;
  AdminTeam: undefined;
  AdminWaitlist: undefined;
  AuditTrail: undefined;
  SecuritySettings: undefined;
  UserManagement: undefined;
  AdminUserDetail: { userId: string };
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
  ChallengeResult: { sessionId: string };
  Camera: undefined;
  CropConfirm: { imageUri: string };
  AIProcessing: { type: "assignment" | "tutor"; sessionId?: string; reply_mode?: string };
  BoardReplay: { sessionId: string };
  LiveTutorEntry: {
    courseCode?: string;
    topic?: string;
    materialId?: string;
    materialTitle?: string;
    materialContext?: string;
  } | undefined;
  LiveTutorSession: { sessionId: string };
  TutorSessionSummary: { sessionId: string };
  ExamPrep: undefined;
  AddExam: undefined;
  AcademicTimeline: undefined;
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
  CompetitionHub: undefined;
  CompetitionMatches: undefined;
  CompetitionJoinCode: undefined;
  CompetitionLeaderboard: undefined;
  TournamentDetail: { tournamentId: string };
  CreateCompetition: undefined;
  CompetitionLobby: { roomId: string };
  CompetitionResult: {
    roomId: string;
    winnerUserId?: string | null;
    scoreboard: Array<{
      user_id: string;
      name: string;
      score: number;
      correct_answers: number;
      wrong_answers: number;
      hasAnsweredCurrent: boolean;
    }>;
  };
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
  Admin: NavigatorScreenParams<AdminStackParamList>;
};
