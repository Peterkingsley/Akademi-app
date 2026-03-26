import sys

file_path = 'akademi-frontend/src/screens/auth/OnboardingScreen.tsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

# Line numbers are 1-based.
# 127:          <View style={styles.slide2Content}>
# 151:          </View>

# Replace line 127
lines[126] = '          <ScrollView style={styles.slide2Content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>\n'

# Replace line 151
lines[150] = '          </ScrollView>\n'

with open(file_path, 'w') as f:
    f.writelines(lines)
print("Updated OnboardingScreen.tsx using line numbers")
