import sys

file_path = './akademi-frontend/src/screens/main/WhiteboardTutorScreen.tsx'
with open(file_path, 'r') as f:
    content = f.read()

search_text = """    try {
      const newLesson = await sessionService.generateTeaching(sessionId, inputText);
      setSegments(newLesson.segments);
      setCurrentSegmentIndex(0);"""

replace_text = """    try {
      const newLesson = await sessionService.generateTeaching(sessionId, inputText);
      setSegments(newLesson);
      setCurrentSegmentIndex(0);"""

if search_text in content:
    new_content = content.replace(search_text, replace_text)
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Successfully edited WhiteboardTutorScreen.tsx")
else:
    print("Could not find search text in WhiteboardTutorScreen.tsx")
    sys.exit(1)
