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

# Correct ExamPrepScreen styles
replace_in_file('akademi-frontend/src/screens/main/ExamPrepScreen.tsx', [
    ('style={[styles.actionBtn, !mockActive && styles.disabledBtn]}', 'style={StyleSheet.flatten([styles.actionBtn, !mockActive ? styles.disabledBtn : undefined])}')
])

# Correct PrepPlanScreen styles
replace_in_file('akademi-frontend/src/screens/main/PrepPlanScreen.tsx', [
    ('style={[styles.mockBtn, plan.readinessScore < 60 && styles.disabledBtn]}', 'style={StyleSheet.flatten([styles.mockBtn, plan.readinessScore < 60 ? styles.disabledBtn : undefined])}')
])
