const plugins = [
  [
    "expo-camera",
    {
      cameraPermission: "Allow Akademi to access your camera to capture assignment questions.",
    },
  ],
  [
    "expo-image-picker",
    {
      photosPermission: "Allow Akademi to access your photos.",
    },
  ],
  [
    "expo-av",
    {
      microphonePermission: "Allow Akademi to capture your spoken assignment questions.",
    },
  ],
  [
    "expo-speech-recognition",
    {
      microphonePermission: "Allow Akademi to listen while you speak to the AI Tutor.",
      speechRecognitionPermission: "Allow Akademi to convert your speech into live text for the AI Tutor.",
      androidSpeechServicePackages: ["com.google.android.googlequicksearchbox", "com.google.android.as"],
    },
  ],
  "expo-font",
  "expo-asset",
  "@react-native-community/datetimepicker",
];

if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
  plugins.push([
    "@sentry/react-native/expo",
    {
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      url: process.env.SENTRY_URL || "https://sentry.io/",
    },
  ]);
} else {
  plugins.push("@sentry/react-native");
}

module.exports = {
  expo: {
    name: "Akademi",
    slug: "akademiapp",
    owner: "akademiapp21",
    scheme: "akademi",
    version: "1.0.0",
    newArchEnabled: true,
    platforms: ["ios", "android", "web"],
    orientation: "portrait",
    icon: "./assets/akademi-logo-icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/akademi-logo-icon.png",
      resizeMode: "contain",
      backgroundColor: "#000000",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.akademi.app",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "Used to capture assignment questions",
        NSMicrophoneUsageDescription: "Allow Akademi to capture your spoken assignment questions.",
        NSSpeechRecognitionUsageDescription: "Allow Akademi to convert your speech into live text for the AI Tutor.",
      },
    },
    android: {
      package: "com.akademi.app",
      adaptiveIcon: {
        foregroundImage: "./assets/akademi-logo-icon.png",
        backgroundColor: "#000000",
      },
      permissions: ["android.permission.CAMERA", "android.permission.RECORD_AUDIO"],
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    plugins,
    extra: {
      eas: {
        projectId: "5a830460-e300-4bbd-b702-3697ed8291be",
      },
    },
  },
};
