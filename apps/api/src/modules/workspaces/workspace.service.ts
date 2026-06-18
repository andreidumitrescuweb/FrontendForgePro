import type { PlanLimits } from '@forge/shared';
import { prisma } from '../../lib/prisma';
import { planLimit, notFound, conflict } from '../../lib/errors';

/** Resolve the effective plan limits for a workspace (falls back to Free). */
export async function getWorkspaceLimits(workspaceId: string): Promise<PlanLimits> {
  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });
  if (sub && sub.status === 'ACTIVE') return sub.plan.limits as unknown as PlanLimits;
  const free = await prisma.plan.findUniqueOrThrow({ where: { key: 'free' } });
  return free.limits as unknown as PlanLimits;
}

export async function assertCanCreateProject(workspaceId: string): Promise<void> {
  const limits = await getWorkspaceLimits(workspaceId);
  if (limits.maxProjects === -1) return;
  const count = await prisma.project.count({ where: { workspaceId, deletedAt: null } });
  if (count >= limits.maxProjects) {
    throw planLimit(`Plan allows at most ${limits.maxProjects} projects. Upgrade to create more.`);
  }
}

export async function assertCanAddMember(workspaceId: string): Promise<void> {
  const limits = await getWorkspaceLimits(workspaceId);
  if (limits.maxMembersPerWorkspace === -1) return;
  const count = await prisma.workspaceMember.count({ where: { workspaceId } });
  if (count >= limits.maxMembersPerWorkspace) {
    throw planLimit(`Plan allows at most ${limits.maxMembersPerWorkspace} members per workspace.`);
  }
}

export async function createWorkspace(userId: string, name: string) {
  const limits = await getUserWorkspaceCreationLimit(userId);
  if (limits.exceeded) {
    throw planLimit('Your plan does not allow additional workspaces. Upgrade to Agency.');
  }
  const slugBase = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const freePlan = await prisma.plan.findUniqueOrThrow({ where: { key: 'free' } });
  return prisma.workspace.create({
    data: {
      name,
      slug: `${slugBase}-${Date.now().toString(36)}`,
      members: { create: { userId, role: 'OWNER' } },
      subscription: { create: { planId: freePlan.id, status: 'ACTIVE' } },
    },
    include: { members: true },
  });
}

async function getUserWorkspaceCreationLimit(userId: string): Promise<{ exceeded: boolean }> {
  // A user's workspace allowance is the most generous plan among workspaces they own.
  const owned = await prisma.workspaceMember.findMany({
    where: { userId, role: 'OWNER' },
    include: { workspace: { include: { subscription: { include: { plan: true } } } } },
  });
  let maxAllowed = 1;
  for (const m of owned) {
    const limits = m.workspace.subscription?.plan.limits as unknown as PlanLimits | undefined;
    if (!limits) continue;
    if (limits.maxWorkspaces === -1) return { exceeded: false };
    maxAllowed = Math.max(maxAllowed, limits.maxWorkspaces);
  }
  return { exceeded: owned.length >= maxAllowed };
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: 'ADMIN' | 'EDITOR' | 'VIEWER',
) {
  await assertCanAddMember(workspaceId);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw notFound('No user with this email exists yet — ask them to sign up first.');
  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (existing) throw conflict('User is already a member of this workspace');
  return prisma.workspaceMember.create({
    data: { workspaceId, userId: user.id, role },
    include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
  });
}
