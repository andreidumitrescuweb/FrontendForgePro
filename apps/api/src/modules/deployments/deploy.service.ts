import type { GeneratedBundle } from '@forge/shared';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export interface DeployResult {
  externalId?: string;
  url?: string;
  status: 'BUILDING' | 'READY' | 'ERROR';
  logs?: unknown;
}

/**
 * Vercel: direct deployment with inline files — no git required.
 * https://vercel.com/docs/rest-api/endpoints/deployments
 */
export async function deployToVercel(projectName: string, bundle: GeneratedBundle): Promise<DeployResult> {
  if (!env.VERCEL_TOKEN) throw new Error('VERCEL_TOKEN not configured');
  const files = Object.entries(bundle.files).map(([file, data]) => ({ file, data }));
  const res = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 52),
      files,
      target: 'production',
      projectSettings: { framework: null },
    }),
  });
  const json = (await res.json()) as { id?: string; url?: string; error?: { message: string } };
  if (!res.ok || !json.id) {
    return { status: 'ERROR', logs: json.error ?? json };
  }
  return { externalId: json.id, url: json.url ? `https://${json.url}` : undefined, status: 'BUILDING' };
}

export async function getVercelStatus(deploymentId: string): Promise<DeployResult> {
  if (!env.VERCEL_TOKEN) throw new Error('VERCEL_TOKEN not configured');
  const res = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
    headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
  });
  const json = (await res.json()) as { readyState?: string; url?: string };
  const state = json.readyState;
  return {
    externalId: deploymentId,
    url: json.url ? `https://${json.url}` : undefined,
    status: state === 'READY' ? 'READY' : state === 'ERROR' || state === 'CANCELED' ? 'ERROR' : 'BUILDING',
  };
}

/**
 * Netlify: create a site (idempotent-ish by name) then deploy files via the
 * digest-less "files in body" zip-free JSON API.
 * https://docs.netlify.com/api/get-started/#deploy-with-the-api
 */
export async function deployToNetlify(projectName: string, bundle: GeneratedBundle): Promise<DeployResult> {
  if (!env.NETLIFY_TOKEN) throw new Error('NETLIFY_TOKEN not configured');
  const headers = { Authorization: `Bearer ${env.NETLIFY_TOKEN}`, 'Content-Type': 'application/json' };
  const siteName = `forge-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)}`;

  let siteId: string | undefined;
  const createRes = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: siteName }),
  });
  if (createRes.ok) {
    siteId = ((await createRes.json()) as { id: string }).id;
  } else {
    const list = (await (await fetch('https://api.netlify.com/api/v1/sites', { headers })).json()) as Array<{ id: string; name: string }>;
    siteId = list.find((s) => s.name === siteName)?.id;
  }
  if (!siteId) return { status: 'ERROR', logs: 'Could not create or find Netlify site' };

  // Async file digest deploy: send sha1 map, then upload required files.
  const crypto = await import('node:crypto');
  const shaOf = (c: string) => crypto.createHash('sha1').update(c).digest('hex');
  const fileMap: Record<string, string> = {};
  for (const [path, content] of Object.entries(bundle.files)) fileMap[`/${path}`] = shaOf(content);

  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ files: fileMap }),
  });
  const deploy = (await deployRes.json()) as { id: string; required?: string[]; ssl_url?: string };
  for (const sha of deploy.required ?? []) {
    const entry = Object.entries(bundle.files).find(([path]) => shaOf(bundle.files[path]!) === sha && fileMap[`/${path}`] === sha);
    if (!entry) continue;
    await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files/${encodeURIComponent(entry[0])}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${env.NETLIFY_TOKEN}`, 'Content-Type': 'application/octet-stream' },
      body: entry[1],
    });
  }
  return { externalId: deploy.id, url: deploy.ssl_url, status: 'BUILDING' };
}

/**
 * GitHub Pages: create a private repo for the user's account and push the
 * bundle via the Contents API, then enable Pages on main.
 */
export async function deployToGitHubPages(projectName: string, bundle: GeneratedBundle): Promise<DeployResult> {
  if (!env.GITHUB_APP_TOKEN) throw new Error('GITHUB_APP_TOKEN not configured');
  const headers = {
    Authorization: `Bearer ${env.GITHUB_APP_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  const repoName = `forge-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60)}`;

  const me = (await (await fetch('https://api.github.com/user', { headers })).json()) as { login: string };
  const createRes = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: repoName, private: true, auto_init: true }),
  });
  if (!createRes.ok && createRes.status !== 422) {
    return { status: 'ERROR', logs: await createRes.text() };
  }

  for (const [path, content] of Object.entries(bundle.files)) {
    const existing = await fetch(
      `https://api.github.com/repos/${me.login}/${repoName}/contents/${path}`,
      { headers },
    );
    const sha = existing.ok ? ((await existing.json()) as { sha: string }).sha : undefined;
    await fetch(`https://api.github.com/repos/${me.login}/${repoName}/contents/${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `FrontendForge deploy: ${path}`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        sha,
      }),
    });
  }

  await fetch(`https://api.github.com/repos/${me.login}/${repoName}/pages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ source: { branch: 'main', path: '/' } }),
  }).catch(() => undefined); // 409 if already enabled

  return {
    externalId: `${me.login}/${repoName}`,
    url: `https://${me.login}.github.io/${repoName}/`,
    status: 'BUILDING',
  };
}

/**
 * Cloudflare Pages requires an account-scoped project + wrangler-style direct
 * upload. Implemented as an explicit, honest stub: configure CLOUDFLARE_API_TOKEN
 * and finish createCloudflareProject/uploadCloudflareAssets before enabling in UI.
 */
export async function deployToCloudflarePages(): Promise<DeployResult> {
  logger.warn('Cloudflare Pages deploy requested but not yet implemented');
  return {
    status: 'ERROR',
    logs: 'Cloudflare Pages integration requires CLOUDFLARE_ACCOUNT_ID and the Direct Upload flow — see apps/api/src/modules/deployments/deploy.service.ts (TODO).',
  };
}
