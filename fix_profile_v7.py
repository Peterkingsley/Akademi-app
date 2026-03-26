import sys

file_path = 'akademi-frontend/src/screens/main/ProfileScreen.tsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if i == 150: # line 151 is </Screen>
        continue
    if i == 154: # line 155 is second <Screen
        continue
    new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
