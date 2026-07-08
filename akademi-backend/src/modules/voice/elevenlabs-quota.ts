const QUOTA_COOLDOWN_MS = 10 * 60 * 1000;

let quotaExceededUntil = 0;
let quotaExceededMessage = 'ElevenLabs quota exceeded. Falling back to device voice.';

export function isElevenLabsQuotaExceeded() {
  return Date.now() < quotaExceededUntil;
}

export function getElevenLabsQuotaMessage() {
  return quotaExceededMessage;
}

export function markElevenLabsQuotaExceeded(message: string) {
  quotaExceededUntil = Date.now() + QUOTA_COOLDOWN_MS;
  quotaExceededMessage = message;
}

export function isQuotaExceededResponse(status: number, detail: string) {
  return status === 429 || (status === 401 && /quota_exceeded/i.test(detail));
}
