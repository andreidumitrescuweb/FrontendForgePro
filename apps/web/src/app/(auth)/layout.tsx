import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-xl font-extrabold tracking-tight">
          Frontend<span className="text-brand-600">Forge</span> Pro
        </Link>
        {children}
      </div>
    </main>
  );
}
