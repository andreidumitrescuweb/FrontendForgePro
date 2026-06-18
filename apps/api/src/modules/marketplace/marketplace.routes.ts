import { Router } from 'express';
import { z } from 'zod';
import { createListingSchema, reviewSchema, MARKETPLACE_REVENUE_SPLIT } from '@forge/shared';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { getStripe } from '../billing/stripe';
import { env } from '../../config/env';
import * as versions from '../projects/version.service';

export const marketplaceRouter = Router();

const browseSchema = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(60).optional(),
  license: z.enum(['PERSONAL', 'COMMERCIAL', 'EXTENDED']).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

/** Public browse with search + filters. */
marketplaceRouter.get('/listings', validate(browseSchema, 'query'), async (req, res, next) => {
  try {
    const { q, category, license, minRating, page } = req.query as unknown as z.infer<typeof browseSchema>;
    const where = {
      status: 'APPROVED' as const,
      ...(category ? { category } : {}),
      ...(license ? { license } : {}),
      ...(minRating ? { ratingAvg: { gte: minRating } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const PAGE_SIZE = 24;
    const [listings, total] = await Promise.all([
      prisma.templateListing.findMany({
        where,
        orderBy: [{ ratingAvg: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { seller: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      prisma.templateListing.count({ where }),
    ]);
    res.json({ listings, total, page, pageSize: PAGE_SIZE });
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.get('/listings/:listingId', async (req, res, next) => {
  try {
    const listing = await prisma.templateListing.findUnique({
      where: { id: req.params.listingId },
      include: {
        seller: { select: { id: true, name: true, avatarUrl: true } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { buyer: { select: { name: true } } },
        },
      },
    });
    if (!listing || listing.status !== 'APPROVED') throw notFound('Listing not found');
    res.json({ listing });
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.use(requireAuth);

/** Publish one of your projects as a template (goes to review queue). */
marketplaceRouter.post('/listings', validate(createListingSchema), async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.body.projectId,
        deletedAt: null,
        workspace: { members: { some: { userId: req.auth!.userId, role: { in: ['OWNER', 'ADMIN'] } } } },
      },
    });
    if (!project) throw notFound('Project not found or you lack permission');
    if (!project.currentVersionId) throw badRequest('Project has no generated code to publish');
    const existing = await prisma.templateListing.findUnique({ where: { projectId: project.id } });
    if (existing) throw conflict('Project is already listed');

    const listing = await prisma.templateListing.create({
      data: {
        projectId: project.id,
        sellerId: req.auth!.userId,
        title: req.body.title,
        description: req.body.description,
        priceCents: req.body.priceCents,
        license: req.body.license,
        category: req.body.category,
      },
    });
    audit({ userId: req.auth!.userId, action: 'marketplace.listing_create', entityId: listing.id });
    res.status(201).json({ listing });
  } catch (err) {
    next(err);
  }
});

/** Buy a template: free => instant clone; paid => Stripe checkout, fulfilled by webhook-like confirm. */
marketplaceRouter.post('/listings/:listingId/purchase', async (req, res, next) => {
  try {
    const listing = await prisma.templateListing.findUnique({ where: { id: req.params.listingId } });
    if (!listing || listing.status !== 'APPROVED') throw notFound('Listing not found');
    if (listing.sellerId === req.auth!.userId) throw badRequest('You cannot buy your own template');
    const already = await prisma.templatePurchase.findUnique({
      where: { listingId_buyerId: { listingId: listing.id, buyerId: req.auth!.userId } },
    });
    if (already) throw conflict('Already purchased');

    if (listing.priceCents === 0) {
      const purchase = await prisma.templatePurchase.create({
        data: { listingId: listing.id, buyerId: req.auth!.userId, pricePaidCents: 0, sellerShareCents: 0 },
      });
      res.status(201).json({ purchase });
      return;
    }

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: listing.priceCents,
            product_data: { name: `Template: ${listing.title}` },
          },
        },
      ],
      success_url: `${env.WEB_URL}/marketplace/${listing.id}?status=success`,
      cancel_url: `${env.WEB_URL}/marketplace/${listing.id}?status=canceled`,
      metadata: { kind: 'template', listingId: listing.id, buyerId: req.auth!.userId },
    });
    // Pending purchase row; webhook flips it on checkout.session.completed (kind=template).
    await prisma.templatePurchase.create({
      data: {
        listingId: listing.id,
        buyerId: req.auth!.userId,
        pricePaidCents: listing.priceCents,
        sellerShareCents: Math.round(listing.priceCents * MARKETPLACE_REVENUE_SPLIT.seller),
        stripePaymentId: session.id,
      },
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

/** Clone a purchased template into one of the buyer's workspaces. */
const cloneSchema = z.object({ workspaceId: z.string().cuid() });
marketplaceRouter.post(
  '/listings/:listingId/clone',
  validate(cloneSchema),
  async (req, res, next) => {
    try {
      const purchase = await prisma.templatePurchase.findUnique({
        where: { listingId_buyerId: { listingId: req.params.listingId!, buyerId: req.auth!.userId } },
        include: { listing: { include: { project: true } } },
      });
      if (!purchase) throw forbidden('Purchase required before cloning');
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: req.body.workspaceId, userId: req.auth!.userId } },
      });
      if (!member || member.role === 'VIEWER') throw forbidden('Editor access required in target workspace');

      const sourceBundle = await versions.getCurrentBundle(purchase.listing.projectId);
      if (!sourceBundle) throw badRequest('Template has no content');
      const project = await prisma.project.create({
        data: {
          workspaceId: req.body.workspaceId,
          name: `${purchase.listing.title} (template)`,
          type: purchase.listing.project.type,
          brief: purchase.listing.project.brief as object,
        },
      });
      await versions.createVersion({
        projectId: project.id,
        bundle: sourceBundle,
        label: 'Cloned from marketplace',
        createdById: req.auth!.userId,
      });
      res.status(201).json({ project });
    } catch (err) {
      next(err);
    }
  },
);

/** Review a template you purchased. */
marketplaceRouter.post(
  '/listings/:listingId/reviews',
  validate(reviewSchema),
  async (req, res, next) => {
    try {
      const purchase = await prisma.templatePurchase.findUnique({
        where: { listingId_buyerId: { listingId: req.params.listingId!, buyerId: req.auth!.userId } },
      });
      if (!purchase) throw forbidden('Only buyers can review');
      const review = await prisma.templateReview.upsert({
        where: { listingId_buyerId: { listingId: req.params.listingId!, buyerId: req.auth!.userId } },
        update: { rating: req.body.rating, comment: req.body.comment },
        create: {
          listingId: req.params.listingId!,
          buyerId: req.auth!.userId,
          rating: req.body.rating,
          comment: req.body.comment,
        },
      });
      const agg = await prisma.templateReview.aggregate({
        where: { listingId: req.params.listingId },
        _avg: { rating: true },
        _count: true,
      });
      await prisma.templateListing.update({
        where: { id: req.params.listingId },
        data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
      });
      res.status(201).json({ review });
    } catch (err) {
      next(err);
    }
  },
);
