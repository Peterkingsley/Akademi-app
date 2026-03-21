import prisma from '../config/db';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';

const anthropic = new Anthropic({ apiKey: config.claudeApiKey });

export async function generateSessionSummaryJob(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: true },
  });
  if (!session) throw new Error('Session not found');

  const prompt = `Summarize the following study session.
  Messages: ${JSON.stringify(session.messages)}
  Output JSON format: { summary: string, key_points: string[], next_steps: string[] }`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: "Generate academic session summaries.",
    messages: [{ role: 'user', content: prompt }]
  });

  const summary = JSON.parse((response.content[0] as any).text);

  // Store summary (maybe in a new SessionSummary table or a field in Session)
  // For now, let's assume we update the session or log it.
  console.log('Session Summary generated:', summary);
}
