import { FastifyInstance } from 'fastify';
import {
  createTeamSchema,
  updateTeamSchema,
  inviteSchema,
  joinTeamSchema,
  updateMemberRoleSchema,
} from './schema';
import * as teamService from './service';
import { requireTeamPermission } from '../../plugins/rbac';

export async function teamRoutes(app: FastifyInstance) {
  // POST /teams
  app.post('/teams', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Teams'],
      summary: 'Create a new team',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          timezone: { type: 'string' },
          logo_url: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const input = createTeamSchema.parse(request.body);
    const result = await teamService.createTeam(request.userId, input);
    return reply.status(201).send(result);
  });

  // GET /teams
  app.get('/teams', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Teams'],
      summary: 'List user teams',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const result = await teamService.getTeams(request.userId);
    return reply.status(200).send(result);
  });

  // GET /teams/:id
  app.get('/teams/:id', {
    onRequest: [app.authenticate, requireTeamPermission('team:read')],
    schema: {
      tags: ['Teams'],
      summary: 'Get team details',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await teamService.getTeamById(id, request.userId);
    return reply.status(200).send(result);
  });

  // PUT /teams/:id
  app.put('/teams/:id', {
    onRequest: [app.authenticate, requireTeamPermission('team:update')],
    schema: {
      tags: ['Teams'],
      summary: 'Update team',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          timezone: { type: 'string' },
          logo_url: { type: 'string', nullable: true },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = updateTeamSchema.parse(request.body);
    const result = await teamService.updateTeam(id, input, request.userId);
    return reply.status(200).send(result);
  });

  // DELETE /teams/:id
  app.delete('/teams/:id', {
    onRequest: [app.authenticate, requireTeamPermission('team:delete')],
    schema: {
      tags: ['Teams'],
      summary: 'Delete team',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await teamService.deleteTeam(id, request.userId);
    return reply.status(200).send(result);
  });

  // POST /teams/:id/invite
  app.post('/teams/:id/invite', {
    onRequest: [app.authenticate, requireTeamPermission('team:invite')],
    schema: {
      tags: ['Teams'],
      summary: 'Create invitation link',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['admin', 'member', 'viewer'] },
          max_uses: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = inviteSchema.parse(request.body);
    const result = await teamService.createInvitation(id, request.userId, input);
    return reply.status(201).send(result);
  });

  // POST /teams/:id/join
  app.post('/teams/:id/join', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Teams'],
      summary: 'Join team via invitation token',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { token } = joinTeamSchema.parse(request.body);
    const result = await teamService.joinTeam(token, request.userId);
    return reply.status(200).send(result);
  });

  // GET /teams/:id/members
  app.get('/teams/:id/members', {
    onRequest: [app.authenticate, requireTeamPermission('team:read')],
    schema: {
      tags: ['Teams'],
      summary: 'List team members',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          role: { type: 'string' },
          page: { type: 'integer', default: 1 },
          pageSize: { type: 'integer', default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { search?: string; role?: string; page?: number; pageSize?: number };
    const result = await teamService.getMembers(id, query);
    return reply.status(200).send(result);
  });

  // PUT /teams/:id/members/:userId
  app.put('/teams/:id/members/:userId', {
    onRequest: [app.authenticate, requireTeamPermission('team:manage_members')],
    schema: {
      tags: ['Teams'],
      summary: 'Update team member role',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'userId'],
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['admin', 'member', 'viewer'] },
        },
      },
    },
  }, async (request, reply) => {
    const { id, userId: targetUserId } = request.params as { id: string; userId: string };
    const input = updateMemberRoleSchema.parse(request.body);
    const result = await teamService.updateMemberRole(id, targetUserId, input, request.userId);
    return reply.status(200).send(result);
  });

  // DELETE /teams/:id/members/:userId
  app.delete('/teams/:id/members/:userId', {
    onRequest: [app.authenticate, requireTeamPermission('team:manage_members')],
    schema: {
      tags: ['Teams'],
      summary: 'Remove team member',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'userId'],
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id, userId: targetUserId } = request.params as { id: string; userId: string };
    const result = await teamService.removeMember(id, targetUserId, request.userId);
    return reply.status(200).send(result);
  });
}
