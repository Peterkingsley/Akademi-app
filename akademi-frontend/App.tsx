import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from './src/theme/colors';
import { typography } from './src/theme/typography';
import { Screen } from './src/components/layout/Screen';
import { Button } from './src/components/ui/Button';

export default function App() {
  return (
    <Screen title="Akademi Design System">
      <View style={styles.container}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>
          Learn Deeper.
        </Text>
        <Text style={[typography.h2, { color: colors.primary }]}>
          Go Further.
        </Text>
        <View style={styles.section}>
          <Button label="Primary Button" onPress={() => {}} />
          <View style={{ height: 16 }} />
          <Button label="Secondary Button" variant="secondary" onPress={() => {}} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  section: {
    marginTop: 32,
  },
});
