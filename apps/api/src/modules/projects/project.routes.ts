import { Router } from 'express';
import archiver from 'archiver';
import {
  aiEditSchema,
  createProjectSchema,
  createVersionSchema,
  projectBriefSchema,
} from '@forge/shared';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole, requireWorkspaceRole } from '../../middleware/workspace';
import { validate } from '../../middleware/validate';
import { generationLimiter } from '../../middleware/rateLimit';
import { audit } from '../../lib/audit';
import { badRequest, notFound, planLimit } from '../../lib/errors';
import { assertCanCreateProject, getWorkspaceLimits } from '../workspaces/workspace.service';
import * as versions from './version.service';
import { generationQueue } from '../../queues/generation.queue';
import { generateCompletion } from '../../services/ai/providers';
import { EDIT_SYSTEM } from '../../services/ai/prompts';
import { extractJson } from '../../services/ai/validators';
import { redis } from '../../lib/redis';

export const projectRouter = Router();
projectRouter.use(requireAuth);

// ---------- CRUD ----------

projectRouter.post('/', validate(createProjectSchema), requireWorkspaceRole('EDITOR'), async (req, res, next) => {
  try {
    await assertCanCreateProject(req.body.workspaceId);
    const project = await prisma.project.create({
      data: {
        workspaceId: req.body.workspaceId,
        name: req.body.name,
        type: req.body.brief.projectType,
        brief: req.body.brief,
      },
    });
    audit({
      userId: req.auth!.userId,
      workspaceId: project.workspaceId,
      action: 'project.create',
      entity: 'Project',
      entityId: project.id,
      ip: req.ip,
    });
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

projectRouter.get('/workspace/:workspaceId', requireWorkspaceRole('VIEWER'), async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { workspaceId: req.params.workspaceId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true,
        currentVersionId: true,
        _count: { select: { versions: true, deployments: true } },
      },
    });
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

projectRouter.get('/:projectId', requireProjectRole('VIEWER'), async (req, res, next) => {
  try {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: req.params.projectId },
      include: { deployments: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    const bundle = await versions.getCurrentBundle(project.id);
    res.json({ project, bundle });
  } catch (err) {
    next(err);
  }
});

projectRouter.delete('/:projectId', requireProjectRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.project.update({
      where: { id: req.params.projectId },
      data: { deletedAt: new Date() },
    });
    audit({
      userId: req.auth!.userId,
      workspaceId: req.workspaceMember!.workspaceId,
      action: 'project.delete',
      entityId: req.params.projectId,
      ip: req.ip,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- Generation ----------

projectRouter.post(
  '/:projectId/generate',
  generationLimiter,
  requireProjectRole('EDITOR'),
  async (req, res, next) => {
    try {
      const project = await prisma.project.findUniqueOrThrow({ where: { id: req.params.projectId } });
      const brief = projectBriefSchema.parse(req.body.brief ?? project.brief);

      // Daily generation quota (plan-level), enforced via a Redis day-counter.
      const limits = await getWorkspaceLimits(project.workspaceId);
      if (limits.generationsPerDay !== -1) {
        const day = new Date().toISOString().slice(0, 10);
        const key = `genquota:${project.workspaceId}:${day}`;
        const used = await redis.incr(key);
        if (used === 1) await redis.expire(key, 60 * 60 * 26);
        if (used > limits.generationsPerDay) {
          const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
          if (user.credits > 0) {
            await prisma.user.update({
              where: { id: user.id },
              data: { credits: { decrement: 1 } },
            });
          } else {
            throw planLimit(
              `Daily limit of ${limits.generationsPerDay} generations reached. Buy credits or upgrade.`,
            );
          }
        }
      }

      const job = await prisma.generationJob.create({
        data: { projectId: project.id, userId: req.auth!.userId, status: 'QUEUED', input: brief },
      });
      await generationQueue.add('generate', {
        jobId: job.id,
        projectId: project.id,
        userId: req.auth!.userId,
      });
      audit({
        userId: req.auth!.userId,
        workspaceId: project.workspaceId,
        action: 'project.generate',
        entityId: project.id,
        ip: req.ip,
      });
      res.status(202).json({ jobId: job.id, status: job.status });
    } catch (err) {
      next(err);
    }
  },
);

projectRouter.get('/:projectId/jobs/:jobId', requireProjectRole('VIEWER'), async (req, res, next) => {
  try {
    const job = await prisma.generationJob.findFirst({
      where: { id: req.params.jobId, projectId: req.params.projectId },
    });
    if (!job) throw notFound('Job not found');
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

// ---------- AI Edit (selection fix + whole-project chat instruction) ----------

projectRouter.post(
  '/:projectId/ai-edit',
  generationLimiter,
  requireProjectRole('EDITOR'),
  validate(aiEditSchema),
  async (req, res, next) => {
    try {
      const bundle = await versions.getCurrentBundle(req.params.projectId!);
      if (!bundle) throw badRequest('Project has no generated code yet');

      let context: string;
      if (req.body.selection) {
        const { filePath, startLine, endLine } = req.body.selection;
        const file = bundle.files[filePath];
        if (!file) throw badRequest(`File ${filePath} not found`);
        const snippet = file.split('\n').slice(startLine - 1, endLine).join('\n');
        context = `Project files:\n${JSON.stringify(bundle.files)}\n\nThe user selected lines ${startLine}-${endLine} of ${filePath}:\n${snippet}`;
      } else {
        context = `Project files:\n${JSON.stringify(bundle.files)}`;
      }

      const result = await generateCompletion({
        system: EDIT_SYSTEM,
        user: `${context}\n\nInstruction: ${req.body.instruction}`,
        maxTokens: 8192,
        temperature: 0.4,
      });
      const changed = extractJson<{ files: Record<string, string> }>(result.text);
      const newBundle = { ...bundle, files: { ...bundle.files, ...changed.files } };
      const version = await versions.createVersion({
        projectId: req.params.projectId!,
        bundle: newBundle,
        label: `AI edit: ${req.body.instruction.slice(0, 60)}`,
        createdById: req.auth!.userId,
      });
      res.json({ versionId: version.id, changedFiles: Object.keys(changed.files), bundle: newBundle });
    } catch (err) {
      next(err);
    }
  },
);

// ---------- Versions ----------

projectRouter.get('/:projectId/versions', requireProjectRole('VIEWER'), async (req, res, next) => {
  try {
    const limits = await getWorkspaceLimits(req.workspaceMember!.workspaceId);
    const list = await prisma.projectVersion.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { number: 'desc' },
      take: limits.unlimitedHistory ? undefined : 20,
      select: {
        id: true,
        number: true,
        label: true,
        branchName: true,
        parentVersionId: true,
        thumbnailUrl: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
    res.json({ versions: list });
  } catch (err) {
    next(err);
  }
});

projectRouter.post(
  '/:projectId/versions',
  requireProjectRole('EDITOR'),
  validate(createVersionSchema),
  async (req, res, next) => {
    try {
      const current = await versions.getCurrentBundle(req.params.projectId!);
      const bundle = current
        ? { ...current, files: req.body.files }
        : { files: req.body.files, entryFile: 'index.html', assets: [], seo: null };
      const version = await versions.createVersion({
        projectId: req.params.projectId!,
        bundle,
        label: req.body.label,
        branchName: req.body.branchName,
        parentVersionId: req.body.parentVersionId,
        createdById: req.auth!.userId,
      });
      res.status(201).json({ version });
    } catch (err) {
      next(err);
    }
  },
);

projectRouter.get(
  '/:projectId/versions/:versionId',
  requireProjectRole('VIEWER'),
  async (req, res, next) => {
    try {
      const bundle = await versions.getVersionBundle(req.params.projectId!, req.params.versionId!);
      res.json({ bundle });
    } catch (err) {
      next(err);
    }
  },
);

projectRouter.post(
  '/:projectId/versions/:versionId/restore',
  requireProjectRole('EDITOR'),
  async (req, res, next) => {
    try {
      const version = await versions.restoreVersion(
        req.params.projectId!,
        req.params.versionId!,
        req.auth!.userId,
      );
      res.json({ version });
    } catch (err) {
      next(err);
    }
  },
);

const branchSchema = z.object({ branchName: z.string().min(1).max(60) });
projectRouter.post(
  '/:projectId/versions/:versionId/branch',
  requireProjectRole('EDITOR'),
  validate(branchSchema),
  async (req, res, next) => {
    try {
      const version = await versions.branchVersion(
        req.params.projectId!,
        req.params.versionId!,
        req.body.branchName,
        req.auth!.userId,
      );
      res.status(201).json({ version });
    } catch (err) {
      next(err);
    }
  },
);

projectRouter.post(
  '/:projectId/versions/:versionId/merge',
  requireProjectRole('EDITOR'),
  async (req, res, next) => {
    try {
      const result = await versions.mergeBranch(
        req.params.projectId!,
        req.params.versionId!,
        req.auth!.userId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------- Export ----------

projectRouter.get('/:projectId/export', requireProjectRole('VIEWER'), async (req, res, next) => {
  try {
    const bundle = await versions.getCurrentBundle(req.params.projectId!);
    if (!bundle) throw badRequest('Nothing to export yet');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="project-${req.params.projectId}.zip"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    for (const [path, content] of Object.entries(bundle.files)) {
      archive.append(content, { name: path });
    }
    for (const asset of bundle.assets) {
      try {
        const r = await fetch(asset.url);
        archive.append(Buffer.from(await r.arrayBuffer()), { name: asset.path });
      } catch {
        // Asset fetch failure should not abort the export.
      }
    }
    await archive.finalize();
  } catch (err) {
    next(err);
  }
});
