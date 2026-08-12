import { Feature, ReplyMode } from '@prisma/client';
import { adaptiveAIService } from '../../modules/ai/ai.service.v2';
import { checkFeatureAccess } from './feature-access';

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
  const feature = Feature.ASSIGNMENT_SOLVING;
  const hasActivePaidFeature = await checkFeatureAccess(userId, feature);

  return adaptiveAIService.getOrchestratedResponse(
    userId,
    sessionId,
    content,
    replyMode || ReplyMode.DIRECT,
    hasActivePaidFeature,
    standalone,
  );
}
