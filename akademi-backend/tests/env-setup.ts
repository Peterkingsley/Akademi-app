// Runs before any module (including src/config/env.ts) is imported.
// Guarantees the secrets that env.ts now hard-requires are present during
// tests/CI, without relying on a committed .env file. These are throwaway
// values used only by the test process.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
