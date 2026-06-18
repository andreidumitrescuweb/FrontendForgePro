import Link from 'next/link';

const FEATURES = [
  {
    title: 'Multi-model AI engine',
    body: 'Claude generates, GPT-4o stands by as fallback, and a dedicated reviewer model audits every build for WCAG 2.1 AA, Core Web Vitals and SEO before you ever see it.',
  },
  {
    title: 'Real-time collaboration',
    body: 'CRDT-powered co-editing with live cursors, presence and per-project chat. Your whole team in one editor, zero merge conflicts.',
  },
  {
    title: 'One-click deploy',
    body: 'Push to Vercel, Netlify or GitHub Pages straight from the editor. Live status, automatic SSL, custom domains on Agency.',
  },
  {
    title: 'Immutable version history',
    body: 'Every save and generation is a restorable snapshot. Branch experiments, merge them back, never lose work.',
  },
  {
    title: 'Built-in analytics',
    body: 'A privacy-friendly, self-hosted tracking snippet is injected into every site. Visitors, top pages, time on page and bounce rate — inside the app.',
  },
  {
    title: 'Template marketplace',
    body: 'Publish your best builds, set your price, keep 70%. Buy proven templates and clone them into any workspace.',
  },
];

export default function LandingPage() {
  return (
    <main>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-extrabold tracking-tight">
            Frontend<span className="text-brand-600">Forge</span> Pro
          </span>
          <nav className="flex items-center gap-4" aria-label="Main">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-tight tracking-tight">
          Ship client-ready frontends in <span className="text-brand-600">minutes</span>, not weeks
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Describe the site. FrontendForge plans it, generates accessible Tailwind code, audits it
          with a second AI, optimizes SEO and deploys it — while your team collaborates live.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700"
          >
            Build your first site free
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold hover:bg-slate-50"
          >
            Live demo
          </Link>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} FrontendForge Pro. Built for agencies that move fast.
      </footer>
    </main>
  );
}
