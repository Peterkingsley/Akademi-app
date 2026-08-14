import { NavigatorScreenParams } from "@react-navigation/native";

// Carried through the onboarding picker chain when a Google account was just
// created (or an existing account still needs its academic profile) so the
// tokens issued by /auth/google can be persisted once the picker flow
// finishes, instead of authenticating before onboarding is complete.
export type PendingAuth = {
  user: Record<string, any>;
  accessToken: string;
  refreshToken: string;
  adminAccessToken?: string | null;
};

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
  UniversityPicker: { pendingAuth?: PendingAuth } | undefined;
  DepartmentPicker: { universityId: string; universityName: string; pendingAuth?: PendingAuth };
  CoursePicker: {
    universityId: string;
    departmentId: string;
    university: string;
    faculty: string;
    department: string;
    level: string;
    selectedCourses?: string[];
    pendingAuth?: PendingAuth;
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
    adminAccessToken?: string | null;
  };
  Login: undefined;
  ForgotPassword: { email?: string };
  PrivacyData: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Solve: { selectedCourseCode?: string | null } | undefined;
  Library: { course_code?: string } | undefined;
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
  UploadCcmasDocument: undefined;
  DocumentDetail: { id: string };
  UploadDocument: undefined;
  PlatformAnalytics: undefined;
  FinancialManagement: undefined;
  SystemMonitoring: undefined;
  CoverageMap: undefined;
  GeneratedTextbooks: undefined;
};

export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  AITutor: undefined;
  StudyCompanion: {
    sessionId: string;
    materialTitle: string;
    courseCode: string;
  };
  SolveCoursePicker: { selectedCourseCode?: string | null } | undefined;
  AssignmentResult: { sessionId: string };
  MultiQuestionSolve: {
    sessionId: string;
    questions: Array<{ index: number; text: string }>;
  };
  StudyMode: { sessionId?: string; materialId?: string; autoOpenTutor?: boolean };
  MaterialPractice: { materialId: string; title?: string };
  ChallengeResult: { sessionId: string };
  Camera: undefined;
  CropConfirm: { imageUri: string };
  AIProcessing: { type: "assignment"; sessionId?: string; reply_mode?: string };
  BoardReplay: { sessionId: string; questionIndex?: number };
  ExamPrep: undefined;
  AddExam: { courseCode?: string };
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
  KoinWallet: undefined;
  SellKoin: undefined;
  PersonalDetails: undefined;
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
