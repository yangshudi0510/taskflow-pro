import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  statusCode: number;
  errors?: Record<string, string>[];

  constructor(message: string, statusCode: number, errors?: Record<string, string>[]) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      statusCode: error.statusCode,
      errors: error.errors,
    });
  }

  if (error instanceof ZodError) {
    const errors = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return reply.status(400).send({
      error: 'Validation error',
      statusCode: 400,
      errors,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return reply.status(409).send({
        error: 'Resource already exists',
        statusCode: 409,
      });
    }
    if (error.code === 'P2025') {
      return reply.status(404).send({
        error: 'Resource not found',
        statusCode: 404,
      });
    }
  }

  // Fastify validation errors
  if ('validation' in error && (error as FastifyError).validation) {
    return reply.status(400).send({
      error: 'Validation error',
      statusCode: 400,
      errors: (error as FastifyError).validation,
    });
  }

  // Rate limit error
  if ('statusCode' in error && (error as FastifyError).statusCode === 429) {
    return reply.status(429).send({
      error: 'Too many requests',
      statusCode: 429,
    });
  }

  console.error('Unhandled error:', error);
  return reply.status(500).send({
    error: 'Internal server error',
    statusCode: 500,
  });
}
