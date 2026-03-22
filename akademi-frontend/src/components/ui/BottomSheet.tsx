import React, { useMemo, useCallback, forwardRef } from 'react';
import { View, StyleSheet, Text, ViewStyle } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetBackdropProps
} from '@gorhom/bottom-sheet';
import { colors } from '../../theme/colors';

interface BottomSheetProps {
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  onClose?: () => void;
  index?: number;
}

export type CustomBottomSheetRef = BottomSheet;

export const CustomBottomSheet = forwardRef<BottomSheet, BottomSheetProps>(({
  children,
  snapPoints = ['25%', '50%', '90%'],
  onClose,
  index = -1,
}, ref) => {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1 && onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <BottomSheet
      ref={ref}
      index={index}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={styles.content}>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    backgroundColor: '#374151',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
  },
  content: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.surface,
  },
});
