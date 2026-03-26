import sys

file_path = 'akademi-frontend/src/components/layout/Screen.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Add hideHeader prop to ScreenProps
old_props = '  scrollable?: boolean;\n  style?: ViewStyle;\n}'
new_props = '  scrollable?: boolean;\n  style?: ViewStyle;\n  hideHeader?: boolean;\n}'

if old_props in content:
    content = content.replace(old_props, new_props)

# Add hideHeader to destructuring
old_destructure = '  scrollable = false,\n  style,\n}) => {'
new_destructure = '  scrollable = false,\n  style,\n  hideHeader = false,\n}) => {'

if old_destructure in content:
    content = content.replace(old_destructure, new_destructure)

# Conditionally render Header
old_header = '''        <Header
          title={title}
          onBack={onBack}
          leftAction={leftAction}
          rightAction={rightAction}
        />'''

new_header = '''        {!hideHeader && (
          <Header
            title={title}
            onBack={onBack}
            leftAction={leftAction}
            rightAction={rightAction}
          />
        )}'''

if old_header in content:
    content = content.replace(old_header, new_header)

with open(file_path, 'w') as f:
    f.write(content)
print("Updated Screen.tsx")
