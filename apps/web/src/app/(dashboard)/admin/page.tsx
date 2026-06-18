'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { formatCents, timeAgo } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '@/components/ui';

interface Metrics {
  users: number;
  workspaces: number;
  projects: number;
  generations: number;
  completedGenerations: number;
  mrrCents: number;
  churnRate: number;
  creditRevenueCents: number;
  estimatedAiCostCents: number;
  ltvCents: number;
}

interface PendingListing {
  id: string;
  title: string;
  priceCents: number;
  category: string;
  createdAt: string;
  seller: { email: string; name: string };
}

interface AuditEntry {
  id: string;
  action: string;
  entityId?: string | null;
  createdAt: string;
  ip?: string | null;
  user?: { email: string } | null;
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [m, p, l] = await Promise.all([
        apiGet<{ metrics: Metrics }>('/admin/metrics'),
        apiGet<{ listings: PendingListing[] }>('/admin/listings/pending'),
        apiGet<{ logs: AuditEntry[] }>('/admin/audit-logs?page=1'),
      ]);
      setMetrics(m.metrics);
      setPending(p.listings);
      setLogs(l.logs.slice(0, 30));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin access required');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function moderate(listingId: string, decision: 'APPROVED' | 'REJECTED') {
    await apiPost(`/admin/listings/${listingId}/moderate`, { decision });
    await load();
  }

  if (error) {
    return <p className="p-10 text-sm text-red-600">{error}</p>;
  }
  if (!metrics) {
    return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;
  }

  const kpis: Array<[string, string]> = [
    ['MRR', formatCents(metrics.mrrCents)],
    ['Churn', `${(metrics.churnRate * 100).toFixed(1)}%`],
    ['Est. LTV', formatCents(metrics.ltvCents)],
    ['Credit revenue', formatCents(metrics.creditRevenueCents)],
    ['Est. AI cost', formatCents(metrics.estimatedAiCostCents)],
    ['Users', String(metrics.users)],
    ['Workspaces', String(metrics.workspaces)],
    ['Projects', String(metrics.projects)],
    ['Generations', `${metrics.completedGenerations}/${metrics.generations}`],
  ];

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <h1 className="text-2xl font-bold">Admin</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Marketplace review queue ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Queue is empty 🎉</p>
            ) : (
              <ul className="space-y-3">
                {pending.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="text-xs text-slate-400">
                        {l.seller.name} · {formatCents(l.priceCents)} · {l.category} · {timeAgo(l.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" onClick={() => void moderate(l.id, 'APPROVED')}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => void moderate(l.id, 'REJECTED')}>
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit log (latest)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {logs.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    <Badge variant="neutral" className="mr-2">{entry.action}</Badge>
                    <span className="text-slate-500">{entry.user?.email ?? 'system'}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
