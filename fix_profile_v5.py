import sys

file_path = 'akademi-frontend/src/screens/main/ProfileScreen.tsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if '} from "lucide-react-native";' in line:
        # Avoid duplicate imports or missing ones
        new_lines.append('  Bell, BarChart2, Clock, ChevronRight, GraduationCap, FileText, Cloud, Globe, HelpCircle, Key, Lock, LogOut, Palette, Settings, Shield, Sparkles, Star, Trash2,\n')
        new_lines.append('} from "lucide-react-native";\n')
        continue

    # We already have the heroSection buttons and styles.
    # We just need to fix the main return which got messed up.

    if i > 150 and '} from "lucide-react-native";' not in lines[i-1] and '  const academicLabel =' in line:
        # We need to insert the main return before academicLabel's use.
        # But academicLabel is defined before.
        pass

    new_lines.append(line)

# Let's just rewrite the middle part.
