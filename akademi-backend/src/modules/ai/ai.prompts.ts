import { ReplyMode } from '@prisma/client';

export const replyModeInstructions: Record<ReplyMode, string> = {
  DIRECT: `Deliver a clean, structured, course-accurate answer. Be concise.
  Frame everything within the student's department and course context.
  Do not over-explain. Put the final answer in a clear, easy-to-read format at the end.`,

  STUDY: `Do not give the answer immediately. Teach the topic behind this
  question from the ground up. Use analogies appropriate for a Nigerian
  university student at this level. Adapt explanation depth based on the
  student's vocabulary level and subject strength. Arrive at the answer
  only after building understanding. Break your response into logical steps or sections.`,

  QUESTION: `Do not answer the question. Reframe it and ask the student to
  attempt it first. Evaluate their response when they reply. Guide them to
  the correct answer through follow-up prompts without giving it away.`,

  WRONGLY: `Construct a deliberately incorrect approach to this question
  using wrong terminology, flawed logic, or incorrect steps specific to this
  course. Then ask the student to identify what is wrong. Confirm correct
  identifications and explain why each error is wrong.`
};

export function buildDisciplinaryContext(disciplineDocument: any | null): string {
  if (!disciplineDocument) return 'No specific disciplinary context available.';
  return `Disciplinary Context (Version ${disciplineDocument.version}):
  Faculty: ${disciplineDocument.faculty}
  Department: ${disciplineDocument.department}
  Course Code: ${disciplineDocument.course_code || 'N/A'}
  Content Reference: ${disciplineDocument.document_ref}`;
}

export function buildStudentProfile(learningProfile: any): string {
  if (!learningProfile) return 'No student learning profile available.';
  return `Student Profile:
  Vocabulary Level: ${learningProfile.vocabulary_level}
  Strengths: ${JSON.stringify(learningProfile.subject_strengths)}
  Weaknesses: ${JSON.stringify(learningProfile.subject_weaknesses)}
  Question Patterns: ${JSON.stringify(learningProfile.question_patterns)}`;
}

export function buildCommunityContext(communityPatterns: any[]): string {
  if (!communityPatterns || communityPatterns.length === 0) return 'No community patterns available.';
  const patterns = communityPatterns.map(p => `- ${JSON.stringify(p.question_pattern)} (Frequency: ${p.frequency})`).join('\n');
  return `Community Patterns for this department/course:\n${patterns}`;
}

export function buildSessionInstruction(replyMode: ReplyMode): string {
  return `Current Reply Mode: ${replyMode}\n${replyModeInstructions[replyMode]}`;
}

export function assembleSystemPrompt(
  disciplineDocument: any | null,
  learningProfile: any,
  communityPatterns: any[],
  replyMode: ReplyMode
): string {
  return [
    buildDisciplinaryContext(disciplineDocument),
    buildStudentProfile(learningProfile),
    buildCommunityContext(communityPatterns),
    buildSessionInstruction(replyMode),
  ].join('\n\n---\n\n');
}
