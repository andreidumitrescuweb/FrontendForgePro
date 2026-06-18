import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { audit } from '../../lib/audit';
import { env } from '../../config/env';
import { getStripe } from './stripe';

/**
 * Stripe webhook handler. Mounted with express.raw() BEFORE the JSON body
 * parser so signature verification sees the exact payload bytes.
 */
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  let event: Stripe.Event;
  try {
    if (!env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET not set');
    event = getStripe().webhooks.constructEvent(
      req.body as Buffer,
      req.headers['stripe-signature'] as string,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', { err: String(err) });
    res.status(400).json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid signature' } });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.metadata?.kind === 'credits' && session.metadata.userId) {
          const purchase = await prisma.creditPurchase.findFirst({
            where: { stripePaymentIntentId: session.id, fulfilled: false },
          });
          if (purchase) {
            await prisma.$transaction([
              prisma.creditPurchase.update({
                where: { id: purchase.id },
                data: {
                  fulfilled: true,
                  stripePaymentIntentId: String(session.payment_intent ?? session.id),
                },
              }),
              prisma.user.update({
                where: { id: purchase.userId },
                data: { credits: { increment: purchase.credits } },
              }),
            ]);
            audit({ userId: purchase.userId, action: 'billing.credits_fulfilled', meta: { credits: purchase.credits } });
          }
        }
        if (session.metadata?.kind === 'template' && session.metadata.listingId) {
          // Marketplace purchase: mark fulfilled (pending row keyed by session id).
          await prisma.templatePurchase.updateMany({
            where: { stripePaymentId: session.id },
            data: { stripePaymentId: String(session.payment_intent ?? session.id) },
          });
          audit({
            userId: session.metadata.buyerId,
            action: 'marketplace.purchase_fulfilled',
            entityId: session.metadata.listingId,
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const workspaceId = sub.metadata?.workspaceId;
        const planKey = sub.metadata?.planKey;
        if (workspaceId && planKey) {
          const plan = await prisma.plan.findUnique({ where: { key: planKey } });
          if (plan) {
            const status =
              sub.status === 'active'
                ? 'ACTIVE'
                : sub.status === 'past_due'
                  ? 'PAST_DUE'
                  : sub.status === 'trialing'
                    ? 'TRIALING'
                    : sub.status === 'canceled'
                      ? 'CANCELED'
                      : 'INCOMPLETE';
            await prisma.subscription.upsert({
              where: { workspaceId },
              update: {
                planId: plan.id,
                stripeSubscriptionId: sub.id,
                status,
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
              },
              create: {
                workspaceId,
                planId: plan.id,
                stripeSubscriptionId: sub.id,
                status,
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
              },
            });
            audit({ workspaceId, action: 'billing.subscription_updated', meta: { planKey, status } });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const existing = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });
        if (existing) {
          // Downgrade to Free instead of deleting — the workspace keeps working.
          const free = await prisma.plan.findUniqueOrThrow({ where: { key: 'free' } });
          await prisma.subscription.update({
            where: { id: existing.id },
            data: { planId: free.id, status: 'ACTIVE', stripeSubscriptionId: null },
          });
          audit({ workspaceId: existing.workspaceId, action: 'billing.subscription_canceled' });
        }
        break;
      }

      case 'invoice.paid':
        logger.info('Invoice paid', { invoiceId: event.data.object.id });
        break;

      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook processing failed', { type: event.type, err: String(err) });
    // 500 => Stripe retries with backoff.
    res.status(500).json({ error: { code: 'WEBHOOK_ERROR', message: 'Processing failed' } });
  }
}
