import dotenv from 'dotenv';

dotenv.config();

/**
 * Secrets and connection strings that must always be supplied by the
 * environment. There is intentionally NO fallback value for any of these in any
 * environment — a missing one is a hard startup error. This prevents the app
 * from ever silently signing tokens (or connecting to a DB) using a public
 * placeholder that lives in source control.
 */
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;

const missingEnvVars = REQUIRED_ENV_VARS.filter(
  (key) => !process.env[key] || process.env[key]!.trim() === '',
);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missingEnvVars.join(', ')}. ` +
      'These must be set in every environment; no default value is provided for secrets.',
  );
}

export const config = {
  databaseUrl: process.env.DATABASE_URL as string,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  enableRedis: process.env.ENABLE_REDIS === 'true',
  enableWebSocketRedisAdapter: process.env.ENABLE_WEBSOCKET_REDIS_ADAPTER === 'true',
  jwtSecret: process.env.JWT_SECRET as string,
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
  googleTtsApiKey: process.env.GOOGLE_TTS_API_KEY || '',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
  elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5',
  googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY || '',
  googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || 'dummy_client_id',
  googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  r2AccountId: process.env.R2_ACCOUNT_ID || '',
  r2AccessKey: process.env.R2_ACCESS_KEY || '',
  r2SecretKey: process.env.R2_SECRET_KEY || '',
  r2BucketName: process.env.R2_BUCKET_NAME || 'akademi-files',
  r2PublicUrl: process.env.R2_PUBLIC_URL || '',
  resendApiKey: process.env.RESEND_API_KEY || 're_dummy_key',
  // Base URL the password-reset link should point at. Defaults to the app's
  // deep-link scheme so the token is never sent to a third-party domain.
  passwordResetUrl: process.env.PASSWORD_RESET_URL || 'akademi://reset-password',
  typesenseHost: process.env.TYPESENSE_HOST || 'localhost',
  typesensePort: parseInt(process.env.TYPESENSE_PORT || '8108', 10),
  typesenseApiKey: process.env.TYPESENSE_API_KEY || '',
  typesenseProtocol: process.env.TYPESENSE_PROTOCOL || 'https',
  typesenseAutoSync: process.env.TYPESENSE_AUTO_SYNC === 'true',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || '',
  paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
  sentryDsn: process.env.SENTRY_DSN || null,
  sentryEnvironment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  sentryRelease: process.env.SENTRY_RELEASE || 'akademi-backend@1.0.0',
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  // Explicit CORS allow-list (comma-separated origins). Native mobile clients
  // send no Origin header and are always allowed; browsers must match this
  // list. Never reflect an arbitrary Origin.
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  serviceType: process.env.SERVICE_TYPE || 'api',
  unlockAllFeatures: process.env.UNLOCK_ALL_FEATURES === 'true',
  tournamentActivationIntervalMs: parseInt(process.env.TOURNAMENT_ACTIVATION_INTERVAL_MS || '15000', 10),
  adminReingestSecret: process.env.ADMIN_REINGEST_SECRET || '',
};
