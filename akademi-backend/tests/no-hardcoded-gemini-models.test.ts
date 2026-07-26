// Google retires Gemini model names every few months (gemini-1.5-flash, gemini-2.5-flash, and
// gemini-2.5-flash-lite all 404'd within the same week) and each retirement has meant hunting
// across the codebase for hardcoded strings. This test makes that hunt unnecessary: a model name
// is only ever allowed to live in config/env.ts (the configurable primary) and
// modules/ai/ai.provider.ts (the fallback chain + the two places that read config.geminiModel).
// Everywhere else must go through aiProvider.generateResponse/generateMultimodalResponse.
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '../src');

const ALLOWLISTED_FILES = new Set(
  [path.join(SRC_DIR, 'config', 'env.ts'), path.join(SRC_DIR, 'modules', 'ai', 'ai.provider.ts')].map((p) =>
    path.resolve(p),
  ),
);

// Real Gemini model identifiers always contain a digit somewhere after the "gemini-" prefix
// (gemini-1.5-flash, gemini-3.5-flash, gemini-embedding-001, gemini-2.0-flash-exp, ...).
// Descriptive tag strings used elsewhere in this codebase (e.g. extraction_method: 'gemini-image')
// never do, so this pattern won't false-positive on those.
const GEMINI_MODEL_NAME_PATTERN = /gemini-[a-z]*\d[a-z0-9.-]*/gi;

function listTsFilesRecursively(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFilesRecursively(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Gemini model names stay centralized', () => {
  it('never hardcodes a Gemini model name outside config/env.ts and ai.provider.ts', () => {
    const offenders: Array<{ file: string; match: string }> = [];

    for (const file of listTsFilesRecursively(SRC_DIR)) {
      if (ALLOWLISTED_FILES.has(path.resolve(file))) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.match(GEMINI_MODEL_NAME_PATTERN);
      if (matches) {
        for (const match of matches) {
          offenders.push({ file: path.relative(SRC_DIR, file), match });
        }
      }
    }

    if (offenders.length > 0) {
      const details = offenders.map((o) => `  ${o.file}: "${o.match}"`).join('\n');
      throw new Error(
        `Found hardcoded Gemini model name(s) outside config/env.ts and ai.provider.ts:\n${details}\n\n` +
          'Model names belong only in config.geminiModel (src/config/env.ts) and GEMINI_FALLBACK_MODELS ' +
          '(src/modules/ai/ai.provider.ts). Everywhere else should call aiProvider.generateResponse / ' +
          'generateMultimodalResponse, which already pick a model from there.',
      );
    }
  });
});
