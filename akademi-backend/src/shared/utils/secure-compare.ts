import crypto from 'crypto';

/**
 * Constant-time comparison of two strings. Returns false (instead of leaking
 * timing via early return) when the lengths differ. Use this for any secret /
 * signature / token comparison instead of `===`/`!==`.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still perform a comparison against a fixed-length buffer so the early
    // return does not reveal length information through timing.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
