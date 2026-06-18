'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { Spinner } from '@/components/ui';

/** Lands here after the provider redirect; token arrives in the URL fragment (never logged server-side). */
export default function OAuthCompletePage() {
  const router = useRouter();
  const setFromToken = useAuth((s) => s.setFromToken);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('access_token');
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      router.replace('/login');
      return;
    }
    setFromToken(token)
      .then(() => router.replace('/dashboard'))
      .catch(() => router.replace('/login'));
  }, [router, setFromToken]);

  return (
    <main className="flex min-h-screen items-center justify-center gap-3 text-slate-600">
      <Spinner /> Completing sign-in…
    </main>
  );
}
