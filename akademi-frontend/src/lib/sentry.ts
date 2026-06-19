import * as Sentry from '@sentry/react-native';

const ENABLED_ENVS = new Set(['production', 'staging']);
const sentryEnvironment = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const isSentryEnabled = Boolean(sentryDsn && ENABLED_ENVS.has(sentryEnvironment));

const redactObject = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redactObject);
  }

  const clone: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const loweredKey = key.toLowerCase();
    if (
      loweredKey.includes('authorization') ||
      loweredKey.includes('password') ||
      loweredKey.includes('token') ||
      loweredKey.includes('refresh') ||
      loweredKey.includes('cookie') ||
      loweredKey.includes('image') ||
      loweredKey.includes('file') ||
      loweredKey.includes('prompt') ||
      loweredKey.includes('message') ||
      loweredKey.includes('content') ||
      loweredKey.includes('email') ||
      loweredKey.includes('phone')
    ) {
      clone[key] = '[redacted]';
      continue;
    }

    clone[key] = redactObject(nestedValue);
  }

  return clone;
};

export const initSentry = () => {
  if (!isSentryEnabled || !sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    enabled: isSentryEnabled,
    environment: sentryEnvironment,
    release: process.env.EXPO_PUBLIC_SENTRY_RELEASE || 'akademi-frontend@1.0.0',
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        event.request.headers = redactObject(event.request.headers) as Record<string, string>;
      }
      if (event.request?.data) {
        event.request.data = redactObject(event.request.data);
      }
      if (event.extra) {
        event.extra = redactObject(event.extra) as Record<string, unknown>;
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
};

export const setSentryUserContext = (user: { id?: string | null; role?: string | null; isAdmin?: boolean }) => {
  if (!isSentryEnabled) return;

  Sentry.setUser({
    id: user.id || undefined,
    role: user.role || undefined,
    type: user.isAdmin ? 'admin' : 'user',
  });
};

export const clearSentryUserContext = () => {
  if (!isSentryEnabled) return;
  Sentry.setUser(null);
};

export const setSentryRouteTag = (routeName?: string) => {
  if (!isSentryEnabled || !routeName) return;
  Sentry.setTag('screen', routeName);
};

export const captureFrontendException = (error: unknown, context?: Record<string, unknown>) => {
  if (!isSentryEnabled) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('frontend_context', redactObject(context) as Record<string, unknown>);
    }
    Sentry.captureException(error);
  });
};

export { Sentry };
