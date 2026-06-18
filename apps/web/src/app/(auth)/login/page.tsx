'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/store/auth';
import { API_URL } from '@/lib/api';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await login(email, password, needsTotp ? totpCode : undefined);
      if (result === 'totp') {
        setNeedsTotp(true);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {needsTotp && (
            <div>
              <Label htmlFor="totp">2FA code</Label>
              <Input id="totp" inputMode="numeric" pattern="\d{6}" maxLength={6} required
                placeholder="123456" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : needsTotp ? 'Verify code' : 'Sign in'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or continue with <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(['google', 'github', 'linkedin'] as const).map((p) => (
            <a key={p} href={`${API_URL}/api/v1/oauth/${p}/start`}
              className="rounded-lg border border-slate-300 py-2 text-center text-sm font-medium capitalize hover:bg-slate-50">
              {p}
            </a>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          No account?{' '}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Start free
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
