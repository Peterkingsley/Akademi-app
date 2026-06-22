import sys

file_path = './akademi-backend/src/modules/sessions/sessions.controller.ts'
with open(file_path, 'r') as f:
    content = f.read()

search_text_1 = """  async getPlayableLesson(req: Request, res: Response) {
    try {
      const lesson = await sessionsService.getPlayableLesson(req.params.id);
      res.status(200).json(lesson);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }"""

replace_text_1 = """  async getPlayableLesson(req: Request, res: Response) {
    try {
      const lesson = await sessionsService.getPlayableLesson(req.params.id);
      res.status(200).json(lesson);
    } catch (error: any) {
      res.status(statusForError(error, 500)).json({ message: error.message });
    }
  }"""

search_text_2 = """  async generateTeaching(req: Request, res: Response) {
    try {
      const lesson = await aiService.generateTeachingLesson(
        req.user!.userId,
        req.params.id,
        req.body.studentMessage,
        req.body.materialContext
      );
      res.status(200).json(lesson);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }"""

replace_text_2 = """  async generateTeaching(req: Request, res: Response) {
    try {
      const lesson = await aiService.generateTeachingLesson(
        req.user!.userId,
        req.params.id,
        req.body.studentMessage,
        req.body.materialContext
      );
      res.status(200).json(lesson);
    } catch (error: any) {
      res.status(statusForError(error, 500)).json({ message: error.message });
    }
  }"""

if search_text_1 in content and search_text_2 in content:
    new_content = content.replace(search_text_1, replace_text_1).replace(search_text_2, replace_text_2)
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Successfully edited sessions.controller.ts")
else:
    print("Could not find search texts in sessions.controller.ts")
    sys.exit(1)
