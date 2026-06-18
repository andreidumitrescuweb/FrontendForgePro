import { prisma } from './prisma';
import { logger } from './logger';

export interface AuditEntry {
  userId?: string;
  workspaceId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

/** Fire-and-forget audit write; auditing must never break the request path. */
export function audit(entry: AuditEntry): void {
  prisma.auditLog
    .create({
      data: {
        userId: entry.userId,
        workspaceId: entry.workspaceId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        meta: (entry.meta ?? undefined) as object | undefined,
        ip: entry.ip,
      },
    })
    .catch((err) => logger.error('audit write failed', { err: String(err), action: entry.action }));
}
