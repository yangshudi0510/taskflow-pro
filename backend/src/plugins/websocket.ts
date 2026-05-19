import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from './auth';

interface OnlineUser {
  userId: string;
  socketId: string;
  userName?: string;
  avatarUrl?: string;
}

const onlineUsers = new Map<string, Map<string, OnlineUser>>(); // taskId -> Map<userId, OnlineUser>

export function setupWebSocket(io: SocketIOServer) {
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
      const payload = jwt.verify(token, secret) as JwtPayload;
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Join project room
    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
    });

    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    // Task presence
    socket.on('join:task', (data: { taskId: string; userName?: string; avatarUrl?: string }) => {
      const { taskId, userName, avatarUrl } = data;
      if (!onlineUsers.has(taskId)) {
        onlineUsers.set(taskId, new Map());
      }
      onlineUsers.get(taskId)!.set(userId, {
        userId,
        socketId: socket.id,
        userName,
        avatarUrl,
      });
      io.to(`task:${taskId}`).emit('task:presence', {
        taskId,
        users: Array.from(onlineUsers.get(taskId)!.values()),
      });
      socket.join(`task:${taskId}`);
    });

    socket.on('leave:task', (taskId: string) => {
      if (onlineUsers.has(taskId)) {
        onlineUsers.get(taskId)!.delete(userId);
        if (onlineUsers.get(taskId)!.size === 0) {
          onlineUsers.delete(taskId);
        } else {
          io.to(`task:${taskId}`).emit('task:presence', {
            taskId,
            users: Array.from(onlineUsers.get(taskId)!.values()),
          });
        }
      }
      socket.leave(`task:${taskId}`);
    });

    socket.on('disconnect', () => {
      // Clean up presence from all tasks
      for (const [taskId, users] of onlineUsers.entries()) {
        if (users.has(userId)) {
          users.delete(userId);
          if (users.size === 0) {
            onlineUsers.delete(taskId);
          } else {
            io.to(`task:${taskId}`).emit('task:presence', {
              taskId,
              users: Array.from(users.values()),
            });
          }
        }
      }
    });
  });
}

export function emitToProject(io: SocketIOServer, projectId: string, event: string, data: unknown) {
  io.to(`project:${projectId}`).emit(event, data);
}

export function emitToUser(io: SocketIOServer, userId: string, event: string, data: unknown) {
  io.to(`user:${userId}`).emit(event, data);
}
