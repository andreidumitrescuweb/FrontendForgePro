'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { formatCents } from '@/lib/utils';
import { Badge, Button, Card, CardContent, Input, Select, Spinner } from '@/components/ui';

interface Listing {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  license: string;
  category: string;
  ratingAvg: number;
  ratingCount: number;
  seller: { id: string; name: string };
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [q, setQ] = useState('');
  const [license, setLicense] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setListings(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (license) params.set('license', license);
    const res = await apiGet<{ listings: Listing[] }>(`/marketplace/listings?${params}`);
    setListings(res.listings);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function purchase(listing: Listing) {
    setBusy(listing.id);
    setNotice(null);
    try {
      const res = await apiPost<{ url?: string; purchase?: unknown }>(
        `/marketplace/listings/${listing.id}/purchase`,
      );
      if (res.url) {
        window.location.href = res.url;
      } else {
        setNotice(`"${listing.title}" purchased — clone it from any workspace.`);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-2xl font-bold">Template marketplace</h1>
      <p className="mt-1 text-sm text-slate-500">
        Proven builds from the community. Creators keep 70% of every sale.
      </p>

      <div className="mt-6 flex gap-3">
        <Input placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()} className="max-w-sm" />
        <Select value={license} onChange={(e) => setLicense(e.target.value)} className="w-44" aria-label="License">
          <option value="">Any license</option>
          <option value="PERSONAL">Personal</option>
          <option value="COMMERCIAL">Commercial</option>
          <option value="EXTENDED">Extended</option>
        </Select>
        <Button variant="outline" onClick={() => void load()}>Filter</Button>
      </div>

      {notice && <p className="mt-4 text-sm text-brand-700">{notice}</p>}

      {listings === null ? (
        <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>
      ) : listings.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="py-16 text-center text-slate-500">
            No templates match. Publish yours from any project!
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Card key={l.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{l.title}</h2>
                  <Badge variant="neutral">{l.license.toLowerCase()}</Badge>
                </div>
                <p className="mt-1 line-clamp-3 text-sm text-slate-600">{l.description}</p>
                <p className="mt-2 text-xs text-slate-400">
                  by {l.seller.name} · ★ {l.ratingAvg.toFixed(1)} ({l.ratingCount}) · {l.category}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold">
                    {l.priceCents === 0 ? 'Free' : formatCents(l.priceCents)}
                  </span>
                  <Button size="sm" disabled={busy === l.id} onClick={() => void purchase(l)}>
                    {busy === l.id ? '…' : l.priceCents === 0 ? 'Get' : 'Buy'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
