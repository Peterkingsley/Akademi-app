import prisma from '../../config/db';
import { StartSessionRequest, SendMessageRequest, SendPhotoMessageRequest } from './sessions.types';
import { SessionType, MessageRole, Feature, Prisma } from '@prisma/client';
import { checkFeatureAccess } from '../../shared/utils/feature-access';
import { orchestrateAIResponse } from '../../shared/utils/ai-orchestrator';
import { systemQueue, JOB_NAMES } from '../../config/queue';
import { config } from '../../config/env';
import * as vision from '@google-cloud/vision';
import { extractDisciplineDocumentText } from '../admin/document-extraction';
import { aiProvider } from '../ai/ai.provider';
import { aiService } from "../ai/ai.service";

let visionClient: vision.ImageAnnotatorClient | null = null;

const PLACEHOLDER_KEYWORDS = ['your_', 'replace_me', 'api_key', 'dummy'];

function hasUsableVisionKey() {
  const key = config.googleVisionApiKey;
  return !!key && !PLACEHOLDER_KEYWORDS.some(keyword => key.toLowerCase().includes(keyword));
}

function getVisionClient() {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient(
      hasUsableVisionKey() ? { apiKey: config.googleVisionApiKey } : {},
    );
  }
  return visionClient;
}

function normalizeExtractedText(text: string) {
  return text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractTextFromImage(buffer: Buffer) {
  const content = buffer.toString('base64');

  if (hasUsableVisionKey()) {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${config.googleVisionApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content },
              features: [{ type: 'TEXT_DETECTION' }],
            },
          ],
        }),
      },
    );

    const payload = await response.json() as any;

    if (!response.ok) {
      throw new Error(payload?.error?.message || 'Google Vision OCR failed');
    }

    const result = payload?.responses?.[0];
    if (result?.error?.message) {
      throw new Error(result.error.message);
    }

    return normalizeExtractedText(result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || '');
  }

  const [result] = await getVisionClient().textDetection({
    image: { content },
  });

  return normalizeExtractedText(result.fullTextAnnotation?.text || '');
}

export class SessionsService {
  private getWhiteboardImageSkipReason(cue: {
    visual_type?: string | null;
    render_mode?: string | null;
    image_url?: string | null;
    generation_status?: string | null;
  }) {
    if (!config.enableTutorImageGeneration) return 'ENABLE_TUTOR_IMAGE_GENERATION is not true';
    if (cue.image_url) return 'image_url already exists';
    if (cue.generation_status === 'READY') return 'generation_status is READY';
    if (cue.generation_status === 'PROCESSING') return 'generation_status is PROCESSING';
    if (cue.generation_status && cue.generation_status !== 'PENDING') {
      return `generation_status is ${cue.generation_status}`;
    }

    const visualKind = `${cue.visual_type || ''} ${cue.render_mode || ''}`.toLowerCase();
    if (visualKind.includes('title_board')) return 'visual cue is title_board';

    return null;
  }

  private queueWhiteboardVisualImages(segments: Array<{
    visual_cues?: Array<{
      id: string;
      visual_type?: string | null;
      render_mode?: string | null;
      image_url?: string | null;
      generation_status?: string | null;
    }>;
  }>) {
    const totalCues = segments.reduce((count, segment) => count + (segment.visual_cues || []).length, 0);
    // eslint-disable-next-line no-console
    console.log(
      `WHITEBOARD IMAGE QUEUE CHECK - segments: ${segments.length}, visualCues: ${totalCues}, enableTutorImageGeneration: ${config.enableTutorImageGeneration}`,
    );

    segments.forEach((segment) => {
      (segment.visual_cues || []).forEach((cue) => {
        const skipReason = this.getWhiteboardImageSkipReason(cue);
        if (skipReason) {
          // eslint-disable-next-line no-console
          console.log(
            `WHITEBOARD IMAGE SKIPPED - visualCueId: ${cue.id}, reason: ${skipReason}, type: ${cue.visual_type || ''}, mode: ${cue.render_mode || ''}, status: ${cue.generation_status || 'null'}`,
          );
          return;
        }

        // eslint-disable-next-line no-console
        console.log(`WHITEBOARD IMAGE ENQUEUE - visualCueId: ${cue.id}`);
        void systemQueue
          .add(JOB_NAMES.GENERATE_WHITEBOARD_VISUAL_IMAGE, { visualCueId: cue.id })
          .catch((error: unknown) => {
            // eslint-disable-next-line no-console
            console.error('Whiteboard visual image queue failed:', error);
          });
      });
    });
  }

  private buildTutorKickoffMessage(material: {
    title: string;
    course_code?: string | null;
    reader_structure?: Prisma.JsonValue | null;
  }) {
    const structure = material.reader_structure as
      | {
          pages?: Array<{
            chapterTitle?: string;
            pageTitle?: string;
          }>;
        }
      | null
      | undefined;
    const firstPage = structure?.pages?.find((page) => page.chapterTitle || page.pageTitle);
    const firstAnchor = firstPage?.chapterTitle || firstPage?.pageTitle || 'the foundation of this material';
    const courseText = material.course_code ? ` for ${material.course_code}` : '';

    return [
      `We will study ${material.title}${courseText} as a proper lesson, not just as quick question-and-answer.`,
      `I will teach it in small chunks from beginning to end, pause for your feedback, and keep checking whether each idea is landing before we move on.`,
      `We will begin with ${firstAnchor}. If you ever want to restart from the beginning, revise a section, or slow down, just say so.`,
      `Ready? Let us start with the first key idea in the material.`,
    ].join(' ');
  }

  private async resolveTutorMaterialAccess(userId: string, materialId: string) {
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: {
        id: true,
        title: true,
        course_code: true,
        university: true,
        faculty: true,
        department: true,
        verification_status: true,
        uploaded_by: true,
        content: true,
        reader_structure: true,
      },
    });

    if (!material) {
      throw new Error('Selected material was not found');
    }

    const canAccess =
      material.verification_status === 'VERIFIED' || material.uploaded_by === userId;

    if (!canAccess) {
      throw new Error('You do not have access to tutor with this material');
    }

    return material;
  }

  private async seedTutorKickoffMessage(sessionId: string, userId: string, material: {
    title: string;
    course_code?: string | null;
    reader_structure?: Prisma.JsonValue | null;
  }) {
    const existingAiMessage = await prisma.message.findFirst({
      where: {
        session_id: sessionId,
        role: MessageRole.AI,
      },
      select: { id: true },
    });

    if (existingAiMessage) return;

    await prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        role: MessageRole.AI,
        content: this.buildTutorKickoffMessage(material),
        reply_mode: 'STUDY',
      },
    });
  }

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

    if (data.session_type === SessionType.TUTOR) {
      if (!data.material_id) {
        throw new Error('AI Tutor now requires a selected material');
      }

      const material = await this.resolveTutorMaterialAccess(userId, data.material_id);

      const existingSession = await prisma.session.findFirst({
        where: {
          user_id: userId,
          session_type: SessionType.TUTOR,
          material_id: material.id,
        },
        orderBy: [{ started_at: 'desc' }, { created_at: 'desc' }],
      });

      if (existingSession) {
        const reopenedSession = existingSession.ended_at
          ? await prisma.session.update({
              where: { id: existingSession.id },
              data: { ended_at: null },
            })
          : existingSession;

        await this.seedTutorKickoffMessage(reopenedSession.id, userId, material);
        return reopenedSession;
      }

      const createdSession = await prisma.session.create({
        data: {
          user_id: userId,
          session_type: data.session_type,
          reply_mode: 'STUDY',
          course_code: material.course_code?.trim() || null,
          topic: material.title,
          duration: data.duration || null,
          material_id: material.id,
          university: user.university,
          department: user.department,
        },
      });

      await this.seedTutorKickoffMessage(createdSession.id, userId, material);
      return createdSession;
    }

    return prisma.session.create({
      data: {
        user_id: userId,
        session_type: data.session_type,
        reply_mode: data.reply_mode,
        course_code: data.course_code?.trim() || null,
        topic: data.topic || null,
        duration: data.duration || null,
        material_id: data.material_id?.trim() || null,
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

  async getSession(id: string) {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        material: {
          select: {
            id: true,
            title: true,
            course_code: true,
            verification_status: true,
          },
        },
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!session) throw new Error('Session not found');
    return session;
  }

  async endSession(id: string) {
    const session = await prisma.session.update({
      where: { id },
      data: { ended_at: new Date() },
    });

    // Trigger background jobs
    systemQueue.add(JOB_NAMES.UPDATE_LEARNING_PROFILE, { sessionId: id }).catch(console.error);
    systemQueue.add(JOB_NAMES.GENERATE_SESSION_SUMMARY, { sessionId: id }).catch(console.error);

    return session;
  }

  async listMessages(sessionId: string) {
    return prisma.message.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: 'asc' },
    });
  }

  async getTutorVisualAsset(_userId: string, visualAssetId: string) {
    const asset = await prisma.tutorVisualAsset.findUnique({
      where: { id: visualAssetId },
      select: {
        id: true,
        topic: true,
        concept: true,
        visual_type: true,
        render_mode: true,
        payload: true,
        image_url: true,
        generation_status: true,
        generation_error: true,
        generated_at: true,
      },
    });

    if (!asset) {
      throw new Error('Tutor visual asset not found');
    }

    return {
      id: asset.id,
      topic: asset.topic,
      concept: asset.concept,
      visualType: asset.visual_type,
      renderMode: asset.render_mode,
      payload: asset.payload,
      imageUrl: asset.image_url,
      imageStatus: asset.generation_status,
      imageError: asset.generation_error,
      generatedAt: asset.generated_at,
    };
  }

  async sendMessage(userId: string, sessionId: string, data: SendMessageRequest) {
    const session = await this.getSession(sessionId);

    if (session.ended_at) {
        throw new Error('Cannot send message to an ended session');
    }

    const replyMode =
      data.reply_mode ||
      session.reply_mode ||
      (session.session_type === SessionType.TUTOR ? 'STUDY' : 'DIRECT');

    // Save student message
    await prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        role: MessageRole.STUDENT,
        content: data.content,
        reply_mode: replyMode,
      },
    });

    // AI Orchestration Logic
    const aiResponse = await orchestrateAIResponse(userId, sessionId, data.content, replyMode);

    // Save AI message
    return prisma.message.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        role: MessageRole.AI,
        content: aiResponse.content,
        metadata: (aiResponse.metadata || {}) as Prisma.InputJsonValue,
        reply_mode: replyMode,
      },
    });
  }

  async sendPhotoMessage(
    userId: string,
    sessionId: string,
    file: Express.Multer.File,
    data: SendPhotoMessageRequest,
  ) {
    if (!file) {
      throw new Error('No image uploaded');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new Error('Uploaded file must be an image');
    }

    const extractedText = await extractTextFromImage(file.buffer);

    if (!extractedText) {
      throw new Error('Could not read text from this image. Please retake it with clearer lighting.');
    }

    const message = await this.sendMessage(userId, sessionId, {
      content: extractedText,
      reply_mode: data.reply_mode,
    });

    return {
      extractedText,
      message,
    };
  }

  async extractDocumentText(file: Express.Multer.File) {
    if (!file) {
      throw new Error('No document uploaded');
    }

    const extractedText = normalizeExtractedText(await extractDisciplineDocumentText(file));

    if (!extractedText) {
      throw new Error('No readable text could be extracted from this document.');
    }

    return {
      extractedText,
      fileName: file.originalname,
    };
  }

  async transcribeAudio(file: Express.Multer.File) {
    if (!file) {
      throw new Error('No audio uploaded');
    }

    if (!file.mimetype.startsWith('audio/')) {
      throw new Error('Uploaded file must be audio');
    }

    const transcript = normalizeExtractedText(await aiProvider.transcribeAudio(file.buffer, file.mimetype));

    if (!transcript) {
      throw new Error('Could not transcribe that recording. Please try again.');
    }

    return {
      transcript,
      fileName: file.originalname,
    };
  }

  async getSessionSummary(sessionId: string) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          material: {
            select: {
              title: true,
              course_code: true,
            },
          },
        },
      });

      return {
          summary: session?.session_type === SessionType.TUTOR
            ? `This tutor session stayed anchored to ${session.material?.title || session?.topic || 'the selected material'} and focused on teaching it progressively, one chunk at a time.`
            : "This session covered key topics in the specified course code. The AI tutor helped the student understand fundamental concepts and addressed specific questions.",
          key_points: session?.session_type === SessionType.TUTOR
            ? ["Material-first teaching flow", "Chunked explanation with room for feedback", "Resumable lesson tied to one material"]
            : ["Discussion on core concepts", "Q&A session on course material", "Problem-solving walkthrough"],
          next_steps: session?.session_type === SessionType.TUTOR
            ? ["Resume the same material session when you are ready", "Ask the tutor to restart from the beginning or continue from the last point", "Practice the new ideas against examples from the material"]
            : ["Review session notes", "Practice related mock exam questions", "Explore further reading materials"]
      };
  }

  async getPlayableLesson(sessionId: string) {
    // eslint-disable-next-line no-console
    console.log(`GET PLAYABLE LESSON - sessionId: ${sessionId}`);

    const segments = await prisma.lessonSegment.findMany({
      where: { session_id: sessionId },
      orderBy: { order: 'asc' },
      include: {
        visual_cues: true,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`GET PLAYABLE LESSON RESULT - sessionId: ${sessionId}, segments: ${segments.length}`);

    if (segments.length === 0) {
      // Logic to upgrade session if no segments exist
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { messages: { orderBy: { created_at: 'asc' } } },
      });

      if (session && session.messages.length > 0) {
        const lastAiMessage = [...session.messages].reverse().find(m => m.role === MessageRole.AI);
        if (lastAiMessage) {
          return await aiService.generateTeachingLesson(session.user_id, sessionId, lastAiMessage.content);
        }
      }
    }

    this.queueWhiteboardVisualImages(segments);

    return segments;
  }
}
