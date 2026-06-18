import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { notFound } from '../../lib/errors';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN', 'SUPERADMIN'));

/** Business metrics dashboard: MRR, churn proxy, usage, AI spend estimate. */
adminRouter.get('/metrics', async (_req, res, next) => {
  try {
    const [users, workspaces, projects, generations, subs, purchases] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count({ where: { deletedAt: null } }),
      prisma.project.count({ where: { deletedAt: null } }),
      prisma.generationJob.count(),
      prisma.subscription.findMany({ where: { status: 'ACTIVE' }, include: { plan: true } }),
      prisma.creditPurchase.aggregate({ where: { fulfilled: true }, _sum: { amountCents: true } }),
    ]);
    const mrrCents = subs.reduce(
      (sum, s) => sum + Math.max(0, s.plan.priceMonthly),
      0,
    );
    const canceled = await prisma.subscription.count({ where: { status: 'CANCELED' } });
    const churnRate = subs.length + canceled > 0 ? canceled / (subs.length + canceled) : 0;
    const completedGen = await prisma.generationJob.count({ where: { status: 'COMPLETED' } });
    // Rough AI cost model: ~$0.05 per completed generation (tune from real usage).
    const estimatedAiCostCents = Math.round(completedGen * 5);

    res.json({
      metrics: {
        users,
        workspaces,
        projects,
        generations,
        completedGenerations: completedGen,
        mrrCents,
        churnRate,
        creditRevenueCents: purchases._sum.amountCents ?? 0,
        estimatedAiCostCents,
        ltvCents: users > 0 ? Math.round((mrrCents * 12) / Math.max(1, subs.length)) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().max(200).optional(),
});

adminRouter.get('/users', validate(pageSchema, 'query'), async (req, res, next) => {
  try {
    const { page, q } = req.query as unknown as z.infer<typeof pageSchema>;
    const where = q
      ? { OR: [{ email: { contains: q, mode: 'insensitive' as const } }, { name: { contains: q, mode: 'insensitive' as const } }] }
      : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50,
      select: {
        id: true, email: true, name: true, role: true, credits: true,
        totpEnabled: true, createdAt: true,
        _count: { select: { memberships: true, generationJobs: true } },
      },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

const roleSchema = z.object({ role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']) });
adminRouter.patch('/users/:userId/role', requireRole('SUPERADMIN'), validate(roleSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { role: req.body.role },
    });
    audit({ userId: req.auth!.userId, action: 'admin.user_role_change', entityId: user.id, meta: { role: req.body.role } });
    res.json({ user: { id: user.id, role: user.role } });
  } catch (err) {
    next(err);
  }
});

/** Suspend a user: revoke all sessions. (Re-enable by issuing none — they can log in again only if you restore.) */
adminRouter.post('/users/:userId/revoke-sessions', async (req, res, next) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId: req.params.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    audit({ userId: req.auth!.userId, action: 'admin.sessions_revoked', entityId: req.params.userId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/subscriptions', async (_req, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: { plan: true, workspace: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    res.json({ subscriptions });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/audit-logs', validate(pageSchema, 'query'), async (req, res, next) => {
  try {
    const { page } = req.query as unknown as z.infer<typeof pageSchema>;
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 100,
      take: 100,
      include: { user: { select: { email: true, name: true } } },
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

/** Marketplace review queue. */
adminRouter.get('/listings/pending', async (_req, res, next) => {
  try {
    const listings = await prisma.templateListing.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: { seller: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ listings });
  } catch (err) {
    next(err);
  }
});

const moderateSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) });
adminRouter.post('/listings/:listingId/moderate', validate(moderateSchema), async (req, res, next) => {
  try {
    const listing = await prisma.templateListing.findUnique({ where: { id: req.params.listingId } });
    if (!listing) throw notFound('Listing not found');
    const updated = await prisma.templateListing.update({
      where: { id: listing.id },
      data: { status: req.body.decision },
    });
    audit({ userId: req.auth!.userId, action: `admin.listing_${req.body.decision.toLowerCase()}`, entityId: listing.id });
    res.json({ listing: updated });
  } catch (err) {
    next(err);
  }
});

/** Global runtime config (AI model toggles, base prompts, global rate limits). */
adminRouter.get('/config', async (_req, res, next) => {
  try {
    const entries = await prisma.appConfig.findMany();
    res.json({ config: Object.fromEntries(entries.map((e) => [e.key, e.value])) });
  } catch (err) {
    next(err);
  }
});

const configSchema = z.object({ key: z.string().min(1).max(120), value: z.unknown() });
adminRouter.put('/config', requireRole('SUPERADMIN'), validate(configSchema), async (req, res, next) => {
  try {
    const entry = await prisma.appConfig.upsert({
      where: { key: req.body.key },
      update: { value: req.body.value as object },
      create: { key: req.body.key, value: req.body.value as object },
    });
    audit({ userId: req.auth!.userId, action: 'admin.config_update', meta: { key: req.body.key } });
    res.json({ config: entry });
  } catch (err) {
    next(err);
  }
});
