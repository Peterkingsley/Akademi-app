import prisma from '../config/db';
import { aiProvider } from '../modules/ai/ai.provider';
import { notificationsService } from '../modules/notifications/notifications.service';

export async function generateSessionSummaryJob(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: true },
  });
  if (!session) throw new Error('Session not found');

  const prompt = `Summarize the following study session.
  Messages: ${JSON.stringify(session.messages)}
  Output JSON format: { summary: string, key_points: string[], next_steps: string[] }`;

  const aiOutput = await aiProvider.generateResponse(prompt, {
    systemPrompt: 'Generate academic session summaries. Return ONLY valid JSON.',
    maxTokens: 500,
  });

  const summary = JSON.parse(aiOutput);

  // Store summary (maybe in a new SessionSummary table or a field in Session)
  // For now, let's assume we update the session or log it.
  console.log('Session Summary generated:', summary);

  // Send notification to user
  await notificationsService.createNotification({
    user_id: session.user_id,
    title: 'Session Summary Ready',
    message: `Your summary for course ${session.course_code} is ready to view.`,
    type: 'success',
  });
}
