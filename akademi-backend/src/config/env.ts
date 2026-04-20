import dotenv from 'dotenv';

dotenv.config();

export const config = {
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  googleTtsApiKey: process.env.GOOGLE_TTS_API_KEY || '',
  googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY || '',
  googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || 'dummy_client_id',
  googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  r2AccountId: process.env.R2_ACCOUNT_ID || '',
  r2AccessKey: process.env.R2_ACCESS_KEY || '',
  r2SecretKey: process.env.R2_SECRET_KEY || '',
  r2BucketName: process.env.R2_BUCKET_NAME || 'akademi-files',
  r2PublicUrl: process.env.R2_PUBLIC_URL || '',
  resendApiKey: process.env.RESEND_API_KEY || 're_dummy_key',
  typesenseHost: process.env.TYPESENSE_HOST || 'localhost',
  typesensePort: parseInt(process.env.TYPESENSE_PORT || '8108', 10),
  typesenseApiKey: process.env.TYPESENSE_API_KEY || '',
  typesenseProtocol: process.env.TYPESENSE_PROTOCOL || 'https',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || '',
  paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
  sentryDsn: process.env.SENTRY_DSN || null,
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceType: process.env.SERVICE_TYPE || 'api',
};
