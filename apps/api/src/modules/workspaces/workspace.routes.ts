import { Router } from 'express';
import { createWorkspaceSchema, inviteMemberSchema } from '@forge/shared';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspaceRole } from '../../middleware/workspace';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import * as svc from './workspace.service';
import { forbidden } from '../../lib/errors';

export const workspaceRouter = Router();
workspaceRouter.use(requireAuth);

workspaceRouter.get('/', async (req, res, next) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.auth!.userId, workspace: { deletedAt: null } },
      include: {
        workspace: {
          include: {
            subscription: { include: { plan: true } },
            _count: { select: { projects: true, members: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      workspaces: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        plan: m.workspace.subscription?.plan.key ?? 'free',
        projectCount: m.workspace._count.projects,
        memberCount: m.workspace._count.members,
      })),
    });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post('/', validate(createWorkspaceSchema), async (req, res, next) => {
  try {
    const ws = await svc.createWorkspace(req.auth!.userId, req.body.name);
    audit({ userId: req.auth!.userId, workspaceId: ws.id, action: 'workspace.create', ip: req.ip });
    res.status(201).json({ workspace: ws });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.get('/:workspaceId', requireWorkspaceRole('VIEWER'), async (req, res, next) => {
  try {
    const ws = await prisma.workspace.findUniqueOrThrow({
      where: { id: req.params.workspaceId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
        subscription: { include: { plan: true } },
      },
    });
    res.json({ workspace: ws });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post(
  '/:workspaceId/members',
  requireWorkspaceRole('ADMIN'),
  validate(inviteMemberSchema),
  async (req, res, next) => {
    try {
      const member = await svc.inviteMember(req.params.workspaceId!, req.body.email, req.body.role);
      audit({
        userId: req.auth!.userId,
        workspaceId: req.params.workspaceId,
        action: 'workspace.member_invite',
        meta: { email: req.body.email, role: req.body.role },
        ip: req.ip,
      });
      res.status(201).json({ member });
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.delete(
  '/:workspaceId/members/:memberId',
  requireWorkspaceRole('ADMIN'),
  async (req, res, next) => {
    try {
      const member = await prisma.workspaceMember.findUnique({
        where: { id: req.params.memberId },
      });
      if (!member || member.workspaceId !== req.params.workspaceId) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Member not found' } });
        return;
      }
      if (member.role === 'OWNER') throw forbidden('Cannot remove the workspace owner');
      await prisma.workspaceMember.delete({ where: { id: member.id } });
      audit({
        userId: req.auth!.userId,
        workspaceId: req.params.workspaceId,
        action: 'workspace.member_remove',
        entityId: member.userId,
        ip: req.ip,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
