import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../plugins/prisma';
import { redis } from '../../plugins/redis';
import { AppError } from '../../plugins/error-handler';
import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
  UpdateSettingsInput,
} from './schema';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
const BCRYPT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS = 10;

function generateAccessToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, jti: crypto.randomBytes(8).toString('hex') },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function generateRefreshToken(user: { id: string; email: string; role: string }, rememberMe = false): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, type: 'refresh', jti: crypto.randomBytes(8).toString('hex') },
    JWT_REFRESH_SECRET,
    { expiresIn: rememberMe ? '30d' : '7d' }
  );
}

export async function register(input: RegisterInput, meta: { ip?: string; userAgent?: string }) {
  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  // Check rate limit for IP
  if (meta.ip) {
    const key = `register:ip:${meta.ip}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 3600); // 1 hour window
    }
    if (count > 5) {
      throw new AppError('Too many registration attempts from this IP', 429);
    }
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password_hash: passwordHash,
      name: input.name,
      avatar_url: input.avatar_url || null,
      role: 'user',
    },
  });

  // Save password history
  await prisma.passwordHistory.create({
    data: {
      user_id: user.id,
      password_hash: passwordHash,
    },
  });

  // Create default user settings
  await prisma.userSetting.create({
    data: {
      user_id: user.id,
    },
  });

  // Create personal default team
  const teamName = `${user.name}的团队`;
  const team = await prisma.team.create({
    data: {
      name: teamName,
      owner_id: user.id,
    },
  });

  await prisma.teamMember.create({
    data: {
      team_id: team.id,
      user_id: user.id,
      role: 'owner',
      joined_at: new Date(),
    },
  });

  // Log registration activity
  await prisma.activity.create({
    data: {
      user_id: user.id,
      action: 'user.registered',
      entity_type: 'user',
      entity_id: user.id,
      metadata: JSON.stringify({
        ip: meta.ip,
        user_agent: meta.userAgent,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      action: 'user.registered',
      entity_type: 'user',
      entity_id: user.id,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    },
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Create session
  await createSession(user.id, refreshToken, meta);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

export async function login(input: LoginInput, meta: { ip?: string; userAgent?: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if account is locked
  if (user.locked_until && user.locked_until > new Date()) {
    const remainingMs = user.locked_until.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new AppError(`Account is locked. Try again in ${remainingMin} minutes`, 403);
  }

  const passwordValid = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordValid) {
    const newAttempts = user.failed_login_attempts + 1;
    const updateData: Record<string, unknown> = {
      failed_login_attempts: newAttempts,
    };

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.locked_until = new Date(Date.now() + LOCK_DURATION_MS);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Log failed login
    await prisma.activity.create({
      data: {
        user_id: user.id,
        action: 'user.login_failed',
        entity_type: 'user',
        entity_id: user.id,
        metadata: JSON.stringify({
          ip: meta.ip,
          user_agent: meta.userAgent,
          attempts: newAttempts,
        }),
      },
    });

    throw new AppError('Invalid email or password', 401);
  }

  // Reset failed attempts and update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date(),
    },
  });

  // Check session limit
  const activeSessions = await prisma.session.count({
    where: {
      user_id: user.id,
      expires_at: { gt: new Date() },
    },
  });

  if (activeSessions >= MAX_SESSIONS) {
    // Remove oldest session
    const oldest = await prisma.session.findFirst({
      where: {
        user_id: user.id,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'asc' },
    });
    if (oldest) {
      await prisma.session.delete({ where: { id: oldest.id } });
    }
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, input.remember_me);

  // Create session
  await createSession(user.id, refreshToken, meta);

  // Log successful login
  await prisma.activity.create({
    data: {
      user_id: user.id,
      action: 'user.logged_in',
      entity_type: 'user',
      entity_id: user.id,
      metadata: JSON.stringify({
        ip: meta.ip,
        user_agent: meta.userAgent,
        result: 'success',
      }),
    },
  });

  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      action: 'user.logged_in',
      entity_type: 'user',
      entity_id: user.id,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as {
      userId: string;
      email: string;
      role: string;
      type: string;
    };

    if (payload.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }

    // Check if session exists
    const session = await prisma.session.findFirst({
      where: {
        token: refreshToken,
        expires_at: { gt: new Date() },
      },
    });

    if (!session) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new AppError('User not found', 401);
    }

    // Update session last used
    await prisma.session.update({
      where: { id: session.id },
      data: { last_used: new Date() },
    });

    const newAccessToken = generateAccessToken(user);

    return { accessToken: newAccessToken };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Invalid or expired refresh token', 401);
  }
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar_url: true,
      role: true,
      created_at: true,
      last_login_at: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      avatar_url: input.avatar_url,
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatar_url: true,
      role: true,
      created_at: true,
    },
  });

  return user;
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const validOldPassword = await bcrypt.compare(input.old_password, user.password_hash);
  if (!validOldPassword) {
    throw new AppError('Invalid old password', 400);
  }

  // Check password history (last 5)
  const history = await prisma.passwordHistory.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: 5,
  });

  for (const entry of history) {
    const isSame = await bcrypt.compare(input.new_password, entry.password_hash);
    if (isSame) {
      throw new AppError('Password must not match any of your last 5 passwords', 400);
    }
  }

  const newHash = await bcrypt.hash(input.new_password, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: newHash },
  });

  await prisma.passwordHistory.create({
    data: {
      user_id: userId,
      password_hash: newHash,
    },
  });

  return { message: 'Password changed successfully' };
}

export async function getSettings(userId: string) {
  let settings = await prisma.userSetting.findUnique({
    where: { user_id: userId },
  });

  if (!settings) {
    settings = await prisma.userSetting.create({
      data: { user_id: userId },
    });
  }

  return settings;
}

export async function updateSettings(userId: string, input: UpdateSettingsInput) {
  const settings = await prisma.userSetting.upsert({
    where: { user_id: userId },
    update: input,
    create: {
      user_id: userId,
      ...input,
    },
  });

  return settings;
}

export async function getSessions(userId: string) {
  const sessions = await prisma.session.findMany({
    where: {
      user_id: userId,
      expires_at: { gt: new Date() },
    },
    select: {
      id: true,
      ip_address: true,
      user_agent: true,
      created_at: true,
      last_used: true,
    },
    orderBy: { last_used: 'desc' },
  });

  return sessions;
}

export async function deleteSession(userId: string, sessionId: string) {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      user_id: userId,
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  await prisma.session.delete({ where: { id: sessionId } });

  return { message: 'Session revoked' };
}

async function createSession(
  userId: string,
  token: string,
  meta: { ip?: string; userAgent?: string }
) {
  const decoded = jwt.decode(token) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000);

  await prisma.session.create({
    data: {
      user_id: userId,
      token,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      expires_at: expiresAt,
    },
  });
}
