import Stripe from 'stripe';
import { env } from '../../config/env';

/** Lazily-initialized Stripe client; billing routes fail gracefully when unconfigured. */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
  }
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  }
  return client;
}
