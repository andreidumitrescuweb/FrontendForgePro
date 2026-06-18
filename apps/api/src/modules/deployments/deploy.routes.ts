import { Router } from 'express';
import { deploySchema } from '@forge/shared';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/workspace';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/errors';
import { getCurrentBundle } from '../projects/version.service';
import * as deploy from './deploy.service';

export const deployRouter = Router();
deployRouter.use(requireAuth);

deployRouter.post(
  '/projects/:projectId/deploy',
  requireProjectRole('EDITOR'),
  validate(deploySchema),
  async (req, res, next) => {
    try {
      const project = await prisma.project.findUniqueOrThrow({ where: { id: req.params.projectId } });
      const bundle = await getCurrentBundle(project.id);
      if (!bundle) throw badRequest('Generate the project before deploying');

      const record = await prisma.deployment.create({
        data: { projectId: project.id, provider: req.body.provider, status: 'PENDING' },
      });

      let result: deploy.DeployResult = { status: 'ERROR', logs: 'Unknown provider' };
      try {
        switch (req.body.provider) {
          case 'VERCEL':
            result = await deploy.deployToVercel(project.name, bundle);
            break;
          case 'NETLIFY':
            result = await deploy.deployToNetlify(project.name, bundle);
            break;
          case 'GITHUB_PAGES':
            result = await deploy.deployToGitHubPages(project.name, bundle);
            break;
          case 'CLOUDFLARE_PAGES':
            result = await deploy.deployToCloudflarePages();
            break;
        }
      } catch (err) {
        result = { status: 'ERROR', logs: String(err) };
      }

      const updated = await prisma.deployment.update({
        where: { id: record.id },
        data: {
          status: result.status,
          url: result.url,
          externalId: result.externalId,
          logs: (result.logs ?? undefined) as object | undefined,
        },
      });
      audit({
        userId: req.auth!.userId,
        workspaceId: project.workspaceId,
        action: 'project.deploy',
        entityId: project.id,
        meta: { provider: req.body.provider, status: result.status },
        ip: req.ip,
      });
      res.status(201).json({ deployment: updated });
    } catch (err) {
      next(err);
    }
  },
);

/** Poll live status (Vercel only has a live status API in this implementation). */
deployRouter.get(
  '/projects/:projectId/deployments/:deploymentId',
  requireProjectRole('VIEWER'),
  async (req, res, next) => {
    try {
      const record = await prisma.deployment.findFirst({
        where: { id: req.params.deploymentId, projectId: req.params.projectId },
      });
      if (!record) throw notFound('Deployment not found');

      if (record.provider === 'VERCEL' && record.externalId && record.status === 'BUILDING') {
        const live = await deploy.getVercelStatus(record.externalId);
        if (live.status !== record.status) {
          const updated = await prisma.deployment.update({
            where: { id: record.id },
            data: { status: live.status, url: live.url ?? record.url },
          });
          res.json({ deployment: updated });
          return;
        }
      }
      res.json({ deployment: record });
    } catch (err) {
      next(err);
    }
  },
);
