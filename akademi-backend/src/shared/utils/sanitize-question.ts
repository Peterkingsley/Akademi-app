/**
 * Remove the answer key from a question before it is returned to a student who
 * has not yet attempted it. Mirrors what exam-prep's formatMockExam does, so a
 * paid/practice CBT never leaks `correct_answer` / `explanation` up front.
 */
export function stripQuestionAnswer<T extends Record<string, any>>(
  question: T,
): Omit<T, 'correct_answer' | 'explanation'> {
  const { correct_answer, explanation, ...rest } = question ?? ({} as T);
  return rest;
}

export function stripQuestionAnswers<T extends Record<string, any>>(questions: T[]) {
  return (questions || []).map((question) => stripQuestionAnswer(question));
}
