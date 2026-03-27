import React, { useCallback } from "react";
import { StyleSheet } from "react-native";
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { colors } from "../../theme/colors";

interface BottomSheetProps {
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  onClose?: () => void;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  children,
  snapPoints = ["25%", "50%", "90%"],
  index = -1,
  onClose,
}) => {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  return (
    <GorhomBottomSheet
      index={index}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </BottomSheetScrollView>
    </GorhomBottomSheet>
  );
};

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
  },
  handle: {
    backgroundColor: "#374151",
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  content: {
    paddingBottom: 40,
  },
});