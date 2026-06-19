import * as Sentry from '@sentry/node';
import { config } from './env';

const ENABLED_ENVS = new Set(['production', 'staging']);

export const isSentryEnabled = () =>
  Boolean(config.sentryDsn && config.sentryDsn.startsWith('http') && ENABLED_ENVS.has(config.sentryEnvironment));

const sanitizeValue = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const lowered = value.toLowerCase();
  if (
    lowered.includes('bearer ') ||
    lowered.includes('refresh') ||
    lowered.includes('password') ||
    lowered.includes('token')
  ) {
    return '[redacted]';
  }
  return value;
};

const scrubObject = (input: Record<string, unknown> | undefined) => {
  if (!input) return input;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const loweredKey = key.toLowerCase();
    if (
      loweredKey.includes('authorization') ||
      loweredKey.includes('password') ||
      loweredKey.includes('token') ||
      loweredKey.includes('refresh') ||
      loweredKey.includes('cookie') ||
      loweredKey.includes('file') ||
      loweredKey.includes('image') ||
      loweredKey.includes('prompt') ||
      loweredKey.includes('message') ||
      loweredKey.includes('content')
    ) {
      output[key] = '[redacted]';
      continue;
    }
    output[key] = sanitizeValue(value);
  }
  return output;
};

const scrubStringMap = (input: Record<string, unknown> | undefined): Record<string, string> | undefined => {
  const scrubbed = scrubObject(input);
  if (!scrubbed) return undefined;

  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(scrubbed)) {
    output[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return output;
};

export const initSentry = () => {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.init({
    dsn: config.sentryDsn!,
    environment: config.sentryEnvironment,
    release: config.sentryRelease,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        event.request.headers = scrubStringMap(event.request.headers as Record<string, unknown>);
        event.request.data = scrubObject(event.request.data as Record<string, unknown>);
      }

      if (event.user) {
        if ('email' in event.user) delete event.user.email;
        if ('ip_address' in event.user) delete event.user.ip_address;
      }

      return event;
    },
  });
};

export const captureBackendException = (error: unknown, context?: Record<string, unknown>) => {
  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('backend_context', scrubObject(context) || null);
    }
    Sentry.captureException(error);
  });
};

export const setSentryRequestUser = (user: {
  id?: string | null;
  role?: string | null;
  type: 'user' | 'admin';
}) => {
  if (!isSentryEnabled()) return;

  Sentry.setUser({
    id: user.id || undefined,
    type: user.type,
    role: user.role || undefined,
  });
};

export { Sentry };
