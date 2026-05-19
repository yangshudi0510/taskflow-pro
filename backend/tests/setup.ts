import { beforeAll, afterAll } from 'vitest';

// Set test environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://taskflow:taskflow_pass@localhost:5432/taskflow_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'test';

beforeAll(async () => {
  // Setup test database if needed
});

afterAll(async () => {
  // Cleanup
});
