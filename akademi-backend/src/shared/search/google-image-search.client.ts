import { config } from '../../config/env';

export interface ImageCandidate {
  url: string;
  title: string;
  snippet: string;
  contextLink: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

export class GoogleImageSearchNotConfiguredError extends Error {
  constructor() {
    super('Google Custom Search is not configured (GOOGLE_CSE_API_KEY / GOOGLE_CSE_ID missing).');
    this.name = 'GoogleImageSearchNotConfiguredError';
  }
}

export function isGoogleImageSearchConfigured(): boolean {
  return Boolean(config.googleCseApiKey && config.googleCseId);
}

// Google Custom Search JSON API, image search mode. See akademi-backend/.env.example for setup
// notes. Throws on any failure (missing config, HTTP error, malformed response) — callers that
// treat diagram sourcing as best-effort (see fetchTextbookDiagram.job.ts) are responsible for
// catching and degrading gracefully; this client itself does not swallow errors.
export async function searchImages(query: string, count = 8): Promise<ImageCandidate[]> {
  if (!isGoogleImageSearchConfigured()) {
    throw new GoogleImageSearchNotConfiguredError();
  }

  const params = new URLSearchParams({
    key: config.googleCseApiKey,
    cx: config.googleCseId,
    searchType: 'image',
    num: String(Math.min(Math.max(count, 1), 10)),
    safe: 'active',
    q: query,
  });

  const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Google Custom Search request failed: ${response.status} ${response.statusText} ${body.slice(0, 300)}`);
  }

  const data: any = await response.json();
  const items = Array.isArray(data?.items) ? data.items : [];

  return items
    .map((item: any): ImageCandidate => ({
      url: String(item?.link || ''),
      title: String(item?.title || ''),
      snippet: String(item?.snippet || ''),
      contextLink: String(item?.image?.contextLink || ''),
      mimeType: item?.mime ? String(item.mime) : undefined,
      width: item?.image?.width ? Number(item.image.width) : undefined,
      height: item?.image?.height ? Number(item.image.height) : undefined,
    }))
    .filter((candidate: ImageCandidate) => Boolean(candidate.url));
}
