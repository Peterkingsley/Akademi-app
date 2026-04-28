import sys

with open('akademi-frontend/src/screens/main/SolveScreen.tsx', 'r') as f:
    content = f.read()

# Fix the specific mess I made
content = content.replace('        </View>\n        />\n      </BottomSheet>', '        />\n      </View>\n      </BottomSheet>')

with open('akademi-frontend/src/screens/main/SolveScreen.tsx', 'w') as f:
    f.write(content)
