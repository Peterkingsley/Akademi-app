import sys

file_path = 'akademi-frontend/src/screens/main/LiveTutorEntryScreen.tsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

# Remove renderHeader function
# starts around 74, ends around 84
start_render = -1
end_render = -1
for i, line in enumerate(lines):
    if 'const renderHeader = () => (' in line:
        start_render = i
    if start_render != -1 and '  );' in line and i > start_render:
        end_render = i
        break

if start_render != -1 and end_render != -1:
    print(f"Removing renderHeader from {start_render} to {end_render}")
    # Remove these lines
    del lines[start_render:end_render+2] # +2 to include the empty line after it if any

# Remove {renderHeader()} call
# around 157 (now shifted)
for i, line in enumerate(lines):
    if '{renderHeader()}' in line:
        print(f"Removing call at {i}")
        del lines[i]
        break

# Adjust paddingTop in styles.container
# around 202
for i, line in enumerate(lines):
    if 'container: {' in line:
        for j in range(i+1, i+10):
            if 'padding: 20,' in lines[j]:
                print(f"Adjusting padding at {j}")
                lines[j] = '    padding: 20,\n    paddingTop: 10,\n'
                break

with open(file_path, 'w') as f:
    f.writelines(lines)
