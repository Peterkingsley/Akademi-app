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
  identifications and explain why each error is wrong.`,

  SOCRATIC: `Guide the student gently. This mode is called "Guide Me", not a quiz.
  Start by teaching one small useful idea in plain language before asking anything.
  Ask at most one short check question at the end of a response.
  If the student says "I don't know", "I'm confused", "I don't understand", or gives a weak answer, explain the missing idea immediately before asking another question.
  Do not keep asking discovery questions when the student is stuck.
  After two guided turns, summarize what the student has learned and move the lesson forward.
  Keep responses short, warm, and useful: teach first, then check understanding.
  Avoid markdown symbols such as **bold**, *italic*, headings, or bullet syntax in the final answer.`
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
  Question Patterns: ${JSON.stringify(learningProfile.question_patterns)}
  Learning Memory:
  - Knowledge gaps: ${JSON.stringify(learningProfile.question_patterns?.knowledge_gaps || [])}
  - Struggles with: ${JSON.stringify(learningProfile.subject_weaknesses?.struggles_with || learningProfile.subject_weaknesses || [])}
  - Mastery map: ${JSON.stringify(learningProfile.subject_strengths?.mastery || {})}
  - Confusion score: ${JSON.stringify(learningProfile.question_patterns?.confusion_score || 0)}
  - Misconceptions: ${JSON.stringify(learningProfile.question_patterns?.misconceptions || [])}
  - Recommended next topics: ${JSON.stringify(learningProfile.question_patterns?.recommended_next_topics || [])}`;
}

export function buildCommunityContext(communityPatterns: any[]): string {
  if (!communityPatterns || communityPatterns.length === 0) return 'No community patterns available.';
  const patterns = communityPatterns.map(p => `- ${JSON.stringify(p.question_pattern)} (Frequency: ${p.frequency})`).join('\n');
  return `Community Patterns for this department/course:
${patterns}

Use this as peer-learning intelligence. If many students struggle with the same prerequisite or misconception, reassure the student briefly and explain the prerequisite before advancing.`;
}

export function buildSessionInstruction(replyMode: ReplyMode): string {
  return `Current Reply Mode: ${replyMode}
${replyModeInstructions[replyMode]}

Learning System Rules:
1. Detect missing prerequisite knowledge before answering.
2. If the student appears ahead of their current course roadmap, give a simple preview and point them to the earlier topic they should master first.
3. Adapt difficulty to the student's profile: BASIC means simple examples, INTERMEDIATE means examples plus terms, ADVANCED means formal definitions and proofs where useful.
4. If confusion is high, slow down, use analogies, and avoid long dense paragraphs.
5. Correct common misconceptions proactively, but do not shame the student.
6. End with one useful follow-up question unless the reply mode forbids it. For SOCRATIC, ask no more than one question and only after teaching a small idea first.
7. Prefer course/department language over generic internet explanations.`;
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
