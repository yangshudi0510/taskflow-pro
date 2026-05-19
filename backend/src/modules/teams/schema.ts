import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  timezone: z.string().default('UTC'),
  logo_url: z.string().url().optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  logo_url: z.string().url().nullable().optional(),
});

export const inviteSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  max_uses: z.number().int().positive().optional(),
});

export const joinTeamSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type JoinTeamInput = z.infer<typeof joinTeamSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
