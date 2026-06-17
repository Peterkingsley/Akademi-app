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

  SOCRATIC: `This legacy mode is no longer offered in the app.
  Treat it exactly like STUDY mode: teach the topic clearly from the ground up,
  explain the missing idea directly, and avoid turning the answer into a chain of questions.`
};

export function buildDisciplinaryContext(disciplineDocument: any | null): string {
  if (!disciplineDocument) return 'No specific disciplinary context available.';
  return `Disciplinary Context (Version ${disciplineDocument.version}):
  Faculty: ${disciplineDocument.faculty}
  Department: ${disciplineDocument.department}
  Scope: Department-wide across all schools
  Content Reference: ${disciplineDocument.document_ref}
  Use this document for any student in this department, regardless of university.`;
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
  const patterns = communityPatterns.map(p => {
    const payload = p.question_pattern || {};
    if (payload.type === 'school_story') {
      const tags = Array.isArray(payload.tags) && payload.tags.length > 0
        ? ` Tags: ${payload.tags.join(', ')}.`
        : '';
      return `- Optional school story at ${p.university}: ${payload.title}. ${payload.story}${tags}`;
    }
    return `- ${JSON.stringify(payload)} (Frequency: ${p.frequency})`;
  }).join('\n');
  return `Community Context:
${patterns}

School Story Relevance Rules:
- School stories are optional local examples, not mandatory context.
- Use a school story only when it clearly matches the student's topic, question, or requested analogy.
- If the story is about an unrelated campus incident, ignore it completely.
- Do not mention that a story was ignored.
- Never force school stories into medical, math, science, or technical answers unless the incident directly illustrates the concept.
- Use at most one school story in an answer, and keep it brief.
Use peer-learning intelligence to reassure the student briefly and explain prerequisites before advancing.`;
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
6. End with one useful follow-up question unless the reply mode forbids it.
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

export const whiteboardMathSystemPrompt = `You are preparing a structured board replay for a Nigerian university student.

Return STRICT JSON only. No markdown. No prose outside JSON.

Schema:
{
  "title": string,
  "board_style": "digital-whiteboard",
  "steps": [
    {
      "id": string,
      "type": "write" | "highlight" | "answer",
      "text": string,
      "math": string,
      "note": string
    }
  ],
  "final_answer": string,
  "final_answer_math": string,
  "summary": string
}

Rules:
- Only return valid JSON.
- Focus on maths, quantitative chemistry, or quantitative physics working.
- Each step must be short and classroom-clear.
- Show one operation or reasoning move per step.
- Keep "text" to one or two short teaching sentences, not a paragraph.
- If a solution is long, split it into more steps instead of stuffing many ideas into one step.
- Put board-formatted notation in "math" using valid LaTeX that KaTeX can render.
- Any symbolic rule, derivative, fraction, equation, substitution, or formula must go in "math", not hidden inside "text" or "note".
- Keep each "math" line short enough for a phone screen.
- If an equation transforms across multiple equals signs, split that work across separate steps instead of returning one very wide formula.
- Prefer one displayed equation per step, or at most one short carry-forward transformation.
- Use "text" for plain spoken explanation of the step.
- If a step has no equation, set "math" to an empty string.
- Do not skip intermediate arithmetic.
- Keep steps between 4 and 12.
- The final step should clearly state the answer.
- "note" should explain why that step was taken in simple language.`;
