import sys

file_path = 'akademi-frontend/src/screens/main/ProfileScreen.tsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if i == 149: # </Screen> was removed, now lines[149] is <ActivityIndicator
        new_lines.append('        <ActivityIndicator size="large" color={colors.primary} />\n')
        new_lines.append('      </Screen>\n')
        continue
    new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
