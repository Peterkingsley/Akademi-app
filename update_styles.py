import sys

with open('akademi-frontend/src/screens/main/SolveScreen.tsx', 'r') as f:
    content = f.read()

# Update contentContainer to include top padding and maybe use a more standard value
content = content.replace('  contentContainer: {\n    paddingHorizontal: 20,\n  },',
                         '  contentContainer: {\n    paddingHorizontal: 20,\n    paddingTop: 8,\n  },')

with open('akademi-frontend/src/screens/main/SolveScreen.tsx', 'w') as f:
    f.write(content)
