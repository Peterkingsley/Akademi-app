import React from "react";
import {
  createStackNavigator,
  CardStyleInterpolators,
} from "@react-navigation/stack";
import { MainStackParamList } from "./types";
import { MainTabs } from "./MainTabs";
import { AssignmentResultScreen } from "../screens/main/AssignmentResultScreen";
import { StudyModeScreen } from "../screens/main/StudyModeScreen";
import { CameraScreen } from "../screens/main/CameraScreen";
import { CropConfirmScreen } from "../screens/main/CropConfirmScreen";
import { AIProcessingScreen } from "../screens/main/AIProcessingScreen";
import { LiveTutorEntryScreen } from "../screens/main/LiveTutorEntryScreen";
import { LiveTutorSessionScreen } from "../screens/main/LiveTutorSessionScreen";
import { TutorSessionSummaryScreen } from "../screens/main/TutorSessionSummaryScreen";
import { ExamPrepScreen } from "../screens/main/ExamPrepScreen";
import { AddExamScreen } from "../screens/main/AddExamScreen";
import { PrepPlanScreen } from "../screens/main/PrepPlanScreen";
import { MockExamScreen } from "../screens/main/MockExamScreen";
import { MockExamResultsScreen } from "../screens/main/MockExamResultsScreen";
import { SessionsScreen } from "../screens/main/SessionsScreen";
import { ProgressScreen } from "../screens/main/ProgressScreen";
import { AchievementsScreen } from "../screens/main/AchievementsScreen";
import { ProfileScreen } from "../screens/main/ProfileScreen";
import { SubscriptionScreen } from "../screens/main/SubscriptionScreen";
import { NotificationsSettingsScreen } from "../screens/main/NotificationsSettingsScreen";

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
      <Stack.Screen name="PrepPlan" component={PrepPlanScreen} />
      <Stack.Screen name="MockExam" component={MockExamScreen} />
      <Stack.Screen name="MockExamResults" component={MockExamResultsScreen} />
      <Stack.Screen name="Sessions" component={SessionsScreen} />
      <Stack.Screen name="Progress" component={ProgressScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
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
    </Stack.Navigator>
  );
};
