import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './prisma';
import { AppError } from './error-handler';

export type Permission =
  | 'team:read' | 'team:update' | 'team:delete' | 'team:invite' | 'team:manage_members'
  | 'project:create' | 'project:read' | 'project:update' | 'project:archive' | 'project:delete' | 'project:manage_members'
  | 'task:create' | 'task:read' | 'task:update' | 'task:delete' | 'task:batch'
  | 'comment:create' | 'comment:read'
  | 'webhook:manage'
  | 'audit:read';

type Role = 'owner' | 'admin' | 'member' | 'viewer';

const PERMISSION_MATRIX: Record<Permission, Role[]> = {
  'team:read': ['owner', 'admin', 'member', 'viewer'],
  'team:update': ['owner', 'admin'],
  'team:delete': ['owner'],
  'team:invite': ['owner', 'admin'],
  'team:manage_members': ['owner', 'admin'],
  'project:create': ['owner', 'admin'],
  'project:read': ['owner', 'admin', 'member', 'viewer'],
  'project:update': ['owner', 'admin', 'member'],
  'project:archive': ['owner', 'admin'],
  'project:delete': ['owner'],
  'project:manage_members': ['owner', 'admin'],
  'task:create': ['owner', 'admin', 'member'],
  'task:read': ['owner', 'admin', 'member', 'viewer'],
  'task:update': ['owner', 'admin', 'member'],
  'task:delete': ['owner', 'admin', 'member'],
  'task:batch': ['owner', 'admin', 'member'],
  'comment:create': ['owner', 'admin', 'member'],
  'comment:read': ['owner', 'admin', 'member', 'viewer'],
  'webhook:manage': ['owner', 'admin'],
  'audit:read': ['owner', 'admin'],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const allowedRoles = PERMISSION_MATRIX[permission];
  return allowedRoles.includes(role as Role);
}

export function requireTeamPermission(permission: Permission) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    const teamId = (request.params as Record<string, string>).id ||
                   (request.params as Record<string, string>).teamId ||
                   (request.body as Record<string, string>)?.team_id;

    if (!teamId) {
      throw new AppError('Team ID is required', 400);
    }

    const membership = await prisma.teamMember.findUnique({
      where: {
        team_id_user_id: {
          team_id: teamId,
          user_id: request.userId,
        },
      },
    });

    if (!membership) {
      throw new AppError('Forbidden', 403);
    }

    if (!hasPermission(membership.role, permission)) {
      throw new AppError('Forbidden', 403);
    }
  };
}

export function requireProjectPermission(permission: Permission) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    const projectId = (request.params as Record<string, string>).id ||
                      (request.params as Record<string, string>).projectId;

    if (!projectId) {
      throw new AppError('Project ID is required', 400);
    }

    const membership = await prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: request.userId,
        },
      },
    });

    if (!membership) {
      // Check if the user is a team member with sufficient role
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new AppError('Project not found', 404);
      }

      const teamMembership = await prisma.teamMember.findUnique({
        where: {
          team_id_user_id: {
            team_id: project.team_id,
            user_id: request.userId,
          },
        },
      });

      if (!teamMembership || !hasPermission(teamMembership.role, permission)) {
        throw new AppError('Forbidden', 403);
      }
      return;
    }

    if (!hasPermission(membership.role, permission)) {
      throw new AppError('Forbidden', 403);
    }
  };
}
