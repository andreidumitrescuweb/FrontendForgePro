'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from '@/components/ui';

const PROJECT_TYPES = [
  ['LANDING_PAGE', 'Landing page'],
  ['ECOMMERCE', 'E-commerce'],
  ['DASHBOARD', 'Dashboard'],
  ['BLOG', 'Blog'],
  ['PORTFOLIO', 'Portfolio'],
  ['OTHER', 'Other'],
] as const;

function NewProjectForm() {
  const router = useRouter();
  const params = useSearchParams();
  const workspaceId = params.get('workspace') ?? '';

  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<string>('LANDING_PAGE');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [brandTone, setBrandTone] = useState('');
  const [palette, setPalette] = useState('');
  const [framework, setFramework] = useState<'VANILLA' | 'REACT'>('VANILLA');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const colorPalette = palette
        .split(',')
        .map((c) => c.trim())
        .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
      const res = await apiPost<{ project: { id: string } }>('/projects', {
        workspaceId,
        name,
        brief: {
          projectType,
          description,
          targetAudience,
          brandTone,
          framework,
          ...(colorPalette.length ? { colorPalette } : {}),
        },
      });
      router.push(`/projects/${res.project.id}?autogenerate=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Describe your project — the AI does the rest</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Project name</Label>
                <Input id="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" value={projectType} onChange={(e) => setProjectType(e.target.value)}>
                  {PROJECT_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">What should this site be? (min. 20 chars)</Label>
              <Textarea id="description" required minLength={20} rows={5}
                placeholder="A landing page for a boutique coffee roastery in Cluj. Hero with product photo, story section, subscription pricing, contact form…"
                value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="audience">Target audience</Label>
                <Input id="audience" required placeholder="Urban specialty-coffee drinkers, 25–45"
                  value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="tone">Brand tone</Label>
                <Input id="tone" required placeholder="Warm, artisanal, confident"
                  value={brandTone} onChange={(e) => setBrandTone(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="palette">Color palette (optional, hex, comma-separated)</Label>
                <Input id="palette" placeholder="#1a2b3c, #f5e6d3 — leave empty for AI palette"
                  value={palette} onChange={(e) => setPalette(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="framework">Output</Label>
                <Select id="framework" value={framework}
                  onChange={(e) => setFramework(e.target.value as 'VANILLA' | 'REACT')}>
                  <option value="VANILLA">HTML + Tailwind + vanilla JS</option>
                  <option value="REACT">React application</option>
                </Select>
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !workspaceId}>
              {busy ? 'Creating…' : 'Create & generate'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense>
      <NewProjectForm />
    </Suspense>
  );
}
