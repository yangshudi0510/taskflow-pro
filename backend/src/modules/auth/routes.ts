import { FastifyInstance } from 'fastify';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  changePasswordSchema,
  updateSettingsSchema,
} from './schema';
import * as authService from './service';

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post('/auth/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new user',
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string', minLength: 1 },
          avatar_url: { type: 'string', format: 'uri', nullable: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                avatar_url: { type: 'string', nullable: true },
                role: { type: 'string' },
              },
            },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const meta = {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
    const result = await authService.register(input, meta);
    return reply.status(201).send(result);
  });

  // POST /auth/login
  app.post('/auth/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login with email and password',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          remember_me: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                avatar_url: { type: 'string', nullable: true },
                role: { type: 'string' },
              },
            },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const meta = {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
    const result = await authService.login(input, meta);
    return reply.status(200).send(result);
  });

  // POST /auth/refresh
  app.post('/auth/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      body: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { refresh_token } = refreshSchema.parse(request.body);
    const result = await authService.refreshAccessToken(refresh_token);
    return reply.status(200).send(result);
  });

  // GET /me - Get current user profile
  app.get('/me', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Get current user profile',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            avatar_url: { type: 'string', nullable: true },
            role: { type: 'string' },
            created_at: { type: 'string' },
            last_login_at: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const result = await authService.getProfile(request.userId);
    return reply.status(200).send(result);
  });

  // PUT /me - Update profile
  app.put('/me', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Update current user profile',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          avatar_url: { type: 'string', nullable: true },
          timezone: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const input = updateProfileSchema.parse(request.body);
    const result = await authService.updateProfile(request.userId, input);
    return reply.status(200).send(result);
  });

  // PUT /me/password - Change password
  app.put('/me/password', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Change password',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['old_password', 'new_password'],
        properties: {
          old_password: { type: 'string' },
          new_password: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    const input = changePasswordSchema.parse(request.body);
    const result = await authService.changePassword(request.userId, input);
    return reply.status(200).send(result);
  });

  // PUT /me/settings - Update user settings
  app.put('/me/settings', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Update user settings',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          email_notification: { type: 'string', enum: ['realtime', 'daily', 'off'] },
          websocket_enabled: { type: 'boolean' },
          default_board_columns: { type: 'string' },
          default_sort: { type: 'string', enum: ['priority', 'due_date', 'created_at'] },
          theme: { type: 'string', enum: ['light', 'dark'] },
          timezone: { type: 'string' },
          privacy_mode: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const input = updateSettingsSchema.parse(request.body);
    const result = await authService.updateSettings(request.userId, input);
    return reply.status(200).send(result);
  });

  // GET /me/sessions - List active sessions
  app.get('/me/sessions', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'List active sessions',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const result = await authService.getSessions(request.userId);
    return reply.status(200).send(result);
  });

  // DELETE /me/sessions/:id - Revoke a session
  app.delete('/me/sessions/:id', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Revoke a session',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await authService.deleteSession(request.userId, id);
    return reply.status(200).send(result);
  });
}
