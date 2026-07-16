import { ReplyMode } from '@prisma/client';
import prisma from '../../config/db';
import { assembleSystemPrompt, buildWhiteboardMathSystemPrompt, buildEssayBlueprintSystemPrompt, graphSystemPrompt, ExplanationDepth, PROMPT_VERSION, QuestionIntent, stripTeacherNotebook } from './ai.prompts';
import { getAICacheKey, getCachedAIResponse, setCachedAIResponse, checkDailyLimit } from './ai.cache';
import { aiProvider } from './ai.provider';
import { OrchestratedAIResponse } from '../../shared/utils/ai-orchestrator';
import { sampleFunction, findRoots, findYIntercept, findTurningPoints, Point } from './expression-evaluator';
import { GraphSpec, GraphMarker, RawGraphResponse } from './graph.types';

function formatConversation(messages: Array<{ role: string; content: string; created_at: Date }>) {
  return messages
    .map((message) => `${message.role === 'STUDENT' ? 'Student' : 'Akademi'}: ${message.content}`)
    .join('\n\n');
}

const COMMUNITY_STOP_WORDS = new Set([
  'about', 'again', 'answer', 'because', 'before', 'being', 'could', 'course',
  'does', 'explain', 'from', 'have', 'into', 'just', 'know', 'learn', 'like',
  'make', 'more', 'question', 'school', 'should', 'show', 'student', 'tell',
  'that', 'their', 'them', 'then', 'there', 'these', 'they', 'thing', 'this',
  'topic', 'understand', 'what', 'when', 'where', 'which', 'with', 'would',
]);

function tokenizeForRelevance(value: unknown): string[] {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !COMMUNITY_STOP_WORDS.has(token));
}

function getPatternText(pattern: any): string {
  const payload = pattern.question_pattern || {};
  const tags = Array.isArray(payload.tags) ? payload.tags.join(' ') : '';
  return [
    pattern.university,
    pattern.faculty,
    pattern.department,
    payload.title,
    payload.story,
    payload.context_type,
    tags,
  ].filter(Boolean).join(' ');
}

function filterRelevantCommunityPatterns(patterns: any[], studentMessage: string, conversationHistory: string) {
  if (!patterns || patterns.length === 0) return [];

  const queryTokens = new Set(tokenizeForRelevance(`${studentMessage} ${conversationHistory.slice(-1200)}`));
  if (queryTokens.size === 0) return patterns.filter((pattern) => (pattern.question_pattern || {}).type !== 'school_story').slice(0, 3);

  const scored = patterns.map((pattern) => {
    const payload = pattern.question_pattern || {};
    const textTokens = new Set(tokenizeForRelevance(getPatternText(pattern)));
    let score = 0;

    queryTokens.forEach((token) => {
      if (textTokens.has(token)) score += 1;
    });

    if (payload.type !== 'school_story') score += 1;
    if (payload.type === 'school_story' && score > 0) score += 1;

    return { pattern, score };
  });

  return scored
    .filter(({ pattern, score }) => {
      const payload = pattern.question_pattern || {};
      return payload.type === 'school_story' ? score >= 2 : score > 0;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ pattern }) => pattern);
}

export class AIService {
  private readonly boardImperativeNotePattern =
    /^(define|set up|calculate|explain|find|simplify|differentiate|integrate|apply|substitute|rearrange|evaluate|state|show)\b/i;

  private repairDoubleEscapedLatex(value: string) {
    // Model output sometimes double-escapes backslashes inside its JSON (e.g. "\\to" -> two literal
    // backslash characters instead of one). A LaTeX command's backslash always sits directly against
    // its letters with no separator, so any run of 2+ backslashes immediately followed by a letter can
    // only be an over-escaped command, never a real line break - collapse it back to one backslash.
    return value.replace(/\\{2,}(?=[A-Za-z])/g, '\\');
  }

  private hasBalancedBraces(value: string) {
    let depth = 0;
    for (const char of value) {
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth < 0) return false;
      }
    }
    return depth === 0;
  }

  // A step's math is never mechanically split into multiple step cards. Splitting used to chain
  // consecutive "=" signs together on the assumption that 3+ equals-separated segments always
  // meant one continuous derivation (e.g. "y = 2x+3 = 2(4)+3 = 11"). That assumption breaks the
  // moment a single "math" field lists an equation plus several *independent* facts side by side
  // (e.g. "2x^2+3x+4=0 a=2 b=3 c=4" for restating the equation and identifying a, b, c) - the
  // chain logic can't tell "independent facts" from "one equivalence chain" and shreds it into
  // overlapping nonsense fragments, cloning the parent step's explanation across each one. One
  // JSON-authored step is always exactly one rendered card now; see sanitizeBoardStepMath for the
  // validation that replaced this splitting.
  private endsWithDanglingVariable(math: string) {
    const trimmed = math.trim();
    if (!trimmed) return false;

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return false;

    const lastToken = tokens[tokens.length - 1];
    const precedingToken = tokens[tokens.length - 2];
    const isRelationalOperator = /^(=|\+|-|\\times|\\cdot|\\pm|\\mp|<|>|\\leq|\\geq|\\neq)$/.test(precedingToken);

    // A trailing single letter is a normal, complete equation ("x = a") when something relational
    // sits right before it. Without that, it is an orphaned token with nothing connecting it to
    // the rest of the line ("... = 0 a") - the exact signature this bug used to produce.
    return /^[A-Za-z]$/.test(lastToken) && !isRelationalOperator;
  }

  private sanitizeBoardStepMath(math: string) {
    const trimmed = math.trim();
    if (!trimmed) return '';
    if (!this.hasBalancedBraces(trimmed)) return '';
    if (this.endsWithDanglingVariable(trimmed)) return '';
    return trimmed;
  }

  private hasConsecutiveDuplicateSteps(steps: Array<{ text: string }>) {
    for (let index = 1; index < steps.length; index += 1) {
      const previous = steps[index - 1].text.trim().toLowerCase();
      const current = steps[index].text.trim().toLowerCase();
      if (previous && previous === current) return true;
    }
    return false;
  }

  // The prompt requires exactly one "understand" step, one "method" step, at least one "work"
  // step, and one "verify" step - four steps minimum. Anything shorter than that couldn't have
  // included the full arc even if it tried, so there is nothing meaningful to validate there.
  private hasValidPedagogicalArc(steps: Array<{ phase?: string }>) {
    if (steps.length < 4) return true;
    const interiorSteps = steps.slice(2, steps.length - 1);
    return steps[0]?.phase === 'understand'
      && steps[1]?.phase === 'method'
      && steps[steps.length - 1]?.phase === 'verify'
      && interiorSteps.some((step) => step.phase === 'work');
  }

  private normalizeLatexExpression(value: string) {
    if (!value) return '';

    let normalized = this.repairDoubleEscapedLatex(value.trim());

    normalized = normalized
      .replace(/\$\$?/g, '')
      .replace(/\\\((.*?)\\\)/g, '$1')
      .replace(/\\\[(.*?)\\\]/g, '$1')
      .replace(/\bdy\/dx\b/gi, '\\frac{dy}{dx}')
      .replace(/\bd\/dx\b/gi, '\\frac{d}{dx}')
      .replace(/\bsqrt\s*\(([^)]+)\)/gi, '\\sqrt{$1}')
      .replace(/\*/g, ' \\cdot ')
      .replace(/÷/g, '\\div')
      .replace(/×/g, '\\cdot')
      .replace(/\s+/g, ' ')
      .trim();

    normalized = normalized
      .replace(/\bwhere\b[\s\S]*$/i, '')
      .replace(/\bhere\b[\s\S]*$/i, '')
      .replace(/\bbecause\b[\s\S]*$/i, '')
      .replace(/,\s*[A-Za-z][A-Za-z\s,'-]*$/g, '')
      .trim();

    normalized = normalized.replace(/([A-Za-z0-9\)\}])\^([A-Za-z0-9])/g, '$1^{$2}');

    return normalized;
  }

  private looksLikeStandaloneMath(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return false;

    const letterWords = trimmed.match(/[A-Za-z]{3,}/g) || [];
    const symbolMatches = trimmed.match(/[=^\\+\-*/()[\]{}]|dy\/dx|d\/dx|sqrt/gi) || [];

    return symbolMatches.length >= 2 && letterWords.length <= 2;
  }

  private extractStandaloneMath(value: string) {
    if (!value) return { cleanedText: '', extractedMath: '' };

    const trimmed = value.trim();
    const explicitDisplayMatch = trimmed.match(/^\\\[(.*)\\\]$/s);
    const explicitInlineMatch = trimmed.match(/^\\\((.*)\\\)$/s);
    const explicitMatch = explicitDisplayMatch || explicitInlineMatch;

    if (explicitMatch?.[1]) {
      const normalized = this.normalizeLatexExpression(explicitMatch[1]);
      return { cleanedText: '', extractedMath: normalized };
    }

    if (this.looksLikeStandaloneMath(trimmed)) {
      return {
        cleanedText: '',
        extractedMath: this.normalizeLatexExpression(trimmed),
      };
    }

    return {
      cleanedText: trimmed.replace(/\s+/g, ' ').trim(),
      extractedMath: '',
    };
  }

  private cleanBoardCopy(value: string) {
    return value
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .replace(/\s+:/g, ':')
      .replace(/\(\s+\)/g, '()')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private shouldSuppressBoardNote(note: string, text: string) {
    if (!note) return true;

    const normalizedNote = note.trim();
    if (!normalizedNote) return true;
    if (this.boardImperativeNotePattern.test(normalizedNote)) return true;

    const normalizedText = text.trim().toLowerCase();
    const noteComparable = normalizedNote.toLowerCase();
    if (normalizedText && (normalizedText.includes(noteComparable) || noteComparable.includes(normalizedText))) {
      return true;
    }

    return false;
  }

  private normalizeBoardStep(step: { id: string; type: string; text: string; math: string; note: string }) {
    const textExtraction = this.extractStandaloneMath(step.text);
    const noteExtraction = this.extractStandaloneMath(step.note);
    const existingMath = this.normalizeLatexExpression(step.math);
    const fallbackMathParts = [
      existingMath,
      ...(existingMath ? [] : [textExtraction.extractedMath, noteExtraction.extractedMath]),
    ].filter(Boolean);

    const uniqueMath = [...new Set(fallbackMathParts)];
    const text = this.cleanBoardCopy(textExtraction.cleanedText || step.text.trim());
    const rawNote = this.cleanBoardCopy(noteExtraction.cleanedText || step.note.trim());
    const note = this.shouldSuppressBoardNote(rawNote, text) ? '' : rawNote;

    const shortenedText = text.length > 180
      ? text.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').trim()
      : text;
    const shortenedNote = note.length > 140
      ? note.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').trim()
      : note;

    // Combine into one atomic line (", \quad" between clauses) rather than a display line-break -
    // a step is never split into multiple cards, so its math must read as one coherent block.
    const combinedMath = this.sanitizeBoardStepMath(uniqueMath.join(', \\quad '));

    return {
      ...step,
      text: shortenedText,
      math: combinedMath,
      note: shortenedNote,
    };
  }

  // A question only counts as a calculation for prompt purposes when the message itself
  // carries computation signals. The course code is deliberately NOT considered here:
  // conceptual questions exist inside MTH/CHM/PHY/STA courses too, and they must get the
  // Explain-Back Contract, not the worked-example substitution template.
  private hasCalculationSignals(studentMessage: string) {
    const text = studentMessage.toLowerCase();
    const mathSignals = [
      'solve',
      'calculate',
      'ratio',
      'simplify',
      'differentiate',
      'derivative',
      'dy/dx',
      'dydx',
      'differentiate',
      'integrate',
      'integration',
      'limit',
      'find x',
      'solve for x',
      'quadratic',
      'factorize',
      'logarithm',
      'trigonometry',
      'sin',
      'cos',
      'tan',
      'equation',
      'simultaneous',
      'matrix',
      'probability',
      'mean',
      'median',
      'fraction',
      'percentage',
      'velocity',
      'acceleration',
      'force',
      'kinetic energy',
      'mole',
      'molar',
      'stoichiometry',
      'balance this reaction',
    ];

    const symbolSignals = /[\d]+\s*[\+\-\*\/=]|[÷×√π∫Σ]|\bdy\/dx\b|\bdx\b|\bx\^|\bx²|\bx³/.test(studentMessage);
    // Word-boundary match, not substring: a plain .includes() check false-positives on prose
    // that merely contains the letters (e.g. "sin" inside "business", "tan" inside "important",
    // "mean"/"force" as ordinary words), which was misrouting essay questions to the calculation
    // prompt and the Board.
    const keywordSignal = mathSignals.some((signal) => {
      const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
    });

    return symbolSignals || keywordSignal;
  }

  // Extends the same heuristic classification pass that produces isCalculationQuestion with a
  // second, independent signal - no new API call. Order matters: exam pressure and a request for
  // verification are both usually explicit and unambiguous, so they're checked before the fuzzier
  // misconception heuristic; anything that matches none of them defaults to learn_new.
  private getQuestionIntent(studentMessage: string): QuestionIntent {
    const text = studentMessage.toLowerCase();
    const matchesAny = (signals: string[]) =>
      signals.some((signal) => {
        const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
      });

    const examCramSignals = [
      'exam tomorrow', 'exam is tomorrow', 'test tomorrow', 'test is tomorrow',
      'exam on', 'test on', 'exam in', 'test in', 'exam next', 'test next',
      'due tomorrow', 'due tonight', 'deadline', 'final exam', 'exams start',
    ];
    if (matchesAny(examCramSignals)) return 'exam_cram';

    const verificationOnlySignals = [
      'is this correct', 'is this right', 'is that correct', 'is that right',
      'check my', 'did i get this right', 'did i do this right',
      'does this look right', 'can you confirm', 'am i right',
    ];
    if (matchesAny(verificationOnlySignals)) return 'verification_only';

    const misconceptionRepairSignals = [
      "i thought", "isn't it always", "isn't it supposed to", "shouldn't it be",
      "correct me if i'm wrong", "i was taught that", "i learnt that", "i learned that",
    ];
    if (matchesAny(misconceptionRepairSignals)) return 'misconception_repair';

    return 'learn_new';
  }

  private isBoardEligibleQuestion(studentMessage: string, session: { session_type: string; course_code?: string | null }) {
    // Segmented board steps help just as much in a Study Mode tutoring conversation as they do
    // in an assignment solve - only exam prep (a different, quiz-style flow) is excluded.
    if (session.session_type !== 'ASSIGNMENT' && session.session_type !== 'STUDY') return false;

    // The board used to accept the course code alone as a signal, on the theory that offering a
    // board on a quantitative course rarely hurts. In practice this let pure essay questions
    // inside MTH/PHY/CHM/STA-coded courses reach the calculation-flavored whiteboard prompt,
    // which then invented pseudo-math to fill the step schema. The message itself must now show
    // an actual calculation signal - the course code alone is no longer sufficient.
    return this.hasCalculationSignals(studentMessage);
  }

  // Command words examiners use to ask for a written case rather than a number - the essay
  // counterpart to hasCalculationSignals. Word-boundary matched for the same reason: a bare
  // substring check would false-positive inside unrelated prose.
  private hasEssayDirectiveSignals(studentMessage: string) {
    const text = studentMessage.toLowerCase();
    const essaySignals = [
      'critically examine', 'critically evaluate', 'critically discuss', 'critically assess',
      'discuss', 'evaluate', 'assess', 'examine', 'analyze', 'analyse', 'to what extent',
      'compare and contrast', 'justify', 'account for', 'explain the significance',
      'explain the role', 'what is the relationship between',
    ];
    return essaySignals.some((signal) => {
      const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
    });
  }

  // Mutually exclusive with the calculation Board by construction: a question only qualifies for
  // an essay blueprint when it shows no calculation signal but does show an essay command word.
  private isEssayBlueprintEligibleQuestion(studentMessage: string, session: { session_type: string; course_code?: string | null }) {
    if (session.session_type !== 'ASSIGNMENT' && session.session_type !== 'STUDY') return false;
    return !this.hasCalculationSignals(studentMessage) && this.hasEssayDirectiveSignals(studentMessage);
  }

  private extractJsonObject(raw: string) {
    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return raw.slice(firstBrace, lastBrace + 1);
    }

    return raw.trim();
  }

  private parseWhiteboardPayload(raw: string) {
    try {
      const parsed = JSON.parse(this.extractJsonObject(raw));
      const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
      if (typeof parsed?.final_answer !== 'string' || steps.length === 0) {
        return null;
      }

      // Each JSON-authored step object becomes exactly one rendered card - never split, never
      // cloned. Steps with no usable text or math after sanitization are simply dropped.
      const normalizedSteps = steps
        .map((step: any, index: number) => ({
          id: typeof step?.id === 'string' ? step.id : `step-${index + 1}`,
          type: ['write', 'highlight', 'answer'].includes(step?.type) ? step.type : 'write',
          phase: ['understand', 'method', 'work', 'verify'].includes(step?.phase) ? step.phase : 'work',
          text: String(step?.text || '').trim(),
          math: String(step?.math || '').trim(),
          note: String(step?.note || '').trim(),
        }))
        .map((step: { id: string; type: string; phase: string; text: string; math: string; note: string }) => this.normalizeBoardStep(step))
        .filter((step: { text: string; math: string }) => step.text.length > 0 || step.math.length > 0)
        .slice(0, 16);

      if (normalizedSteps.length === 0) return null;

      return {
        title: String(parsed?.title || 'Board walkthrough'),
        board_style: 'digital-whiteboard',
        steps: normalizedSteps,
        final_answer: parsed.final_answer.trim(),
        final_answer_math: this.normalizeLatexExpression(String(parsed?.final_answer_math || parsed?.final_answer || '').trim()),
        summary: String(parsed?.summary || '').trim(),
      };
    } catch {
      return null;
    }
  }

  private async buildWhiteboardPayload(
    studentMessage: string,
    answer: string,
    explanationDepth: ExplanationDepth = 'beginner',
  ) {
    const requestBoard = async (correctiveInstruction?: string) => {
      const raw = await aiProvider.generateResponse(
        `Question: ${studentMessage}

Reference solution:
${answer}

Create a board replay plan for this solution.${correctiveInstruction ? `\n\n${correctiveInstruction}` : ''}`,
        {
          systemPrompt: buildWhiteboardMathSystemPrompt(explanationDepth),
          maxTokens: 900,
        }
      );

      return this.parseWhiteboardPayload(raw);
    };

    const isAttemptValid = (attempt: ReturnType<AIService['parseWhiteboardPayload']>) =>
      !!attempt && !this.hasConsecutiveDuplicateSteps(attempt.steps) && this.hasValidPedagogicalArc(attempt.steps);

    try {
      const firstAttempt = await requestBoard();
      if (isAttemptValid(firstAttempt)) return firstAttempt;
      if (!firstAttempt) return null;

      // Retry once with a corrective instruction targeted at whichever check actually failed,
      // rather than showing the student a duplicated or unframed walkthrough.
      const missingArc = !this.hasValidPedagogicalArc(firstAttempt.steps);
      const hasDuplicates = this.hasConsecutiveDuplicateSteps(firstAttempt.steps);
      const correctiveNotes = [
        hasDuplicates
          ? 'Your previous attempt repeated the same "text" and "note" across multiple consecutive steps, and/or crammed multiple independent facts (like separate coefficient assignments) into one "math" field without proper separation. Each step must have its own distinct explanation. If you need to state several short related facts on one line (e.g. identifying a, b, and c), join them with ", \\\\quad " in a single "math" value instead of repeating the step.'
          : '',
        missingArc
          ? 'Your previous attempt did not follow the required pedagogical arc. Step 1 must have "phase": "understand" (plain-language framing, no calculation), step 2 must have "phase": "method" (name and justify the method), and the last step must have "phase": "verify" (check the answer). Do not skip straight into mechanics.'
          : '',
      ].filter(Boolean).join(' ');

      const retryAttempt = await requestBoard(correctiveNotes);
      if (isAttemptValid(retryAttempt)) return retryAttempt;

      return null;
    } catch (error) {
      console.error('Whiteboard payload generation failed:', error);
      return null;
    }
  }

  private parseEssayBlueprintPayload(raw: string) {
    try {
      const parsed = JSON.parse(this.extractJsonObject(raw));
      const rawSteps = Array.isArray(parsed?.steps) ? parsed.steps : [];
      if (typeof parsed?.final_answer !== 'string' || rawSteps.length === 0) {
        return null;
      }

      // Essay steps carry no math to normalize - unlike board steps, "math" is always forced
      // empty here rather than parsed, so a conceptual step can never smuggle in pseudo-math.
      const steps = rawSteps
        .map((step: any) => ({
          id: String(step?.id || ''),
          type: step?.type === 'highlight' || step?.type === 'answer' ? step.type : 'write',
          phase: String(step?.phase || ''),
          text: this.cleanBoardCopy(String(step?.text || '').trim()),
          math: '',
          note: this.cleanBoardCopy(String(step?.note || '').trim()),
        }))
        .filter((step: { text: string }) => step.text.length > 0);

      if (steps.length === 0) return null;

      return {
        title: String(parsed?.title || 'Essay blueprint'),
        board_style: 'essay-blueprint' as const,
        steps,
        final_answer: parsed.final_answer.trim(),
        summary: String(parsed?.summary || '').trim(),
      };
    } catch {
      return null;
    }
  }

  // Mirrors hasValidPedagogicalArc's shape check, but for the essay arc: "decode" opens,
  // "checklist" closes, "conclusion" sits immediately before it, and at least one "argument"
  // step appears somewhere in between. "counter" is optional (some command words don't support
  // one) so it is deliberately not required here.
  private hasValidEssayArc(steps: Array<{ phase?: string }>) {
    if (steps.length < 4) return true;
    const interiorSteps = steps.slice(2, steps.length - 2);
    return steps[0]?.phase === 'decode'
      && steps[1]?.phase === 'thesis'
      && steps[steps.length - 2]?.phase === 'conclusion'
      && steps[steps.length - 1]?.phase === 'checklist'
      && interiorSteps.some((step) => step.phase === 'argument');
  }

  private async buildEssayBlueprintPayload(studentMessage: string, answer: string) {
    const requestBlueprint = async (correctiveInstruction?: string) => {
      const raw = await aiProvider.generateResponse(
        `Question: ${studentMessage}

Reference answer:
${answer}

Create an essay blueprint plan for this question.${correctiveInstruction ? `\n\n${correctiveInstruction}` : ''}`,
        {
          systemPrompt: buildEssayBlueprintSystemPrompt(),
          maxTokens: 900,
        }
      );

      return this.parseEssayBlueprintPayload(raw);
    };

    const isAttemptValid = (attempt: ReturnType<AIService['parseEssayBlueprintPayload']>) =>
      !!attempt && !this.hasConsecutiveDuplicateSteps(attempt.steps) && this.hasValidEssayArc(attempt.steps);

    try {
      const firstAttempt = await requestBlueprint();
      if (isAttemptValid(firstAttempt)) return firstAttempt;
      if (!firstAttempt) return null;

      const missingArc = !this.hasValidEssayArc(firstAttempt.steps);
      const hasDuplicates = this.hasConsecutiveDuplicateSteps(firstAttempt.steps);
      const correctiveNotes = [
        hasDuplicates
          ? 'Your previous attempt repeated the same "text" across multiple consecutive steps. Each step must argue something the previous step did not already say.'
          : '',
        missingArc
          ? 'Your previous attempt did not follow the required arc. Step 1 must have "phase": "decode", step 2 must have "phase": "thesis", the second-to-last step must have "phase": "conclusion", and the last step must have "phase": "checklist". Do not skip straight into argument points.'
          : '',
      ].filter(Boolean).join(' ');

      const retryAttempt = await requestBlueprint(correctiveNotes);
      if (isAttemptValid(retryAttempt)) return retryAttempt;

      return null;
    } catch (error) {
      console.error('Essay blueprint payload generation failed:', error);
      return null;
    }
  }

  // Standalone (pager) replies end with a tagged practice question since that screen has no
  // chat input for a real follow-up. Split it out of the displayed content so it renders as
  // its own "Now You Try" block instead of leaning on the model to format it inline.
  private extractPracticeBlock(text: string): { content: string; practice: { question: string; answer: string } | null } {
    const match = text.match(/\[PRACTICE\]([\s\S]*?)\[\/PRACTICE\]\s*\[PRACTICE_ANSWER\]([\s\S]*?)\[\/PRACTICE_ANSWER\]/);
    if (!match) return { content: text, practice: null };

    const question = match[1].trim();
    const answer = match[2].trim();
    const content = (text.slice(0, match.index) + text.slice(match.index! + match[0].length)).trim();

    if (!question || !answer) return { content, practice: null };
    return { content, practice: { question, answer } };
  }

  private isGraphEligibleQuestion(studentMessage: string, session: { session_type: string }) {
    if (session.session_type !== 'ASSIGNMENT' && session.session_type !== 'STUDY') return false;

    const text = studentMessage.toLowerCase();
    const graphSignals = [
      'plot',
      'graph',
      'sketch',
      'draw the graph',
      'draw a graph',
      'pie chart',
      'bar chart',
      'bar graph',
      'histogram',
      'cumulative frequency',
      'ogive',
      'scatter plot',
      'scatter diagram',
      'scatter graph',
      'line graph',
      'demand curve',
      'supply curve',
      'supply and demand',
      'frequency distribution',
      'chart showing',
      'pictogram',
    ];

    // Function-analysis questions (injective/surjective/domain/range checks) rarely say the
    // word "graph" outright, but a plotted curve is exactly the visual that makes a collision
    // or a gap in the range visible - so these count as graph signals too, gated to sessions
    // that already look quantitative enough for a graph to make sense (checked by the caller).
    const functionAnalysisSignals = [
      'injective',
      'surjective',
      'bijective',
      'one-to-one',
      'onto',
      'domain and range',
      'domain of the function',
      'range of the function',
      'is the function',
    ];

    return [...graphSignals, ...functionAnalysisSignals].some((signal) => text.includes(signal));
  }

  private normalizeGraphResponse(raw: RawGraphResponse | null | undefined): GraphSpec | null {
    if (!raw || raw.eligible !== true || !raw.kind) return null;

    const title = String(raw.title || 'Graph').trim().slice(0, 120) || 'Graph';
    const xAxisLabel = String(raw.x_axis_label || '').trim().slice(0, 60);
    const yAxisLabel = String(raw.y_axis_label || '').trim().slice(0, 60);
    const caption = String(raw.caption || '').trim().slice(0, 220);

    if (raw.kind === 'function_plot') {
      const expression = String(raw.expression || '').trim();
      const domainMin = Number(raw.domain_min);
      const domainMax = Number(raw.domain_max);

      if (!expression || !Number.isFinite(domainMin) || !Number.isFinite(domainMax) || domainMin >= domainMax) {
        return null;
      }

      let points: Point[];
      try {
        points = sampleFunction(expression, domainMin, domainMax);
      } catch (error) {
        console.error('Graph expression evaluation failed:', error);
        return null;
      }

      if (points.length < 2) return null;

      const markers: GraphMarker[] = [];
      findRoots(points).forEach((root, index) => {
        markers.push({ x: root.x, y: root.y, label: index === 0 ? 'Root' : `Root ${index + 1}` });
      });
      const yIntercept = findYIntercept(expression, domainMin, domainMax);
      if (yIntercept) markers.push({ x: yIntercept.x, y: yIntercept.y, label: 'y-intercept' });
      findTurningPoints(points).forEach((point) => {
        markers.push({ x: point.x, y: point.y, label: 'Turning point' });
      });

      return {
        kind: 'function_plot',
        title,
        x_axis: { label: xAxisLabel || 'x', min: domainMin, max: domainMax },
        y_axis: { label: yAxisLabel || 'y' },
        series: [{ label: expression, points }],
        markers,
        caption,
      };
    }

    if (raw.kind === 'pie_chart' || raw.kind === 'bar_chart') {
      const segments = (raw.segments || [])
        .map((segment) => ({ label: String(segment?.label || '').trim(), value: Number(segment?.value) }))
        .filter((segment) => segment.label && Number.isFinite(segment.value) && segment.value >= 0)
        .slice(0, 12);

      if (segments.length < 2) return null;

      return {
        kind: raw.kind,
        title,
        x_axis: { label: xAxisLabel },
        y_axis: { label: yAxisLabel },
        segments,
        caption,
      };
    }

    if (raw.kind === 'line_chart' || raw.kind === 'scatter_plot') {
      const series = (raw.series || [])
        .map((entry) => ({
          label: String(entry?.label || '').trim() || 'Series',
          points: (entry?.points || [])
            .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
        }))
        .filter((entry) => entry.points.length >= 2)
        .slice(0, 4);

      if (series.length === 0) return null;

      return {
        kind: raw.kind,
        title,
        x_axis: { label: xAxisLabel },
        y_axis: { label: yAxisLabel },
        series,
        caption,
      };
    }

    return null;
  }

  private async buildGraphPayload(studentMessage: string, answer: string): Promise<GraphSpec | null> {
    try {
      const raw = await aiProvider.generateResponse(
        `Question: ${studentMessage}

Reference solution:
${answer}

Decide whether this needs a graph or chart, and if so extract the raw data for it.`,
        {
          systemPrompt: graphSystemPrompt,
          maxTokens: 500,
        }
      );

      const parsed = JSON.parse(this.extractJsonObject(raw)) as RawGraphResponse;
      return this.normalizeGraphResponse(parsed);
    } catch (error) {
      console.error('Graph payload generation failed:', error);
      return null;
    }
  }

  async getOrchestratedResponse(
    userId: string,
    sessionId: string,
    studentMessage: string,
    replyMode: ReplyMode,
    hasActivePaidFeature: boolean,
    standalone = false
  ): Promise<OrchestratedAIResponse> {
    // 1. Check daily limit
    await checkDailyLimit(userId, hasActivePaidFeature);

    // 2. Fetch session and context
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        material: {
          select: {
            id: true,
            title: true,
            course_code: true,
            content: true,
            reader_structure: true,
          },
        },
        messages: {
          orderBy: { created_at: 'asc' },
          select: {
            role: true,
            content: true,
            created_at: true,
          },
        },
      },
    });
    if (!session) throw new Error('Session not found');

    const learningProfile = await prisma.learningProfile.findUnique({
      where: { user_id: userId },
    });

    const communityPatterns = await prisma.communityPattern.findMany({
      where: {
        OR: [
          {
            university: session.university,
            faculty: 'ALL',
            department: 'ALL',
            course_code: null,
            question_pattern: { path: ['is_active'], equals: true },
          },
          {
            department: session.department,
            course_code: session.course_code || undefined,
          },
        ],
      },
      orderBy: { updated_at: 'desc' },
      take: 8,
    });

    const disciplineDocument = await prisma.disciplineDocument.findFirst({
      where: {
        department: session.department,
        is_active: true,
      },
      orderBy: { version: 'desc' },
    });

    // Standalone assignment questions always get STUDY - the deepest teaching depth.
    // The assignment pager has no chat input for follow-ups, and its promise is that a
    // zero-background student can understand the full working from this single reply;
    // DIRECT's phrase-length step notes read as answer recall there, not teaching.
    const effectiveReplyMode =
      standalone || replyMode === ReplyMode.SOCRATIC ? ReplyMode.STUDY : replyMode;
    const recentMessages = session.messages.slice(-12);
    const conversationHistory = formatConversation(recentMessages);
    const relevantCommunityPatterns = filterRelevantCommunityPatterns(
      communityPatterns,
      studentMessage,
      conversationHistory
    );
    // A standalone call (e.g. solving one question from a multi-question
    // pager) must never be treated as a continuation of the session's prior
    // messages — each question is independent, and there is no chat input on
    // that screen for the student to reply to a clarifying question.
    const isFollowUp = !standalone && session.messages.length > 1;
    const prompt = standalone
      ? `This question is one of several standalone questions from an uploaded assignment, shown one at a time with no chat reply available on this screen.

Important:
- Solve the ENTIRE question completely in this single response, including every lettered or numbered sub-part.
- Do not ask the student which part to start with, do not pause for clarification, and do not wait for a reply.
- If the reply style calls for guided teaching, still teach AND fully solve every part within this one response — never defer a part to a follow-up.
- Assume the student reading this has ZERO background knowledge of the topic. Before working the first sub-part, explain in plain everyday words what the question is asking and what each key term means, as if teaching it for the very first time.
- For every verdict or result you state, walk the full reasoning in small steps with the "why" of each step spelled out in plain language — never state a conclusion whose reason a complete beginner could not retell in their own words.
- The success bar: a student who reads this once should be able to explain each answer back to a friend and solve a similar question alone. If a step would be unclear to a complete beginner, expand it rather than shorten it.
- The Explain-Back Contract and Calculation Teaching Mode in your instructions both apply here, and this is a multi-part question, so apply them per sub-part: open each lettered/numbered sub-part with a one-line hook or reframing before its working starts, walk that sub-part's causal chain step by step with nothing skipped, then close that sub-part with a short 1-2 sentence retell of what it showed. After every sub-part is done, end the whole reply with one short "whole story" retell (3-6 plain sentences) that ties every sub-part together into one takeaway the student could repeat about the entire question.
- Format math with LaTeX delimiters the app can typeset: inline math in \\(...\\) and standalone equations in \\[...\\]. Never leave raw LaTeX outside delimiters.
- This screen has no chat input, so the student cannot ask a follow-up here. After the whole-story retell, give them one concrete way to test their own understanding: add exactly one practice question of the same type but with different numbers, wrapped EXACTLY like this at the very end of your reply, with nothing after it:
[PRACTICE]the practice question, in plain text[/PRACTICE][PRACTICE_ANSWER]a short worked answer to that practice question, using the same LaTeX rules[/PRACTICE_ANSWER]

Question:
${studentMessage}`
      : isFollowUp
      ? `Continue this existing learning conversation.

Recent conversation:
${conversationHistory}

Latest student reply:
${studentMessage}

Important:
- Treat the latest student reply as a response to Akademi's previous question.
- Do not restart the explanation unless the student asks to restart.
- If the previous Akademi message asked a question, evaluate the student's answer first.
- If the student says they do not know or seem confused, explain the missing idea directly before asking anything else.
- Do not trap the student in repeated questions. Move the explanation forward.`
      : studentMessage;

    // 3. Cache check. Multi-turn sessions must include conversation context, and
    // standalone calls use a distinct prompt, so neither should reuse or poison
    // the plain single-question cache entry.
    const cacheKey = getAICacheKey(
      session.course_code || 'GENERAL',
      studentMessage,
      effectiveReplyMode,
      disciplineDocument?.version || 1,
      PROMPT_VERSION
    );

    const cachedResponse = isFollowUp || standalone ? null : await getCachedAIResponse(cacheKey);
    if (cachedResponse) return { content: cachedResponse };

    // 4. Assemble system prompt
    const isCalculationQuestion = this.hasCalculationSignals(studentMessage);
    const questionIntent = this.getQuestionIntent(studentMessage);
    const isBoardEligible = this.isBoardEligibleQuestion(studentMessage, session);
    const systemPrompt = [
      assembleSystemPrompt(
      disciplineDocument,
      learningProfile,
      relevantCommunityPatterns,
      effectiveReplyMode,
      isCalculationQuestion,
      questionIntent,
      ),
    ].filter(Boolean).join('\n\n---\n\n');

    // 5. Call AI Provider (Gemini)
    // A multi-part assignment question taught at zero-background depth - with a hook,
    // causal chain, and retell per lettered sub-part on top of full worked steps - easily
    // runs to several thousand tokens; 3000 was still low enough to cut answers off
    // mid-sentence (aiProvider.generateResponse retries once more if that still happens).
    const aiResponseText = await aiProvider.generateResponse(prompt, {
      systemPrompt,
      maxTokens: standalone ? 8000 : 1000,
      extendedTimeouts: standalone,
    });

    // The Teacher's Notebook (see buildTeacherNotebook) is a hidden planning block the model
    // is instructed to open every STUDY/SOCRATIC/QUESTION reply with. It must never reach the
    // student: strip it here, before anything derived from the response text - practice
    // extraction, the cache, the DB row, or the client - ever sees it. There is no streaming
    // of chat text in this pipeline (aiProvider.generateResponse resolves with the full text,
    // and the websocket handler awaits sendMessage() before emitting), so there is no partial
    // output that could flash the notebook on screen mid-generation.
    const { visibleText: notebookStrippedText, notebook, malformed: notebookMalformed } =
      stripTeacherNotebook(aiResponseText);
    if (notebookMalformed) {
      console.warn('teacher_notebook_malformed', { sessionId, userId });
    }
    if (notebook) {
      console.debug('teacher_notebook', { sessionId, userId, notebook });
    }

    const { content: cleanedResponseText, practice: practiceBlock } = standalone
      ? this.extractPracticeBlock(notebookStrippedText)
      : { content: notebookStrippedText, practice: null };

    const isGraphQuestion = this.isGraphEligibleQuestion(studentMessage, session);
    const isEssayBlueprintEligible = this.isEssayBlueprintEligibleQuestion(studentMessage, session);
    const [whiteboardPayload, graphPayload, essayBlueprintPayload] = await Promise.all([
      isBoardEligible ? this.buildWhiteboardPayload(studentMessage, cleanedResponseText) : Promise.resolve(null),
      isGraphQuestion ? this.buildGraphPayload(studentMessage, cleanedResponseText) : Promise.resolve(null),
      isEssayBlueprintEligible ? this.buildEssayBlueprintPayload(studentMessage, cleanedResponseText) : Promise.resolve(null),
    ]);

    // 6. Cache response
    if (!isFollowUp && !standalone) {
      await setCachedAIResponse(cacheKey, cleanedResponseText);
    }

    return {
      content: cleanedResponseText,
      metadata: {
        ...(whiteboardPayload
          ? {
              whiteboard: {
                available: true,
                subject_family: 'quantitative',
                payload: whiteboardPayload,
              },
            }
          : {}),
        ...(graphPayload
          ? {
              graph: {
                available: true,
                payload: graphPayload,
              },
            }
          : {}),
        ...(essayBlueprintPayload
          ? {
              essay_blueprint: {
                available: true,
                subject_family: 'conceptual',
                payload: essayBlueprintPayload,
              },
            }
          : {}),
        ...(practiceBlock
          ? {
              practice: practiceBlock,
            }
          : {}),
      },
    };
  }
}

export const aiService = new AIService();
