import { Router } from 'express';
import { analyticsEventSchema } from '@forge/shared';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/workspace';
import { validate } from '../../middleware/validate';
import { analyticsLimiter } from '../../middleware/rateLimit';
import { sha256 } from '../../lib/crypto';
import { getWorkspaceLimits } from '../workspaces/workspace.service';
import { planLimit } from '../../lib/errors';
import { env } from '../../config/env';

export const analyticsRouter = Router();

/** Self-hosted, privacy-friendly tracking snippet injected into generated sites. */
analyticsRouter.get('/script.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(`(function(){
  var k=document.currentScript&&document.currentScript.getAttribute('data-project');
  if(!k)return;
  var s=Date.now();
  function send(type,name){
    try{navigator.sendBeacon('${env.API_URL}/api/v1/analytics/ingest',JSON.stringify({
      projectKey:k,type:type,path:location.pathname,referrer:document.referrer||undefined,name:name
    }));}catch(e){}
  }
  send('pageview');
  addEventListener('pagehide',function(){send('event','time_on_page_'+Math.round((Date.now()-s)/1000));});
})();`);
});

/** Public ingest endpoint (sendBeacon posts text/plain). */
analyticsRouter.post('/ingest', analyticsLimiter, async (req, res) => {
  try {
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const parsed = analyticsEventSchema.safeParse(raw);
    if (!parsed.success) {
      res.status(204).end(); // never error toward tracked sites
      return;
    }
    const project = await prisma.project.findUnique({
      where: { analyticsKey: parsed.data.projectKey },
      select: { id: true },
    });
    if (project) {
      await prisma.analyticsEvent.create({
        data: {
          projectId: project.id,
          type: parsed.data.type,
          name: parsed.data.name,
          path: parsed.data.path,
          referrer: parsed.data.referrer,
          // UA hash only — no raw fingerprintable data stored.
          uaHash: sha256(`${req.get('user-agent') ?? ''}:${req.ip ?? ''}`).slice(0, 16),
        },
      });
    }
    res.status(204).end();
  } catch {
    res.status(204).end();
  }
});

/** In-app analytics dashboard data (plan-gated). */
analyticsRouter.get(
  '/projects/:projectId/stats',
  requireAuth,
  requireProjectRole('VIEWER'),
  async (req, res, next) => {
    try {
      const limits = await getWorkspaceLimits(req.workspaceMember!.workspaceId);
      if (!limits.analytics) throw planLimit('Analytics requires the Agency plan');

      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const events = await prisma.analyticsEvent.findMany({
        where: { projectId: req.params.projectId, createdAt: { gte: since } },
        select: { type: true, path: true, name: true, uaHash: true, createdAt: true, referrer: true },
      });
      const pageviews = events.filter((e) => e.type === 'pageview');
      const visitors = new Set(pageviews.map((e) => e.uaHash)).size;
      const byPath = new Map<string, number>();
      for (const e of pageviews) byPath.set(e.path, (byPath.get(e.path) ?? 0) + 1);
      const timeEvents = events.filter((e) => e.name?.startsWith('time_on_page_'));
      const avgTime = timeEvents.length
        ? timeEvents.reduce((s, e) => s + Number(e.name!.replace('time_on_page_', '')), 0) / timeEvents.length
        : 0;
      // Bounce: sessions (uaHash) with exactly one pageview.
      const perVisitor = new Map<string, number>();
      for (const e of pageviews) perVisitor.set(e.uaHash ?? '', (perVisitor.get(e.uaHash ?? '') ?? 0) + 1);
      const bounces = [...perVisitor.values()].filter((n) => n === 1).length;

      res.json({
        stats: {
          pageviews: pageviews.length,
          visitors,
          avgTimeOnPageSec: Math.round(avgTime),
          bounceRate: perVisitor.size ? bounces / perVisitor.size : 0,
          topPages: [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([path, count]) => ({ path, count })),
          topReferrers: topCounts(pageviews.map((e) => e.referrer).filter(Boolean) as string[]),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

function topCounts(values: string[]): Array<{ value: string; count: number }> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([value, count]) => ({ value, count }));
}
