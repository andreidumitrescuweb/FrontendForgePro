'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Projects' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/billing', label: 'Billing' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, hydrate, logout } = useAuth();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 text-slate-500">
        <Spinner /> Loading workspace…
      </main>
    );
  }

  const nav = user.role === 'USER' ? NAV : [...NAV, { href: '/admin', label: 'Admin' }];

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <Link href="/dashboard" className="flex h-16 items-center px-5 text-base font-extrabold tracking-tight">
          Frontend<span className="text-brand-600">Forge</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Dashboard">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm font-medium',
                pathname.startsWith(item.href)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          <button
            onClick={() => void logout().then(() => router.replace('/login'))}
            className="mt-2 text-xs font-medium text-slate-500 hover:text-red-600"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
