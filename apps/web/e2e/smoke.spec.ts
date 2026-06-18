import { expect, test } from '@playwright/test';

test.describe('public pages', () => {
  test('landing page renders hero and CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('client-ready frontends');
    await expect(page.getByRole('link', { name: 'Start free' })).toBeVisible();
  });

  test('register page validates and links to login', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page offers OAuth providers', async ({ page }) => {
    await page.goto('/login');
    for (const provider of ['google', 'github', 'linkedin']) {
      await expect(page.getByRole('link', { name: provider })).toBeVisible();
    }
  });
});

// Full signup -> generate -> deploy flow requires the API + DB + an AI key;
// run with E2E_FULL=1 against a seeded stack.
test.describe('authenticated flow', () => {
  test.skip(process.env.E2E_FULL !== '1', 'requires full docker-compose stack');

  test('signup, create project, trigger generation', async ({ page }) => {
    const email = `e2e-${Date.now()}@test.local`;
    await page.goto('/register');
    await page.getByLabel('Full name').fill('E2E Tester');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('SuperSecret123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('link', { name: '+ New project' }).click();
    await page.getByLabel('Project name').fill('E2E Landing');
    await page.getByLabel(/What should this site be/).fill(
      'A simple landing page for an artisan bakery with hero, menu and contact sections.',
    );
    await page.getByLabel('Target audience').fill('Local foodies');
    await page.getByLabel('Brand tone').fill('Warm and friendly');
    await page.getByRole('button', { name: 'Create & generate' }).click();
    await expect(page).toHaveURL(/\/projects\//);
  });
});
