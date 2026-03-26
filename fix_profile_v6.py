import sys

file_path = 'akademi-frontend/src/screens/main/ProfileScreen.tsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if '  return (' in line and i > 150:
        new_lines.append('  return (\n')
        new_lines.append('    <Screen hideHeader scrollable style={{ flex: 1 }}>\n')
        continue

    if '</Screen>' in line and i > 150:
        continue # Remove misplaced </Screen>

    if '</ScrollView>' in line:
        new_lines.append('      </ScrollView>\n')
        new_lines.append('    </Screen>\n')
        continue

    new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
