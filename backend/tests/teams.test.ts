import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/plugins/prisma';

let app: FastifyInstance;
let ownerToken: string;
let memberToken: string;
let teamId: string;

beforeAll(async () => {
  // Clean database before tests
  await prisma.notification.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.passwordHistory.deleteMany({});
  await prisma.userSetting.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.user.deleteMany({});

  app = await buildApp({ logger: false });
  await app.ready();

  const suffix = Date.now();

  // Register owner
  const ownerRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: `owner-${suffix}@test.com`, password: 'Owner1234!', name: 'Owner' },
  });
  ownerToken = JSON.parse(ownerRes.payload).accessToken;

  // Register member
  const memberRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: `member-${suffix}@test.com`, password: 'Member1234!', name: 'Member' },
  });
  memberToken = JSON.parse(memberRes.payload).accessToken;
});

afterAll(async () => {
  await prisma.notification.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.passwordHistory.deleteMany({});
  await prisma.userSetting.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.user.deleteMany({});
  await app.close();
  await prisma.$disconnect();
});

describe('Teams Module', () => {
  describe('POST /api/v1/teams', () => {
    it('should create a team', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/teams',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { name: 'Test Team', timezone: 'Asia/Shanghai' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe('Test Team');
      expect(body.timezone).toBe('Asia/Shanghai');
      teamId = body.id;
    });
  });

  describe('GET /api/v1/teams', () => {
    it('should list user teams', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/teams',
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/teams/:id', () => {
    it('should get team details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/teams/${teamId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe('Test Team');
      expect(body.userRole).toBe('owner');
    });

    it('should return 403 for non-member', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/teams/${teamId}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Team invitation flow', () => {
    let inviteToken: string;

    it('should create invitation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/teams/${teamId}/invite`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { role: 'member' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.token).toBeDefined();
      inviteToken = body.token;
    });

    it('should join team via invitation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/teams/${teamId}/join`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { token: inviteToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.role).toBe('member');
    });

    it('should return 409 if already a member', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/teams/${teamId}/join`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { token: inviteToken },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('GET /api/v1/teams/:id/members', () => {
    it('should list team members', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/teams/${teamId}/members`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter members by role', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/teams/${teamId}/members?role=owner`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.every((m: { role: string }) => m.role === 'owner')).toBe(true);
    });
  });

  describe('PUT /api/v1/teams/:id', () => {
    it('should update team', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/teams/${teamId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { name: 'Updated Team Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe('Updated Team Name');
    });

    it('should return 403 for member trying to update', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/teams/${teamId}`,
        headers: { authorization: `Bearer ${memberToken}` },
        payload: { name: 'Unauthorized Update' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/v1/teams/:id/members/:userId', () => {
    it('should return 403 for member trying to remove', async () => {
      // Get owner's user id
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      const ownerId = JSON.parse(meRes.payload).id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/teams/${teamId}/members/${ownerId}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/v1/teams/:id', () => {
    it('should return 403 for non-owner', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/teams/${teamId}`,
        headers: { authorization: `Bearer ${memberToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
