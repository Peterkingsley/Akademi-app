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

# Correct MaterialCard forwardRef
replace_in_file('akademi-frontend/src/components/ui/MaterialCard.tsx', [
    ('React.forwardRef<type TouchableOpacity, MaterialCardProps>', 'React.forwardRef<TouchableOpacity, MaterialCardProps>')
])

# Correct HomeScreen StyleSheet.flatten
replace_in_file('akademi-frontend/src/screens/main/HomeScreen.tsx', [
    ('style={StyleSheet.flatten([styles.recCard, { borderLeftWidth: 3, borderLeftColor: item.color }]) onPress',
     'style={StyleSheet.flatten([styles.recCard, { borderLeftWidth: 3, borderLeftColor: item.color }])} onPress')
])
