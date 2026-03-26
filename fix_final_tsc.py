import os
import re

def replace_in_file(filepath, replacements):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        content = f.read()

    new_content = content
    for old, new in replacements:
        new_content = new_content.replace(old, new)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

# Fix MaterialCard
replace_in_file('akademi-frontend/src/components/ui/MaterialCard.tsx', [
    ('TouchableOpacity,', 'type TouchableOpacity,'),
])

# Fix HomeScreen
replace_in_file('akademi-frontend/src/screens/main/HomeScreen.tsx', [
    ('style={[styles.recCard, { borderLeftWidth: 3, borderLeftColor: item.color }]}',
     'style={StyleSheet.flatten([styles.recCard, { borderLeftWidth: 3, borderLeftColor: item.color }])')
])

# Fix ChallengeResultScreen
replace_in_file('akademi-frontend/src/screens/main/ChallengeResultScreen.tsx', [
    ('style={[styles.statCard, { borderLeftColor: colors.success }]}',
     'style={StyleSheet.flatten([styles.statCard, { borderLeftColor: colors.success }])'),
    ('style={[styles.statCard, { borderLeftColor: colors.primary }]}',
     'style={StyleSheet.flatten([styles.statCard, { borderLeftColor: colors.primary }])'),
    ('style={[styles.statCard, { borderLeftColor: colors.accentPurple }]}',
     'style={StyleSheet.flatten([styles.statCard, { borderLeftColor: colors.accentPurple }])')
])

# Fix ExamPrepScreen
replace_in_file('akademi-frontend/src/screens/main/ExamPrepScreen.tsx', [
    ('style={[styles.tabContent, isActive ? { flex: 1 } : { opacity: 0 }]}',
     'style={StyleSheet.flatten([styles.tabContent, isActive ? { flex: 1 } : { opacity: 0 }])'),
    ('size="small"', '')
])

# Fix PrepPlanScreen
replace_in_file('akademi-frontend/src/screens/main/PrepPlanScreen.tsx', [
    ('style={[styles.tabContent, isActive ? { flex: 1 } : { opacity: 0 }]}',
     'style={StyleSheet.flatten([styles.tabContent, isActive ? { flex: 1 } : { opacity: 0 }])')
])

# Fix MockExamResultsScreen
replace_in_file('akademi-frontend/src/screens/main/MockExamResultsScreen.tsx', [
    ('ExpoLinearGradient', 'LinearGradient'),
    ('iconPosition="left"', '')
])

# Fix MockExamScreen
replace_in_file('akademi-frontend/src/screens/main/MockExamScreen.tsx', [
    ('iconPosition="left"', '')
])
