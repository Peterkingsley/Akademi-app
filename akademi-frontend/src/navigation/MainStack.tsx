import React from "react";
import {
  createStackNavigator,
  CardStyleInterpolators,
} from "@react-navigation/stack";
import { MainStackParamList } from "./types";
import { MainTabs } from "./MainTabs";
import { SessionsTabs } from "./SessionsTabs";
import { AssignmentResultScreen } from "../screens/main/AssignmentResultScreen";
import { StudyModeScreen } from "../screens/main/StudyModeScreen";
import { MaterialPracticeScreen } from "../screens/main/MaterialPracticeScreen";
import { SocraticScreen } from "../screens/main/SocraticScreen";
import { ChallengeResultScreen } from "../screens/main/ChallengeResultScreen";
import { CameraScreen } from "../screens/main/CameraScreen";
import { CropConfirmScreen } from "../screens/main/CropConfirmScreen";
import { AIProcessingScreen } from "../screens/main/AIProcessingScreen";
import { LiveTutorEntryScreen } from "../screens/main/LiveTutorEntryScreen";
import { LiveTutorSessionScreen } from "../screens/main/LiveTutorSessionScreen";
import { TutorSessionSummaryScreen } from "../screens/main/TutorSessionSummaryScreen";
import { ExamPrepScreen } from "../screens/main/ExamPrepScreen";
import { AddExamScreen } from "../screens/main/AddExamScreen";
import { PrepPlanScreen } from "../screens/main/PrepPlanScreen";
import { AcademicTimelineScreen } from "../screens/main/AcademicTimelineScreen";
import { MockExamScreen } from "../screens/main/MockExamScreen";
import { MockExamResultsScreen } from "../screens/main/MockExamResultsScreen";
import { SubscriptionScreen } from "../screens/main/SubscriptionScreen";
import { NotificationsSettingsScreen } from "../screens/main/NotificationsSettingsScreen";
import { NotificationsScreen } from "../screens/main/NotificationsScreen";
import { EditAcademicDetailsScreen } from "../screens/main/EditAcademicDetailsScreen";
import { MyCoursesScreen } from "../screens/main/MyCoursesScreen";
import { MyUploadsScreen } from "../screens/main/MyUploadsScreen";
import { OfflineDownloadsScreen } from "../screens/main/OfflineDownloadsScreen";
import { AppLanguageScreen } from "../screens/main/AppLanguageScreen";
import { AppearanceSettingsScreen } from "../screens/main/AppearanceSettingsScreen";
import { ChangePasswordScreen } from "../screens/main/ChangePasswordScreen";
import { PrivacyDataScreen } from "../screens/main/PrivacyDataScreen";
import { HelpSupportScreen } from "../screens/main/HelpSupportScreen";
import { RateAkademiScreen } from "../screens/main/RateAkademiScreen";
import { AchievementsScreen } from "../screens/main/AchievementsScreen";
import { SessionDetailScreen } from "../screens/main/SessionDetailScreen";
import { ProgressScreen } from "../screens/main/ProgressScreen";

const Stack = createStackNavigator<MainStackParamList>();

export const MainStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="AssignmentResult"
        component={AssignmentResultScreen}
      />
      <Stack.Screen name="StudyMode" component={StudyModeScreen} />
      <Stack.Screen name="MaterialPractice" component={MaterialPracticeScreen} />
      <Stack.Screen name="Socratic" component={SocraticScreen} />
      <Stack.Screen name="ChallengeResult" component={ChallengeResultScreen} />
      <Stack.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      <Stack.Screen name="CropConfirm" component={CropConfirmScreen} />
      <Stack.Screen name="AIProcessing" component={AIProcessingScreen} />
      <Stack.Screen name="LiveTutorEntry" component={LiveTutorEntryScreen} />
      <Stack.Screen
        name="LiveTutorSession"
        component={LiveTutorSessionScreen}
      />
      <Stack.Screen
        name="TutorSessionSummary"
        component={TutorSessionSummaryScreen}
      />
      <Stack.Screen name="ExamPrep" component={ExamPrepScreen} />
      <Stack.Screen name="AddExam" component={AddExamScreen} />
      <Stack.Screen name="AcademicTimeline" component={AcademicTimelineScreen} />
      <Stack.Screen name="PrepPlan" component={PrepPlanScreen} />
      <Stack.Screen name="MockExam" component={MockExamScreen} />
      <Stack.Screen name="MockExamResults" component={MockExamResultsScreen} />
      <Stack.Screen name="Sessions" component={SessionsTabs} />
      <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
      <Stack.Screen name="Progress" component={ProgressScreen} />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      <Stack.Screen
        name="NotificationsSettings"
        component={NotificationsSettingsScreen}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="EditAcademicDetails" component={EditAcademicDetailsScreen} />
      <Stack.Screen name="MyCourses" component={MyCoursesScreen} />
      <Stack.Screen name="MyUploads" component={MyUploadsScreen} />
      <Stack.Screen name="OfflineDownloads" component={OfflineDownloadsScreen} />
      <Stack.Screen name="AppLanguage" component={AppLanguageScreen} />
      <Stack.Screen name="AppearanceSettings" component={AppearanceSettingsScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="PrivacyData" component={PrivacyDataScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="RateAkademi" component={RateAkademiScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
    </Stack.Navigator>
  );
};
