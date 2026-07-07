import React from "react";
import {
  createStackNavigator,
  CardStyleInterpolators,
} from "@react-navigation/stack";
import { AuthStackParamList } from "./types";
import { OnboardingScreen } from "../screens/auth/OnboardingScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { UniversityPickerScreen } from "../screens/auth/UniversityPickerScreen";
import { DepartmentPickerScreen } from "../screens/auth/DepartmentPickerScreen";
import { CoursePickerScreen } from "../screens/auth/CoursePickerScreen";
import { EmailVerificationScreen } from "../screens/auth/EmailVerificationScreen";
import { SetupCompleteScreen } from "../screens/auth/SetupCompleteScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { PrivacyDataScreen } from "../screens/main/PrivacyDataScreen";

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={{
        headerShown: false,
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="PrivacyData" component={PrivacyDataScreen} />
      <Stack.Screen
        name="UniversityPicker"
        component={UniversityPickerScreen}
      />
      <Stack.Screen
        name="DepartmentPicker"
        component={DepartmentPickerScreen}
      />
      <Stack.Screen name="CoursePicker" component={CoursePickerScreen} />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
      />
      <Stack.Screen name="SetupComplete" component={SetupCompleteScreen} />
    </Stack.Navigator>
  );
};
