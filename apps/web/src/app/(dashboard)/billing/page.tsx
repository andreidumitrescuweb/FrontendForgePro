'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { formatCents } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Select } from '@/components/ui';

interface Plan {
  id: string;
  key: string;
  name: string;
  priceMonthly: number;
  limits: Record<string, unknown>;
}

interface CreditPack {
  id: string;
  credits: number;
  priceCents: number;
}

interface WorkspaceSummary {
  id: string;
  name: string;
  plan: string;
  role: string;
}

const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  free: ['3 projects', '5 generations/day', 'Watermark on exports'],
  pro: ['50 projects', 'Unlimited generations', 'No watermark', 'Email support'],
  agency: ['Unlimited workspaces & projects', 'Real-time collaboration', 'Custom domains', 'Analytics', '10 members/workspace', 'Priority support'],
  enterprise: ['SSO', 'Dedicated API', 'Onboarding & SLA', 'Custom pricing'],
};

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWs, setActiveWs] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiGet<{ plans: Plan[]; creditPacks: CreditPack[] }>('/billing/plans').then((res) => {
      setPlans(res.plans);
      setPacks(res.creditPacks);
    });
    void apiGet<{ workspaces: WorkspaceSummary[] }>('/workspaces').then((res) => {
      const owned = res.workspaces.filter((w) => w.role === 'OWNER');
      setWorkspaces(owned);
      setActiveWs(owned[0]?.id ?? '');
    });
  }, []);

  async function subscribe(planKey: string) {
    setBusy(planKey);
    setError(null);
    try {
      const res = await apiPost<{ url: string }>('/billing/checkout/subscription', {
        workspaceId: activeWs,
        planKey,
      });
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setBusy(null);
    }
  }

  async function buyCredits(packId: string) {
    setBusy(packId);
    setError(null);
    try {
      const res = await apiPost<{ url: string }>('/billing/checkout/credits', { packId });
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setBusy(null);
    }
  }

  async function openPortal() {
    const res = await apiPost<{ url: string }>('/billing/portal');
    window.location.href = res.url;
  }

  const currentPlan = workspaces.find((w) => w.id === activeWs)?.plan;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Billing</h1>
        <div className="flex items-center gap-3">
          <Select value={activeWs} onChange={(e) => setActiveWs(e.target.value)} className="w-56" aria-label="Workspace">
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => void openPortal()}>Manage subscription</Button>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.key === 'agency' ? 'ring-2 ring-brand-500' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {plan.name}
                {currentPlan === plan.key && <Badge variant="success">Current</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-extrabold">
                {formatCents(plan.priceMonthly)}
                {plan.priceMonthly > 0 && <span className="text-sm font-normal text-slate-500">/mo</span>}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                {(PLAN_HIGHLIGHTS[plan.key] ?? []).map((h) => (
                  <li key={h}>✓ {h}</li>
                ))}
              </ul>
              {(plan.key === 'pro' || plan.key === 'agency') && currentPlan !== plan.key && (
                <Button className="mt-5 w-full" disabled={busy !== null || !activeWs}
                  onClick={() => void subscribe(plan.key)}>
                  {busy === plan.key ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                </Button>
              )}
              {plan.key === 'enterprise' && (
                <a href="mailto:sales@frontendforge.pro" className="mt-5 block">
                  <Button variant="outline" className="w-full">Contact sales</Button>
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-semibold">Extra generation credits</h2>
      <p className="text-sm text-slate-500">One-time packs, used automatically when you pass your daily limit.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {packs.map((pack) => (
          <Card key={pack.id}>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{pack.credits} credits</p>
                <p className="text-sm text-slate-500">{formatCents(pack.priceCents)}</p>
              </div>
              <Button variant="outline" disabled={busy !== null} onClick={() => void buyCredits(pack.id)}>
                {busy === pack.id ? '…' : 'Buy'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
