import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions, CameraType, FlashMode } from "expo-camera";
import { ArrowLeft, Zap, RefreshCw, Circle } from "lucide-react-native";
import { Screen } from "../../components/layout/Screen";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

const { width, height } = Dimensions.get("window");

export const CameraScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [lastImage, setLastImage] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      if (!permission) {
        await requestPermission();
      }
    })();
  }, [permission]);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: "center", color: "white" }}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
          <Text style={{ color: "white" }}>Grant Permission</Text>
        </TouchableOpacity>
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
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, typography.h3]}>Capture Question</Text>
            <TouchableOpacity onPress={toggleFlash} style={styles.headerBtn}>
              <Zap size={24} color={flash === "on" ? colors.warning : "#FFFFFF"} />
            </TouchableOpacity>
          </View>

          <View style={styles.viewfinderContainer}>
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={[styles.alignText, typography.bodySmall]}>Align your question here</Text>
          </View>

          <View style={styles.instructionBanner}>
            <Text style={[styles.instructionText, typography.mono]}>
              ✏️ HOLD 20CM AWAY FOR CLEAREST TEXT
            </Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={pickImage} style={styles.thumbnail}>
              {lastImage ? (
                <View style={styles.lastImagePlaceholder} />
              ) : (
                <View style={styles.lastImagePlaceholder} />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={takePicture} style={styles.shutterOuter}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleCameraFacing} style={styles.flipBtn}>
              <RefreshCw size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  permissionBtn: {
    marginTop: 20,
    padding: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignSelf: "center",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "space-between",
    paddingVertical: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  viewfinderContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  viewfinder: {
    width: width * 0.8,
    height: width * 0.8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderStyle: "dashed",
    borderRadius: 24,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: colors.primary,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 24,
  },
  alignText: {
    color: colors.textSecondary,
    marginTop: 16,
  },
  instructionBanner: {
    backgroundColor: colors.warning,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "center",
  },
  instructionText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 12,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#333",
  },
  lastImagePlaceholder: {
    flex: 1,
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
  },
  flipBtn: {
    padding: 8,
  },
});
