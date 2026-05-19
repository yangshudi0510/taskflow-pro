import crypto from 'crypto';
import { prisma } from '../../plugins/prisma';
import { AppError } from '../../plugins/error-handler';
import {
  CreateTeamInput,
  UpdateTeamInput,
  InviteInput,
  UpdateMemberRoleInput,
} from './schema';

const MAX_TEAM_MEMBERS = 100;

export async function createTeam(userId: string, input: CreateTeamInput) {
  const team = await prisma.team.create({
    data: {
      name: input.name,
      timezone: input.timezone,
      logo_url: input.logo_url || null,
      owner_id: userId,
    },
  });

  // Add creator as owner
  await prisma.teamMember.create({
    data: {
      team_id: team.id,
      user_id: userId,
      role: 'owner',
      joined_at: new Date(),
    },
  });

  // Log activity
  await prisma.activity.create({
    data: {
      user_id: userId,
      team_id: team.id,
      action: 'team.created',
      entity_type: 'team',
      entity_id: team.id,
      new_value: JSON.stringify({ name: team.name }),
    },
  });

  await prisma.auditLog.create({
    data: {
      user_id: userId,
      action: 'team.created',
      entity_type: 'team',
      entity_id: team.id,
    },
  });

  return team;
}

export async function getTeams(userId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { user_id: userId },
    include: {
      team: {
        include: {
          _count: {
            select: { members: true, projects: true },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    ...m.team,
    role: m.role,
    memberCount: m.team._count.members,
    projectCount: m.team._count.projects,
  }));
}

export async function getTeamById(teamId: string, userId: string) {
  const membership = await prisma.teamMember.findUnique({
    where: {
      team_id_user_id: {
        team_id: teamId,
        user_id: userId,
      },
    },
  });

  if (!membership) {
    throw new AppError('Forbidden', 403);
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      _count: {
        select: { members: true, projects: true },
      },
    },
  });

  if (!team) {
    throw new AppError('Team not found', 404);
  }

  // Get task statistics
  const taskStats = await prisma.task.groupBy({
    by: ['status'],
    where: {
      project: { team_id: teamId },
      deleted_at: null,
    },
    _count: { id: true },
  });

  return {
    ...team,
    memberCount: team._count.members,
    projectCount: team._count.projects,
    taskStats: taskStats.map((s) => ({ status: s.status, count: s._count.id })),
    userRole: membership.role,
  };
}

export async function updateTeam(teamId: string, input: UpdateTeamInput, userId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (input.name && input.name !== team.name) {
    oldValues.name = team.name;
    newValues.name = input.name;
  }
  if (input.timezone && input.timezone !== team.timezone) {
    oldValues.timezone = team.timezone;
    newValues.timezone = input.timezone;
  }

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: {
      name: input.name,
      timezone: input.timezone,
      logo_url: input.logo_url,
    },
  });

  // Log activity
  if (Object.keys(newValues).length > 0) {
    await prisma.activity.create({
      data: {
        user_id: userId,
        team_id: teamId,
        action: 'team.updated',
        entity_type: 'team',
        entity_id: teamId,
        old_value: JSON.stringify(oldValues),
        new_value: JSON.stringify(newValues),
      },
    });
  }

  return updated;
}

export async function deleteTeam(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new AppError('Team not found', 404);
  }

  if (team.owner_id !== userId) {
    throw new AppError('Only the team owner can delete the team', 403);
  }

  await prisma.team.delete({ where: { id: teamId } });

  await prisma.auditLog.create({
    data: {
      user_id: userId,
      action: 'team.deleted',
      entity_type: 'team',
      entity_id: teamId,
      details: JSON.stringify({ name: team.name }),
    },
  });

  return { message: 'Team deleted' };
}

export async function createInvitation(teamId: string, userId: string, input: InviteInput) {
  // Check member limit
  const memberCount = await prisma.teamMember.count({
    where: { team_id: teamId },
  });

  if (memberCount >= MAX_TEAM_MEMBERS) {
    throw new AppError(`Team member limit reached (max ${MAX_TEAM_MEMBERS})`, 400);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const invitation = await prisma.invitation.create({
    data: {
      team_id: teamId,
      token,
      role: input.role,
      sender_id: userId,
      max_uses: input.max_uses || null,
      expires_at: expiresAt,
    },
  });

  // Create notification for audit
  await prisma.activity.create({
    data: {
      user_id: userId,
      team_id: teamId,
      action: 'team.invitation_created',
      entity_type: 'invitation',
      entity_id: invitation.id,
      new_value: JSON.stringify({ role: input.role, expires_at: expiresAt }),
    },
  });

  return {
    token: invitation.token,
    role: invitation.role,
    expires_at: invitation.expires_at,
    max_uses: invitation.max_uses,
  };
}

export async function joinTeam(token: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { team: true },
  });

  if (!invitation) {
    throw new AppError('Invalid invitation token', 400);
  }

  if (invitation.expires_at < new Date()) {
    throw new AppError('Invitation has expired', 400);
  }

  if (invitation.max_uses !== null && invitation.use_count >= invitation.max_uses) {
    throw new AppError('Invitation has reached maximum uses', 400);
  }

  // Check if already a member
  const existing = await prisma.teamMember.findUnique({
    where: {
      team_id_user_id: {
        team_id: invitation.team_id,
        user_id: userId,
      },
    },
  });

  if (existing) {
    throw new AppError('Already a member of this team', 409);
  }

  // Check member limit
  const memberCount = await prisma.teamMember.count({
    where: { team_id: invitation.team_id },
  });

  if (memberCount >= MAX_TEAM_MEMBERS) {
    throw new AppError(`Team member limit reached (max ${MAX_TEAM_MEMBERS})`, 400);
  }

  // Add member
  await prisma.teamMember.create({
    data: {
      team_id: invitation.team_id,
      user_id: userId,
      role: invitation.role,
      invited_at: invitation.created_at,
      joined_at: new Date(),
    },
  });

  // Increment use count
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { use_count: { increment: 1 } },
  });

  // Create notification for team owner
  await prisma.notification.create({
    data: {
      user_id: invitation.team.owner_id,
      type: 'invitation',
      title: 'New member joined',
      body: `A new member joined your team "${invitation.team.name}"`,
      link: `/teams/${invitation.team_id}`,
    },
  });

  // Log activity
  await prisma.activity.create({
    data: {
      user_id: userId,
      team_id: invitation.team_id,
      action: 'team.member_joined',
      entity_type: 'team',
      entity_id: invitation.team_id,
      new_value: JSON.stringify({ role: invitation.role }),
    },
  });

  return {
    team_id: invitation.team_id,
    team_name: invitation.team.name,
    role: invitation.role,
  };
}

export async function getMembers(
  teamId: string,
  query: {
    search?: string;
    role?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { team_id: teamId };

  if (query.role) {
    where.role = query.role;
  }

  const [members, total] = await Promise.all([
    prisma.teamMember.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
            last_login_at: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { joined_at: 'desc' },
    }),
    prisma.teamMember.count({ where }),
  ]);

  // Apply search filter on user fields
  let filtered = members;
  if (query.search) {
    const searchLower = query.search.toLowerCase();
    filtered = members.filter(
      (m) =>
        m.user.name.toLowerCase().includes(searchLower) ||
        m.user.email.toLowerCase().includes(searchLower)
    );
  }

  return {
    data: filtered.map((m) => ({
      user_id: m.user_id,
      name: m.user.name,
      email: m.user.email,
      avatar_url: m.user.avatar_url,
      role: m.role,
      joined_at: m.joined_at,
      last_active: m.user.last_login_at,
    })),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function updateMemberRole(
  teamId: string,
  targetUserId: string,
  input: UpdateMemberRoleInput,
  currentUserId: string
) {
  const membership = await prisma.teamMember.findUnique({
    where: {
      team_id_user_id: {
        team_id: teamId,
        user_id: targetUserId,
      },
    },
  });

  if (!membership) {
    throw new AppError('Member not found', 404);
  }

  if (membership.role === 'owner') {
    throw new AppError('Cannot change owner role', 403);
  }

  const oldRole = membership.role;

  await prisma.teamMember.update({
    where: {
      team_id_user_id: {
        team_id: teamId,
        user_id: targetUserId,
      },
    },
    data: { role: input.role },
  });

  // Log activity
  await prisma.activity.create({
    data: {
      user_id: currentUserId,
      team_id: teamId,
      action: 'team.member_role_changed',
      entity_type: 'team_member',
      entity_id: targetUserId,
      old_value: oldRole,
      new_value: input.role,
    },
  });

  await prisma.auditLog.create({
    data: {
      user_id: currentUserId,
      action: 'team.member_role_changed',
      entity_type: 'team_member',
      entity_id: targetUserId,
      details: JSON.stringify({ team_id: teamId, old_role: oldRole, new_role: input.role }),
    },
  });

  return { message: 'Role updated' };
}

export async function removeMember(teamId: string, targetUserId: string, currentUserId: string) {
  const membership = await prisma.teamMember.findUnique({
    where: {
      team_id_user_id: {
        team_id: teamId,
        user_id: targetUserId,
      },
    },
  });

  if (!membership) {
    throw new AppError('Member not found', 404);
  }

  if (membership.role === 'owner') {
    throw new AppError('Cannot remove team owner', 403);
  }

  await prisma.teamMember.delete({
    where: {
      team_id_user_id: {
        team_id: teamId,
        user_id: targetUserId,
      },
    },
  });

  // Send notification to removed member
  await prisma.notification.create({
    data: {
      user_id: targetUserId,
      type: 'system',
      title: 'Removed from team',
      body: `You have been removed from a team`,
    },
  });

  // Log activity
  await prisma.activity.create({
    data: {
      user_id: currentUserId,
      team_id: teamId,
      action: 'team.member_removed',
      entity_type: 'team_member',
      entity_id: targetUserId,
    },
  });

  await prisma.auditLog.create({
    data: {
      user_id: currentUserId,
      action: 'team.member_removed',
      entity_type: 'team_member',
      entity_id: targetUserId,
      details: JSON.stringify({ team_id: teamId }),
    },
  });

  return { message: 'Member removed' };
}
