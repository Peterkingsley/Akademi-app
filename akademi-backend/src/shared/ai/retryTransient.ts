// Wraps a single AI call with retry-and-backoff for long-running batch pipelines (archetype
// extraction, item synthesis/verification) where a single transient timeout or capacity error
// would otherwise kill a multi-hour job outright. Not applied to aiProvider itself — interactive,
// user-facing call sites elsewhere in the codebase want to fail fast, not retry for 30+ seconds.
export async function withTransientRetry<T>(fn: () => Promise<T>, opts?: { maxAttempts?: number; baseDelayMs?: number; label?: string }): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 5;
  const baseDelayMs = opts?.baseDelayMs ?? 8000;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const delay = baseDelayMs * attempt;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[retry${opts?.label ? `:${opts.label}` : ''}] attempt ${attempt}/${maxAttempts} failed (${message}); retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
