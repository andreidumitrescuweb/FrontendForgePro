import { Router } from 'express';
import { z } from 'zod';
import { CREDIT_PACKS } from '@forge/shared';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspaceRole } from '../../middleware/workspace';
import { validate } from '../../middleware/validate';
import { badRequest, notFound } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { getStripe } from './stripe';
import { env } from '../../config/env';

export const billingRouter = Router();

billingRouter.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
    res.json({ plans, creditPacks: CREDIT_PACKS });
  } catch (err) {
    next(err);
  }
});

billingRouter.use(requireAuth);

async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

const subscribeSchema = z.object({
  workspaceId: z.string().cuid(),
  planKey: z.enum(['pro', 'agency']),
});

/** Subscription checkout for a workspace (Pro / Agency). */
billingRouter.post(
  '/checkout/subscription',
  validate(subscribeSchema),
  requireWorkspaceRole('OWNER'),
  async (req, res, next) => {
    try {
      const plan = await prisma.plan.findUnique({ where: { key: req.body.planKey } });
      if (!plan?.stripePriceId) throw badRequest('Plan is not purchasable (missing Stripe price)');
      const customerId = await ensureStripeCustomer(req.auth!.userId);
      const session = await getStripe().checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: `${env.WEB_URL}/billing?status=success`,
        cancel_url: `${env.WEB_URL}/billing?status=canceled`,
        metadata: { kind: 'subscription', workspaceId: req.body.workspaceId, planKey: plan.key },
        subscription_data: {
          metadata: { workspaceId: req.body.workspaceId, planKey: plan.key },
        },
      });
      res.json({ url: session.url });
    } catch (err) {
      next(err);
    }
  },
);

const creditsSchema = z.object({ packId: z.string() });

/** One-time purchase of extra generation credits. */
billingRouter.post('/checkout/credits', validate(creditsSchema), async (req, res, next) => {
  try {
    const pack = CREDIT_PACKS.find((p) => p.id === req.body.packId);
    if (!pack) throw notFound('Unknown credit pack');
    const customerId = await ensureStripeCustomer(req.auth!.userId);
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pack.priceCents,
            product_data: { name: `FrontendForge ${pack.credits} generation credits` },
          },
        },
      ],
      success_url: `${env.WEB_URL}/billing?status=success`,
      cancel_url: `${env.WEB_URL}/billing?status=canceled`,
      metadata: { kind: 'credits', packId: pack.id, userId: req.auth!.userId },
    });
    await prisma.creditPurchase.create({
      data: {
        userId: req.auth!.userId,
        packId: pack.id,
        credits: pack.credits,
        amountCents: pack.priceCents,
        stripePaymentIntentId: session.id, // replaced by PI id on webhook fulfillment
      },
    });
    audit({ userId: req.auth!.userId, action: 'billing.credits_checkout', meta: { packId: pack.id } });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

/** Stripe customer portal for self-service plan management. */
billingRouter.post('/portal', async (req, res, next) => {
  try {
    const customerId = await ensureStripeCustomer(req.auth!.userId);
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.WEB_URL}/billing`,
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});
