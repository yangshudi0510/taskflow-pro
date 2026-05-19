import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { AppError } from './error-handler';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
    userRole: string;
  }
}

async function authPluginFn(app: FastifyInstance) {
  app.decorateRequest('userId', '');
  app.decorateRequest('userEmail', '');
  app.decorateRequest('userRole', '');

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Unauthorized', 401);
    }

    const token = authHeader.substring(7);
    try {
      const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
      const payload = jwt.verify(token, secret) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new AppError('Unauthorized', 401);
      }

      if (user.locked_until && user.locked_until > new Date()) {
        throw new AppError('Account is locked', 403);
      }

      request.userId = payload.userId;
      request.userEmail = payload.email;
      request.userRole = payload.role;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Unauthorized', 401);
    }
  });
}

export const authPlugin = fp(authPluginFn);

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
