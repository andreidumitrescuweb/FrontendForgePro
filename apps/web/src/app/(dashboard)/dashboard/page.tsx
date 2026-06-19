'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { Badge, Button, Card, CardContent, Input, Spinner } from '@/components/ui';

interface WorkspaceSummary {
  id: string;
  name: string;
  role: string;
  plan: string;
  projectCount: number;
  memberCount: number;
}

interface ProjectSummary {
  id: string;
  name: string;
  type: string;
  updatedAt: string;
  currentVersionId: string | null;
  _count: { versions: number; deployments: number };
}

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWs, setActiveWs] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [newWsName, setNewWsName] = useState('');

  const loadWorkspaces = useCallback(async () => {
    const res = await apiGet<{ workspaces: WorkspaceSummary[] }>('/workspaces');
    setWorkspaces(res.workspaces);
    setActiveWs((current) => current ?? res.workspaces[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (!activeWs) return;
    setProjects(null);
    void apiGet<{ projects: ProjectSummary[] }>(`/projects/workspace/${activeWs}`).then((res) =>
      setProjects(res.projects),
    );
  }, [activeWs]);

  async function createWorkspace() {
    if (newWsName.trim().length < 2) return;
    await apiPost('/workspaces', { name: newWsName.trim() });
    setNewWsName('');
    await loadWorkspaces();
  }

  async function deleteProject(id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    setProjects((prev) => prev?.filter((p) => p.id !== id) ?? null);
    try {
      await apiDelete(`/projects/${id}`);
    } catch {
      // Re-sync if the delete failed server-side.
      if (activeWs) {
        const res = await apiGet<{ projects: ProjectSummary[] }>(`/projects/workspace/${activeWs}`);
        setProjects(res.projects);
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        {activeWs && (
          <Link href={`/projects/new?workspace=${activeWs}`}>
            <Button>+ New project</Button>
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => setActiveWs(ws.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              activeWs === ws.id
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {ws.name} <Badge variant="neutral" className="ml-1">{ws.plan}</Badge>
          </button>
        ))}
        <span className="flex items-center gap-2">
          <Input
            value={newWsName}
            onChange={(e) => setNewWsName(e.target.value)}
            placeholder="New workspace…"
            className="h-9 w-44"
          />
          <Button variant="outline" size="sm" onClick={() => void createWorkspace()}>
            Add
          </Button>
        </span>
      </div>

      <div className="mt-8">
        {projects === null ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-slate-500">
              No projects yet. Describe your first site and let the AI build it.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card key={p.id} className="group relative transition-shadow hover:shadow-md">
                <button
                  onClick={() => void deleteProject(p.id, p.name)}
                  aria-label={`Delete ${p.name}`}
                  title="Delete project"
                  className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                >
                  🗑
                </button>
                <Link href={`/projects/${p.id}`}>
                  <CardContent>
                    <div className="flex items-start justify-between">
                      <h2 className="font-semibold">{p.name}</h2>
                      <Badge variant={p.currentVersionId ? 'success' : 'warning'}>
                        {p.currentVersionId ? 'Generated' : 'Draft'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                      {p.type.replace('_', ' ').toLowerCase()}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      {p._count.versions} versions · {p._count.deployments} deploys · updated{' '}
                      {timeAgo(p.updatedAt)}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
