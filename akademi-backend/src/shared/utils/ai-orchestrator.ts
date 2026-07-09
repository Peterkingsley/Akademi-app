import { ReplyMode } from '@prisma/client';
import { aiService } from '../../modules/ai/ai.service';
import { checkFeatureAccess } from './feature-access';
import { Feature } from '@prisma/client';

export interface OrchestratedAIResponse {
  content: string;
  metadata?: Record<string, unknown>;
}

export async function orchestrateAIResponse(
  userId: string,
  sessionId: string,
  content: string,
  replyMode: ReplyMode | null,
  standalone = false
): Promise<OrchestratedAIResponse> {
  // Free check for Study Mode (as per monetization table in Ticket-00)
  // Actually, we check feature access in SessionsService, but let's be safe.
  const feature = Feature.ASSIGNMENT_SOLVING; // Default feature for general AI queries
  const hasActivePaidFeature = await checkFeatureAccess(userId, feature);

  return await aiService.getOrchestratedResponse(
    userId,
    sessionId,
    content,
    replyMode || ReplyMode.DIRECT,
    hasActivePaidFeature,
    standalone
  );
}
