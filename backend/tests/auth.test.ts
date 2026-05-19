import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/plugins/prisma';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  // Clean up test data
  await prisma.session.deleteMany({});
  await prisma.passwordHistory.deleteMany({});
  await prisma.userSetting.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.user.deleteMany({});
  await app.close();
  await prisma.$disconnect();
});

describe('Auth Module', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'Test1234!',
    name: 'Test User',
  };

  let accessToken: string;
  let refreshToken: string;

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.user.email).toBe(testUser.email);
      expect(body.user.name).toBe(testUser.name);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.role).toBe('user');

      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
    });

    it('should return 409 for duplicate email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'invalid', password: 'Test1234!', name: 'Test' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for weak password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'test2@example.com', password: '12345678', name: 'Test' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: testUser.email, password: testUser.password },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.email).toBe(testUser.email);

      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
    });

    it('should return 401 for wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: testUser.email, password: 'WrongPass1!' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'nobody@example.com', password: 'Test1234!' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh access token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refresh_token: refreshToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.accessToken).toBeDefined();
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refresh_token: 'invalid-token' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/me', () => {
    it('should return user profile', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.email).toBe(testUser.email);
      expect(body.name).toBe(testUser.name);
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/me', () => {
    it('should update profile', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe('Updated Name');
    });
  });

  describe('PUT /api/v1/me/password', () => {
    it('should change password', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { old_password: testUser.password, new_password: 'NewPass1234!' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject wrong old password', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { old_password: 'WrongPass1!', new_password: 'AnotherPass1!' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/me/sessions', () => {
    it('should list active sessions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/me/sessions',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });
  });
});

describe('Health Check', () => {
  it('GET /api/v1/health should return ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBeDefined();
  });
});
