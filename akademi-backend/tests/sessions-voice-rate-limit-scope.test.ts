import { isVoicePath } from '../src/modules/sessions/sessions.routes';

// Guards the exact predicate sessionsGeneralRateLimiter uses to skip voice
// endpoints (see sessions.routes.ts) - this is what stops an active
// tutoring session's turn/message/poll traffic from exhausting the general
// bucket and 429ing voice requests that never even touch it.
describe('isVoicePath', () => {
  it('matches POST /voice/tts', () => {
    expect(isVoicePath('/voice/tts')).toBe(true);
  });

  it('matches POST /:id/voice/stream', () => {
    expect(isVoicePath('/64af0e2e-1234-4a3b-9a1c-abc123/voice/stream')).toBe(true);
  });

  it('matches GET /:id/voice/stream-audio/:streamId', () => {
    expect(isVoicePath('/64af0e2e-1234-4a3b-9a1c-abc123/voice/stream-audio/stream-9f8')).toBe(true);
  });

  it('does not match unrelated session routes', () => {
    expect(isVoicePath('/64af0e2e-1234-4a3b-9a1c-abc123/companion')).toBe(false);
    expect(isVoicePath('/64af0e2e-1234-4a3b-9a1c-abc123/messages')).toBe(false);
    expect(isVoicePath('/ingest/audio')).toBe(false);
    expect(isVoicePath('/')).toBe(false);
  });
});
