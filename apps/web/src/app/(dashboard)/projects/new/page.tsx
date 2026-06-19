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
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceLinks, setReferenceLinks] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFilesPicked(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Could not read file'));
          reader.readAsDataURL(file);
        });
        const res = await apiPost<{ url: string }>('/uploads/image', { dataUrl });
        setReferenceImages((prev) => [...prev, res.url]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const colorPalette = palette
        .split(',')
        .map((c) => c.trim())
        .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
      const referenceUrls = referenceLinks
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter((u) => /^https?:\/\/.+/i.test(u))
        .slice(0, 5);
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
          ...(referenceImages.length ? { referenceImages } : {}),
          ...(referenceUrls.length ? { referenceUrls } : {}),
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
            <div>
              <Label htmlFor="refimages">Your photos (optional)</Label>
              <p className="mb-2 text-xs text-slate-500">
                Upload logos or product/brand photos — the AI will place them into the site.
              </p>
              <input
                id="refimages"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void onFilesPicked(e.target.files)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
              {uploading && <p className="mt-2 text-xs text-slate-500">Uploading…</p>}
              {referenceImages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {referenceImages.map((url) => (
                    <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Reference" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setReferenceImages((prev) => prev.filter((u) => u !== url))}
                        className="absolute right-0 top-0 bg-black/60 px-1 text-xs text-white"
                        aria-label="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="reflinks">Reference links (optional)</Label>
              <p className="mb-2 text-xs text-slate-500">
                Existing or inspiration sites — the AI reads them for real content & style cues. One per line.
              </p>
              <Textarea
                id="reflinks"
                rows={3}
                placeholder={'https://my-old-site.com\nhttps://a-competitor.com'}
                value={referenceLinks}
                onChange={(e) => setReferenceLinks(e.target.value)}
              />
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy || uploading || !workspaceId}>
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
