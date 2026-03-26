import sys

file_path = 'akademi-frontend/src/screens/main/ProfileScreen.tsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if 'return (' in line and i < len(lines)-1 and '<Screen' in lines[i+1]:
        new_lines.append(line)
        new_lines.append('      <Screen\n')
        new_lines.append('        hideHeader\n')
        new_lines.append('        scrollable\n')
        new_lines.append('        style={{ flex: 1 }}\n')
        new_lines.append('      >\n')
        skip = True
        continue

    if skip:
        if '<ScrollView' in line:
            new_lines.append(line)
            skip = False
        continue

    # Fix the loading screen Screen call too
    if '<Screen style={styles.loadingContainer}>' in line:
        new_lines.append('      <Screen hideHeader style={styles.loadingContainer}>\n')
        continue

    new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
