import { config } from '../../config/env';

// Localhost origins used by Expo web / local tooling during development.
const DEV_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
];

// Public Akademi browser clients. Keeping these in code protects static-site
// lookups when Render env vars lag behind a domain migration.
const AKADEMI_PUBLIC_ORIGINS = [
  'https://akademiai-dtsr.onrender.com',
  'https://akademi.study',
  'https://www.akademi.study',
];

export const getAllowedOrigins = (): string[] => {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const publicOrigins = [...new Set([...configured, ...AKADEMI_PUBLIC_ORIGINS])];
  if (config.nodeEnv === 'production' || config.nodeEnv === 'staging') {
    return publicOrigins;
  }
  // In non-production, also allow local dev origins for convenience.
  return [...new Set([...publicOrigins, ...DEV_ORIGINS])];
};

/**
 * Express/socket.io compatible origin check. Requests with no Origin header
 * (native mobile apps, curl, server-to-server) are allowed; browser origins
 * must be on the allow-list.
 */
export const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
};

export const corsOriginDelegate = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error('Origin not allowed by CORS'));
};
