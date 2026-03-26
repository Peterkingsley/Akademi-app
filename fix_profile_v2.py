import sys

file_path = 'akademi-frontend/src/screens/main/ProfileScreen.tsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

# Look for the return <Screen block and remove the empty lines from the previous deletion
# We want:
#   return (
#     <Screen
#       hideHeader
#       scrollable
#       style={{ flex: 1 }}
#     >

new_lines = []
skip = False
for i, line in enumerate(lines):
    if '<Screen' in line:
        new_lines.append(line)
        new_lines.append('      hideHeader\n')
        skip = True
        continue
    if skip:
        if 'scrollable' in line:
            new_lines.append(line)
            skip = False
        continue
    new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
