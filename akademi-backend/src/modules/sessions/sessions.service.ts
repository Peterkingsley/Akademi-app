import xss from 'xss';
import prisma from '../../config/db';
import { StartSessionRequest, SendMessageRequest } from './sessions.types';
import { SessionType, MessageRole, Feature } from '@prisma/client';
import { checkFeatureAccess } from '../../shared/utils/feature-access';
import { orchestrateAIResponse } from '../../shared/utils/ai-orchestrator';
import { updateLearningProfileJob } from '../../jobs/updateLearningProfile.job';
import { generateSessionSummaryJob } from '../../jobs/generateSessionSummary.job';

export class SessionsService {
  private mapSessionTypeToFeature(type: SessionType): Feature {
    switch (type) {
      case SessionType.ASSIGNMENT:
        return Feature.ASSIGNMENT_SOLVING;
      case SessionType.TUTOR:
        return Feature.LIVE_TUTORING;
      case SessionType.EXAM_PREP:
        return Feature.EXAM_PREP;
      case SessionType.STUDY:
      default:
        // Assuming STUDY mode is free as per the monetization table in Ticket-00
        return Feature.ASSIGNMENT_SOLVING;
    }
  }

  async startSession(userId: string, data: StartSessionRequest) {
    // Free check for Study Mode (as per monetization table)
    if (data.session_type !== SessionType.STUDY) {
        const feature = this.mapSessionTypeToFeature(data.session_type);
        const hasAccess = await checkFeatureAccess(userId, feature);
        if (!hasAccess) {
          throw new Error(`You do not have access to the ${feature} feature. Please purchase a plan.`);
        }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { university: true, department: true },
    });

    if (!user) throw new Error('User not found');

    return prisma.session.create({
      data: {
        user_id: userId,
        session_type: data.session_type,
        reply_mode: data.reply_mode,
        course_code: data.course_code,
        university: user.university,
        department: user.department,
      },
    });
  }

  async listSessions(userId: string) {
    return prisma.session.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async getSession(id: string, userId: string) {
    const session = await prisma.session.findFirst({
      where: { id, user_id: userId },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!session) throw new Error('Session not found');
    return session;
  }

  async endSession(id: string, userId: string) {
    const existingSession = await prisma.session.findFirst({
      where: { id, user_id: userId }
    });
    if (!existingSession) throw new Error('Session not found');

    const session = await prisma.session.update({
      where: { id },
      data: { ended_at: new Date() },
    });

    // Trigger background jobs
    updateLearningProfileJob(id).catch(console.error);
    generateSessionSummaryJob(id).catch(console.error);

    return session;
  }

  async listMessages(sessionId: string, userId: string) {
    return prisma.message.findMany({
      where: { session_id: sessionId, session: { user_id: userId } },
      orderBy: { created_at: 'asc' },
    });
  }

  async sendMessage(userId: string, sessionId: string, data: SendMessageRequest) {
    const session = await this.getSession(sessionId, userId);

    if (session.ended_at) {
        throw new Error('Cannot send message to an ended session');
    }

    const replyMode = data.reply_mode || session.reply_mode;

    // Save student message
    await prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        role: MessageRole.STUDENT,
        content: xss(data.content),
        reply_mode: replyMode,
      },
    });

    // AI Orchestration Logic
    const aiResponseContent = await orchestrateAIResponse(userId, sessionId, data.content, replyMode);

    // Save AI message
    return prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        role: MessageRole.AI,
        content: aiResponseContent,
        reply_mode: replyMode,
      },
    });
  }

  async getSessionSummary(sessionId: string, userId: string) {
      // In a real scenario, this would probably pull from the generated session summary job's results
      // For now, we return a mock summary that follows the requirements
      return {
          summary: "This session covered key topics in the specified course code. The AI tutor helped the student understand fundamental concepts and addressed specific questions.",
          key_points: ["Discussion on core concepts", "Q&A session on course material", "Problem-solving walkthrough"],
          next_steps: ["Review session notes", "Practice related mock exam questions", "Explore further reading materials"]
      };
  }
}
