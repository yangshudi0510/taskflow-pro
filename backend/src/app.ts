import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { authRoutes } from './modules/auth/routes';
import { teamRoutes } from './modules/teams/routes';
import { healthRoutes } from './modules/health/routes';
import { errorHandler } from './plugins/error-handler';
import { authPlugin } from './plugins/auth';

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  // Plugins
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  await app.register(formbody);
  await app.register(cookie);

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'TaskFlow Pro API',
        description: 'Enterprise Task Collaboration Platform API',
        version: '1.0.0',
      },
      servers: [{ url: '/api/v1' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Auth', description: 'Authentication & user management' },
        { name: 'Teams', description: 'Team management' },
        { name: 'Projects', description: 'Project management' },
        { name: 'Tasks', description: 'Task management' },
        { name: 'Comments', description: 'Task comments' },
        { name: 'Attachments', description: 'File attachments' },
        { name: 'Activities', description: 'Activity stream' },
        { name: 'Notifications', description: 'Notifications' },
        { name: 'Webhooks', description: 'Webhook configuration' },
        { name: 'Dashboard', description: 'Dashboard & statistics' },
        { name: 'Search', description: 'Global search' },
        { name: 'Audit', description: 'Audit logs' },
        { name: 'Tags', description: 'Task tags' },
        { name: 'Templates', description: 'Task templates' },
        { name: 'Health', description: 'Health check' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api-docs',
  });

  // Static files for uploads
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Custom plugins
  await app.register(authPlugin);

  // Error handler
  app.setErrorHandler(errorHandler);

  // Routes
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(teamRoutes, { prefix: '/api/v1' });

  return app;
}
