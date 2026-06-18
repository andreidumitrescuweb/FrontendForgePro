'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Badge, Button, Spinner } from '@/components/ui';
import { timeAgo } from '@/lib/utils';

interface Version {
  id: string;
  number: number;
  label: string | null;
  branchName: string;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}

interface Props {
  projectId: string;
  onRestored: () => void;
}

export function VersionTimeline({ projectId, onRestored }: Props) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await apiGet<{ versions: Version[] }>(`/projects/${projectId}/versions`);
    setVersions(res.versions);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function restore(versionId: string) {
    setBusyId(versionId);
    try {
      await apiPost(`/projects/${projectId}/versions/${versionId}/restore`);
      await load();
      onRestored();
    } finally {
      setBusyId(null);
    }
  }

  async function branch(versionId: string) {
    const name = window.prompt('Branch name (e.g. experiment-hero)');
    if (!name) return;
    setBusyId(versionId);
    try {
      await apiPost(`/projects/${projectId}/versions/${versionId}/branch`, { branchName: name });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function merge(versionId: string) {
    setBusyId(versionId);
    try {
      const res = await apiPost<{ conflicts: string[] }>(
        `/projects/${projectId}/versions/${versionId}/merge`,
      );
      if (res.conflicts.length) {
        window.alert(`Merged with conflicts in: ${res.conflicts.join(', ')} (branch side kept)`);
      }
      await load();
      onRestored();
    } finally {
      setBusyId(null);
    }
  }

  if (versions === null) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <ol className="space-y-2 p-3">
      {versions.map((v) => (
        <li key={v.id} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              v{v.number} {v.label && <span className="font-normal text-slate-500">— {v.label}</span>}
            </p>
            {v.branchName !== 'main' && <Badge variant="warning">{v.branchName}</Badge>}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {v.createdBy?.name ?? 'AI'} · {timeAgo(v.createdAt)}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" disabled={busyId === v.id} onClick={() => void restore(v.id)}>
              Restore
            </Button>
            {v.branchName === 'main' ? (
              <Button size="sm" variant="ghost" disabled={busyId === v.id} onClick={() => void branch(v.id)}>
                Branch
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={busyId === v.id} onClick={() => void merge(v.id)}>
                Merge → main
              </Button>
            )}
          </div>
        </li>
      ))}
      {versions.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">No versions yet.</p>
      )}
    </ol>
  );
}
