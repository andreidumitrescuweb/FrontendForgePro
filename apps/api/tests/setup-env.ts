// Minimal env so config/env.ts validates during unit tests (no live services needed).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://forge:forge@localhost:5432/frontendforge_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-test-refresh-secret';
process.env.SECRETS_ENCRYPTION_KEY ??= 'a'.repeat(64);
