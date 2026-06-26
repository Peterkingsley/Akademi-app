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
  "expo-font",
  "expo-asset",
  "@react-native-community/datetimepicker",
];

// Sentry native upload is temporarily disabled because the Android EAS build
// is failing during Sentry Gradle upload.
// Re-enable after confirming SENTRY_ORG, SENTRY_PROJECT, and SENTRY_AUTH_TOKEN.

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