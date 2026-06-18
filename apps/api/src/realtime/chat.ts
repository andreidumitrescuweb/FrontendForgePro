import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/tokens';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { env } from '../config/env';

interface SocketAuth {
  userId: string;
  name: string;
}

/**
 * Per-project chat + presence over socket.io.
 * Events: join, chat:send -> chat:message, presence broadcast on join/leave.
 */
export function attachChatServer(server: HttpServer): SocketServer {
  const io = new SocketServer(server, {
    cors: { origin: env.WEB_URL, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true },
      });
      if (!user) return next(new Error('unauthorized'));
      (socket.data as { auth: SocketAuth }).auth = { userId: user.id, name: user.name };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const auth = (socket.data as { auth: SocketAuth }).auth;

    socket.on('join', async (projectId: string) => {
      const allowed = await prisma.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
          workspace: { members: { some: { userId: auth.userId } } },
        },
        select: { id: true },
      });
      if (!allowed) {
        socket.emit('error:forbidden', { projectId });
        return;
      }
      await socket.join(`project:${projectId}`);
      socket.to(`project:${projectId}`).emit('presence:join', { userId: auth.userId, name: auth.name });
    });

    socket.on('chat:send', async ({ projectId, content }: { projectId: string; content: string }) => {
      if (!socket.rooms.has(`project:${projectId}`)) return;
      const trimmed = String(content ?? '').slice(0, 4000).trim();
      if (!trimmed) return;
      try {
        const message = await prisma.chatMessage.create({
          data: { projectId, userId: auth.userId, content: trimmed },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        });
        io.to(`project:${projectId}`).emit('chat:message', message);
      } catch (err) {
        logger.warn('chat persist failed', { err: String(err) });
      }
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('project:')) {
          socket.to(room).emit('presence:leave', { userId: auth.userId, name: auth.name });
        }
      }
    });
  });

  return io;
}
