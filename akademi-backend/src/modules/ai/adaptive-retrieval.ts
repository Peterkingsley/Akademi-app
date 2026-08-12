import { VerificationStatus } from '@prisma/client';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { aiProvider } from './ai.provider';

const STOP_WORDS = new Set([
  'about', 'again', 'answer', 'because', 'before', 'being', 'could', 'course', 'does',
  'explain', 'from', 'have', 'into', 'just', 'know', 'learn', 'like', 'make', 'more',
  'question', 'school', 'should', 'show', 'student', 'tell', 'that', 'their', 'them',
  'then', 'there', 'these', 'they', 'thing', 'this', 'topic', 'understand', 'what',
  'when', 'where', 'which', 'with', 'would',
]);

interface CandidateChunk {
  chunk_index: number;
  chunk_text: string;
  embedding: unknown;
  material: { title: string };
}

export interface RetrievalResult {
  context: string;
  used: boolean;
  semanticUsed: boolean;
  candidateCount: number;
  selectedCount: number;
}

function tokenize(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function lexicalScore(question: string, chunkText: string) {
  const queryTokens = tokenize(question);
  if (!queryTokens.length) return 0;
  const chunkTokens = new Set(tokenize(chunkText));
  const uniqueQuery = [...new Set(queryTokens)];
  const hits = uniqueQuery.filter((token) => chunkTokens.has(token)).length;
  return hits / uniqueQuery.length;
}

function toVector(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const vector = value.map(Number).filter((entry) => Number.isFinite(entry));
    return vector.length ? vector : null;
  }
  if (typeof value === 'string') {
    try {
      return toVector(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return toVector(record.embedding || record.vector || record.values);
  }
  return null;
}

function cosineSimilarity(a: number[] | null, b: number[] | null) {
  if (!a || !b || a.length !== b.length || a.length === 0) return null;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }
  if (!magA || !magB) return null;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function getQueryEmbedding(question: string): Promise<number[] | null> {
  if (!config.openAiApiKey) return null;
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: question.slice(0, 8000),
      }),
    });
    if (!response.ok) return null;
    const body: any = await response.json();
    const vector = body?.data?.[0]?.embedding;
    return Array.isArray(vector) ? vector.map(Number) : null;
  } catch (error) {
    console.warn('course_retrieval_query_embedding_failed', { error });
    return null;
  }
}

async function rerankWithAI(
  question: string,
  candidates: Array<{ id: number; text: string; score: number }>,
): Promise<number[]> {
  if (candidates.length <= 6) return candidates.map((candidate) => candidate.id);
  try {
    const raw = await aiProvider.generateResponse(
      `Question: ${question}\n\nCandidate course excerpts:\n${candidates
        .slice(0, 12)
        .map((candidate) => `[${candidate.id}] ${candidate.text.slice(0, 420)}`)
        .join('\n\n')}\n\nReturn only JSON: {"ids":[the 6 most relevant numeric ids in best-first order]}`,
      {
        systemPrompt: 'Rerank course excerpts for answering the student. Prefer direct conceptual relevance over surface word overlap. Return only JSON.',
        maxTokens: 120,
        temperature: 0,
      },
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return candidates.slice(0, 6).map((candidate) => candidate.id);
    const parsed = JSON.parse(match[0]);
    const validIds = Array.isArray(parsed?.ids)
      ? parsed.ids.map(Number).filter((id: number) => candidates.some((candidate) => candidate.id === id))
      : [];
    return [...new Set<number>(validIds)].slice(0, 6);
  } catch {
    return candidates.slice(0, 6).map((candidate) => candidate.id);
  }
}

export async function buildHybridCourseMaterialContext(
  courseCode: string | null,
  university: string,
  department: string,
  question: string,
): Promise<RetrievalResult> {
  if (!courseCode) {
    return { context: '', used: false, semanticUsed: false, candidateCount: 0, selectedCount: 0 };
  }

  let chunks: CandidateChunk[];
  try {
    chunks = await prisma.materialEmbedding.findMany({
      where: {
        material: {
          course_code: { equals: courseCode, mode: 'insensitive' },
          verification_status: VerificationStatus.VERIFIED,
          unpublished_at: null,
          OR: [{ university }, { department }, { is_akademi_generated: true }],
        },
      },
      select: {
        chunk_index: true,
        chunk_text: true,
        embedding: true,
        material: { select: { title: true } },
      },
      take: 220,
    }) as unknown as CandidateChunk[];
  } catch (error) {
    console.error('hybrid_course_material_context_failed', { courseCode, error });
    return { context: '', used: false, semanticUsed: false, candidateCount: 0, selectedCount: 0 };
  }

  if (!chunks.length) {
    return { context: '', used: false, semanticUsed: false, candidateCount: 0, selectedCount: 0 };
  }

  const queryEmbedding = await getQueryEmbedding(question);
  let semanticUsed = false;
  const scored = chunks.map((chunk, index) => {
    const lexical = lexicalScore(question, chunk.chunk_text);
    const semantic = cosineSimilarity(queryEmbedding, toVector(chunk.embedding));
    if (semantic !== null) semanticUsed = true;
    // Convert cosine from roughly [-1,1] into [0,1] before blending.
    const normalizedSemantic = semantic === null ? 0 : (semantic + 1) / 2;
    const score = semantic === null
      ? lexical
      : normalizedSemantic * 0.72 + lexical * 0.28;
    return { id: index, chunk, lexical, semantic, score };
  });

  let top = scored
    .filter((item) => item.score > 0 || item.lexical > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  // If semantic vectors are unavailable or incompatible, lexical retrieval still returns useful
  // chunks. The small reranker supplies semantic judgment without requiring a schema migration.
  if (!top.length) {
    top = scored.sort((a, b) => b.lexical - a.lexical).slice(0, 12);
  }

  const rerankIds = await rerankWithAI(
    question,
    top.map((item) => ({ id: item.id, text: item.chunk.chunk_text, score: item.score })),
  );
  const byId = new Map(top.map((item) => [item.id, item]));
  const selected = rerankIds
    .map((id) => byId.get(id))
    .filter((item): item is NonNullable<typeof item> => !!item)
    .slice(0, 6);

  const finalSelection = selected.length ? selected : top.slice(0, 6);
  const context = finalSelection.length
    ? [
        `Selected course evidence for ${courseCode}:`,
        ...finalSelection.map((item) =>
          `[${item.chunk.material.title}, chunk ${item.chunk.chunk_index}] ${item.chunk.chunk_text.slice(0, 900)}`
        ),
        'Ground the answer in these excerpts when relevant. If the excerpts do not answer a necessary point, distinguish general academic knowledge from course-specific claims.',
      ].join('\n\n')
    : '';

  return {
    context,
    used: !!context,
    semanticUsed,
    candidateCount: chunks.length,
    selectedCount: finalSelection.length,
  };
}
