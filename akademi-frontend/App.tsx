import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Screen } from './src/components/layout/Screen';
import { Button } from './src/components/ui/Button';
import { Input } from './src/components/ui/Input';
import { Card } from './src/components/ui/Card';
import { Badge } from './src/components/ui/Badge';
import { ProgressBar } from './src/components/ui/ProgressBar';
import { AIInsightBanner } from './src/components/ui/AIInsightBanner';
import { colors } from './src/theme/colors';

export default function App() {
  const [inputValue, setInputValue] = React.useState('');

  return (
    <Screen headerTitle="Design System" scrollable>
      <View style={styles.section}>
        <Card elevated>
          <AIInsightBanner text="Welcome to the Akademi Design System. These components are built for consistency and speed." />
        </Card>
      </View>

      <View style={styles.section}>
        <Card>
          <Input
            label="Email Address"
            placeholder="jules@akademi.edu.ng"
            value={inputValue}
            onChangeText={setInputValue}
          />
          <Button label="Primary Button" onPress={() => {}} />
          <Button
            label="Secondary Button"
            variant="secondary"
            onPress={() => {}}
            style={{ marginTop: 12 }}
          />
          <Button
            label="Ghost Button"
            variant="ghost"
            onPress={() => {}}
            style={{ marginTop: 12 }}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Card style={styles.row}>
          <Badge label="Verified" variant="verified" />
          <Badge label="Pending" variant="pending" style={{ marginLeft: 8 }} />
          <Badge label="AI Powered" variant="ai" style={{ marginLeft: 8 }} />
        </Card>
      </View>

      <View style={styles.section}>
        <Card>
          <ProgressBar progress={65} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
