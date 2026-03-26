import os

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

# Correct MockExamResultsScreen Button props
replace_in_file('akademi-frontend/src/screens/main/MockExamResultsScreen.tsx', [
    ('iconPosition="left"', '')
])

# Correct MockExamScreen Button props
replace_in_file('akademi-frontend/src/screens/main/MockExamScreen.tsx', [
    ('iconPosition="left"', '')
])
