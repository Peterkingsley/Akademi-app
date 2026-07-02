import { studyCompanionService } from '../modules/sessions/study-companion.service';

export async function postAssessmentIntelligenceJob(payload: {
  sessionId: string;
  companionStateId: string;
  userId: string;
  materialId: string;
  courseCode: string;
  sectionIndex: number;
  sectionTitle: string;
  masteryScore: number;
  masteryStatus: 'PASSED' | 'FAILED';
  failedConcepts: string[];
  teachingDecisionSnapshot?: Record<string, unknown>;
  calculationContextSnapshot?: string;
  diagramContextSnapshot?: string;
}) {
  await studyCompanionService.processPostAssessmentIntelligenceJob(payload);
}
