import { ReplyMode, SessionType } from '@prisma/client';
import prisma from '../../config/db';

export async function orchestrateAIResponse(
  userId: string,
  sessionId: string,
  content: string,
  replyMode: ReplyMode | null
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) throw new Error('Session not found');

  // Fetch context layers
  const learningProfile = await prisma.learningProfile.findUnique({
    where: { user_id: userId },
  });

  const communityPatterns = await prisma.communityPattern.findMany({
    where: {
      department: session.department,
      course_code: session.course_code,
    },
  });

  const disciplineDocs = await prisma.disciplineDocument.findMany({
    where: {
      department: session.department,
      course_code: session.course_code,
      is_active: true,
    },
  });

  // Call Claude (mocked for now)
  const response = `Mock response based on context:
Learning Profile: ${JSON.stringify(learningProfile)}
Community Patterns count: ${communityPatterns.length}
Discipline Docs count: ${disciplineDocs.length}
Input: ${content}
Reply Mode: ${replyMode}`;

  return response;
}
