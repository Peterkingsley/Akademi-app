import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions, CameraType, FlashMode } from "expo-camera";
import { ArrowLeft, Zap, RefreshCw, Image as ImageIcon, Sparkles } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { AnimatedPressable } from "../../components/ui/AnimatedPressable";

const { width } = Dimensions.get("window");
const VIEWFINDER_SIZE = width * 0.8;

export const CameraScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const cameraRef = useRef<any>(null);

  const laserAnim = useSharedValue(0);
  const breathAnim = useSharedValue(1);

  useEffect(() => {
    laserAnim.value = withRepeat(
      withSequence(
        withTiming(VIEWFINDER_SIZE - 2, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    breathAnim.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laserAnim.value }],
  }));
  const cornerStyle = useAnimatedStyle(() => ({
    opacity: breathAnim.value,
  }));

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={[typography.h3, styles.permissionTitle]}>Camera Access Needed</Text>
        <Text style={[typography.body, styles.permissionText]}>
          Akademi needs your camera to scan questions and solve them.
        </Text>
        <AnimatedPressable onPress={requestPermission} style={styles.permissionBtn}>
          <Text style={[typography.body, styles.permissionBtnText]}>Enable Camera</Text>
        </AnimatedPressable>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  const toggleFlash = () => {
    setFlash((current) => (current === "off" ? "on" : "off"));
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        navigation.navigate("CropConfirm", { imageUri: photo.uri });
      } catch (e) {
        console.error("Failed to take picture", e);
      }
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      navigation.navigate("CropConfirm", { imageUri: result.assets[0].uri });
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        flash={flash}
        ref={cameraRef}
        animateShutter={false}
      >
        <View style={StyleSheet.absoluteFillObject}>
          {/* HEADER (Frosted) */}
          <BlurView 
            intensity={80} 
            tint="dark" 
            style={[styles.headerBlur, { paddingTop: Math.max(insets.top, 16) }]}
          >
            <View style={styles.headerInner}>
              <AnimatedPressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <ArrowLeft size={24} color="#FFFFFF" />
              </AnimatedPressable>
              <View style={styles.headerTitleWrap}>
                <Sparkles size={16} color={colors.primary} />
                <Text style={[styles.headerTitle, typography.h4]}>AI Scanner</Text>
              </View>
              <AnimatedPressable onPress={toggleFlash} style={styles.iconBtn}>
                <Zap size={24} color={flash === "on" ? colors.warning : "#FFFFFF"} />
              </AnimatedPressable>
            </View>
          </BlurView>

          {/* VIEWFINDER AREA */}
          <View style={styles.viewfinderContainer}>
            <View style={styles.viewfinder}>
              {/* Pulsing Corners */}
              <Animated.View style={[styles.corner, styles.topLeft, cornerStyle]} />
              <Animated.View style={[styles.corner, styles.topRight, cornerStyle]} />
              <Animated.View style={[styles.corner, styles.bottomLeft, cornerStyle]} />
              <Animated.View style={[styles.corner, styles.bottomRight, cornerStyle]} />
              
              {/* Laser Line */}
              <Animated.View style={[styles.laser, laserStyle]}>
                <View style={styles.laserGlow} />
              </Animated.View>
            </View>

            {/* Smart Status Pill */}
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={[styles.statusText, typography.caption]}>Point at a math problem...</Text>
            </View>
          </View>

          {/* FOOTER (Frosted) */}
          <BlurView 
            intensity={90} 
            tint="dark" 
            style={[styles.footerBlur, { paddingBottom: Math.max(insets.bottom, 24) }]}
          >
            <View style={styles.footerInner}>
              <AnimatedPressable onPress={pickImage} style={styles.sideBtn}>
                <ImageIcon size={26} color="#FFFFFF" />
              </AnimatedPressable>

              <AnimatedPressable onPress={takePicture} style={styles.shutterOuter}>
                <View style={styles.shutterInner} />
              </AnimatedPressable>

              <AnimatedPressable onPress={toggleCameraFacing} style={styles.sideBtn}>
                <RefreshCw size={26} color="#FFFFFF" />
              </AnimatedPressable>
            </View>
          </BlurView>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  permissionTitle: {
    color: "#FFF",
    marginBottom: 12,
  },
  permissionText: {
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: "#FFF",
    fontWeight: "600",
  },
  camera: {
    flex: 1,
  },
  headerBlur: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  viewfinderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 24,
  },
  laser: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  laserGlow: {
    position: "absolute",
    top: -4,
    bottom: -4,
    left: 0,
    right: 0,
    backgroundColor: colors.primary,
    opacity: 0.3,
    borderRadius: 4,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  footerBlur: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  footerInner: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  sideBtn: {
    width: 52,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
  },
});
