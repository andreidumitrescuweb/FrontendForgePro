import zlib from 'node:zlib';
import type { GeneratedBundle } from '@forge/shared';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';

export function packBundle(bundle: GeneratedBundle): Buffer {
  return zlib.gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8'), { level: 9 });
}

export function unpackBundle(buf: Buffer | Uint8Array): GeneratedBundle {
  return JSON.parse(zlib.gunzipSync(Buffer.from(buf)).toString('utf8')) as GeneratedBundle;
}

/** Create an immutable version and point the project's HEAD at it. */
export async function createVersion(params: {
  projectId: string;
  bundle: GeneratedBundle;
  label?: string;
  branchName?: string;
  parentVersionId?: string;
  createdById?: string;
  setAsCurrent?: boolean;
}) {
  const last = await prisma.projectVersion.findFirst({
    where: { projectId: params.projectId },
    orderBy: { number: 'desc' },
    select: { number: true, id: true },
  });
  const version = await prisma.projectVersion.create({
    data: {
      projectId: params.projectId,
      number: (last?.number ?? 0) + 1,
      label: params.label,
      branchName: params.branchName ?? 'main',
      parentVersionId: params.parentVersionId ?? last?.id,
      bundleGz: packBundle(params.bundle),
      createdById: params.createdById,
    },
  });
  if (params.setAsCurrent !== false) {
    await prisma.project.update({
      where: { id: params.projectId },
      data: { currentVersionId: version.id },
    });
  }
  return version;
}

export async function getVersionBundle(projectId: string, versionId: string): Promise<GeneratedBundle> {
  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId },
  });
  if (!version) throw notFound('Version not found');
  return unpackBundle(version.bundleGz);
}

export async function getCurrentBundle(projectId: string): Promise<GeneratedBundle | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { currentVersion: true },
  });
  if (!project?.currentVersion) return null;
  return unpackBundle(project.currentVersion.bundleGz);
}

/** Restore = new immutable version whose content is the old one (history stays intact). */
export async function restoreVersion(projectId: string, versionId: string, userId: string) {
  const bundle = await getVersionBundle(projectId, versionId);
  return createVersion({
    projectId,
    bundle,
    label: `Restore of ${versionId.slice(-6)}`,
    createdById: userId,
  });
}

/** Branch: new version on a named branch starting from the given parent. */
export async function branchVersion(
  projectId: string,
  fromVersionId: string,
  branchName: string,
  userId: string,
) {
  const bundle = await getVersionBundle(projectId, fromVersionId);
  return createVersion({
    projectId,
    bundle,
    branchName,
    parentVersionId: fromVersionId,
    label: `Branch ${branchName}`,
    createdById: userId,
    setAsCurrent: false,
  });
}

/**
 * Merge: file-level three-way-lite merge — files changed only on the branch win,
 * conflicting files take the branch side and the conflict is reported.
 */
export async function mergeBranch(
  projectId: string,
  branchHeadId: string,
  userId: string,
): Promise<{ version: { id: string }; conflicts: string[] }> {
  const branchHead = await prisma.projectVersion.findFirst({
    where: { id: branchHeadId, projectId },
  });
  if (!branchHead) throw notFound('Branch head not found');
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { currentVersion: true },
  });
  const branchBundle = unpackBundle(branchHead.bundleGz);
  const mainBundle = project.currentVersion ? unpackBundle(project.currentVersion.bundleGz) : null;

  const conflicts: string[] = [];
  const merged: GeneratedBundle = mainBundle
    ? { ...mainBundle, files: { ...mainBundle.files } }
    : branchBundle;
  if (mainBundle) {
    let base: GeneratedBundle | null = null;
    if (branchHead.parentVersionId) {
      const parent = await prisma.projectVersion.findUnique({ where: { id: branchHead.parentVersionId } });
      base = parent ? unpackBundle(parent.bundleGz) : null;
    }
    for (const [path, content] of Object.entries(branchBundle.files)) {
      const mainContent = mainBundle.files[path];
      const baseContent = base?.files[path];
      if (mainContent !== undefined && mainContent !== content && mainContent !== baseContent) {
        conflicts.push(path);
      }
      merged.files[path] = content;
    }
  }

  const version = await createVersion({
    projectId,
    bundle: merged,
    label: `Merge ${branchHead.branchName} into main`,
    parentVersionId: project.currentVersionId ?? undefined,
    createdById: userId,
  });
  return { version, conflicts };
}
