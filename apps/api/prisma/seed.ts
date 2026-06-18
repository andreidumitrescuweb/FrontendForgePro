import { PrismaClient } from '@prisma/client';
import { PLANS } from '@forge/shared';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const plan of Object.values(PLANS)) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        priceMonthly: plan.priceMonthlyCents,
        limits: plan.limits as object,
      },
      create: {
        key: plan.key,
        name: plan.name,
        priceMonthly: plan.priceMonthlyCents,
        stripePriceId:
          plan.key === 'pro'
            ? process.env.STRIPE_PRICE_PRO_MONTHLY ?? null
            : plan.key === 'agency'
              ? process.env.STRIPE_PRICE_AGENCY_MONTHLY ?? null
              : null,
        limits: plan.limits as object,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log('Seeded subscription plans:', Object.keys(PLANS).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
