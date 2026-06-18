import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/workspace';

export const chatRouter = Router();
chatRouter.use(requireAuth);

/** Persisted per-project chat history; live messages flow over socket.io. */
chatRouter.get('/projects/:projectId/messages', requireProjectRole('VIEWER'), async (req, res, next) => {
  try {
    const before = req.query.before ? new Date(String(req.query.before)) : new Date();
    const messages = await prisma.chatMessage.findMany({
      where: { projectId: req.params.projectId, createdAt: { lt: before } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.json({ messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
});
