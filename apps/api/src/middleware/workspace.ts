import type { NextFunction, Request, Response } from 'express';
import type { WorkspaceRole } from '@forge/shared';
import { prisma } from '../lib/prisma';
import { forbidden, notFound, unauthorized } from '../lib/errors';

const ROLE_RANK: Record<WorkspaceRole, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2, OWNER: 3 };

declare module 'express-serve-static-core' {
  interface Request {
    workspaceMember?: { workspaceId: string; role: WorkspaceRole };
  }
}

/**
 * Multi-tenancy guard: every workspace-scoped route resolves membership here.
 * Logical isolation — queries downstream MUST filter by req.workspaceMember.workspaceId.
 */
export function requireWorkspaceRole(minRole: WorkspaceRole) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) return next(unauthorized());
      const workspaceId =
        (req.params.workspaceId as string | undefined) ??
        (req.body?.workspaceId as string | undefined);
      if (!workspaceId) return next(notFound('Workspace not specified'));

      // Platform admins bypass membership checks (audited at route level).
      if (req.auth.role === 'ADMIN' || req.auth.role === 'SUPERADMIN') {
        req.workspaceMember = { workspaceId, role: 'OWNER' };
        return next();
      }

      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: req.auth.userId } },
      });
      if (!member) return next(notFound('Workspace not found'));
      if (ROLE_RANK[member.role as WorkspaceRole] < ROLE_RANK[minRole]) {
        return next(forbidden(`Requires ${minRole} role in this workspace`));
      }
      req.workspaceMember = { workspaceId, role: member.role as WorkspaceRole };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Resolve a project's workspace, then enforce a minimum role on it. */
export function requireProjectRole(minRole: WorkspaceRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.projectId as string | undefined;
      if (!projectId) return next(notFound('Project not specified'));
      const project = await prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { workspaceId: true },
      });
      if (!project) return next(notFound('Project not found'));
      req.params.workspaceId = project.workspaceId;
      return requireWorkspaceRole(minRole)(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}
