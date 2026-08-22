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
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-5-nano',
  teachingAnalysisModel: process.env.TEACHING_ANALYSIS_MODEL || '',
  teachingBlueprintModel: process.env.TEACHING_BLUEPRINT_MODEL || '',
  teachingDialogueModel: process.env.TEACHING_DIALOGUE_MODEL || '',
  teachingFidelityModel: process.env.TEACHING_FIDELITY_MODEL || '',
  teachingPatchModel: process.env.TEACHING_PATCH_MODEL || '',
  // A fidelity repair is deliberately local and bounded. Two attempts allow a
  // patcher to correct a visible first-attempt failure without creating a loop.
  teachingMaxPatchAttempts: Math.max(1, Math.min(2, parseInt(process.env.TEACHING_MAX_PATCH_ATTEMPTS || '2', 10) || 2)),
  teachingSmallSourceTokenLimit: parseInt(process.env.TEACHING_SMALL_SOURCE_TOKEN_LIMIT || '25000', 10),
  teachingMediumSourceTokenLimit: parseInt(process.env.TEACHING_MEDIUM_SOURCE_TOKEN_LIMIT || '150000', 10),
  teachingLargeSourceTokenLimit: parseInt(process.env.TEACHING_LARGE_SOURCE_TOKEN_LIMIT || '500000', 10),
  teachingAnalogyRiskThreshold: Math.min(1, Math.max(0, parseFloat(process.env.TEACHING_ANALOGY_RISK_THRESHOLD || '0.35'))),
  gcpServiceAccountJson: process.env.GCP_SERVICE_ACCOUNT_JSON || '',
  // gemini-2.5-flash-lite / gemini-2.5-flash / gemini-1.5-flash are all retired (404 as of
  // 2026-07-26). See modules/ai/ai.provider.ts's GEMINI_FALLBACK_MODELS for the fallback chain —
  // these are the only two places a Gemini model name should ever appear (enforced by
  // tests/no-hardcoded-gemini-models.test.ts).
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  googleTtsApiKey: process.env.GOOGLE_TTS_API_KEY || '',
  googleTtsModel: process.env.GOOGLE_TTS_MODEL || 'google-cloud-tts-v1',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
  elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5',
  // Teaching episodes use two independent, configurable Google Cloud voices.
  teachingHost1VoiceId: process.env.TEACHING_HOST1_VOICE_ID || 'en-US-Neural2-D',
  teachingHost2VoiceId: process.env.TEACHING_HOST2_VOICE_ID || 'en-US-Neural2-F',
  googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY || '',
  // Google Programmable Search Engine (Custom Search JSON API), image search mode — used to
  // source diagrams for Akademi Generated Textbooks. See .env.example for setup notes.
  googleCseApiKey: process.env.GOOGLE_CSE_API_KEY || '',
  googleCseId: process.env.GOOGLE_CSE_ID || '',
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
  koraSecretKey: process.env.KORA_SECRET_KEY || '',
  koraPublicKey: process.env.KORA_PUBLIC_KEY || '',
  publicApiUrl: process.env.PUBLIC_API_URL || 'https://akademi-app-1.onrender.com',
  koinPurchasesEnabled: process.env.KOIN_PURCHASES_ENABLED === 'true',
  koinWithdrawalsEnabled: process.env.KOIN_WITHDRAWALS_ENABLED === 'true',
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
  // Kill switch for the legacy textbook generation pipeline reset — see
  // scripts/reset-generated-textbooks.ts. When true, no new decomposition/section/audit jobs are
  // enqueued and the capacity sweeper's cron tick is a no-op. Must be set true in every deployed
  // environment's own env vars to actually take effect there, not just locally.
  textbookGenerationPaused: process.env.TEXTBOOK_GENERATION_PAUSED === 'true',
  // Fraction of stripped Teacher's Notebook blocks (see ai.prompts.ts) to log as telemetry.
  // Defaults to logging everything; dial down once volume makes that expensive at scale.
  notebookLogSampleRate: Math.min(1, Math.max(0, parseFloat(process.env.NOTEBOOK_LOG_SAMPLE_RATE ?? '1.0') || 0)),
};
