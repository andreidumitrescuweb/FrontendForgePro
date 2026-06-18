import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'FrontendForge Pro — AI Frontend Builder',
    template: '%s · FrontendForge Pro',
  },
  description:
    'Generate production-grade, accessible, SEO-optimized frontends from a description. Built for agencies and freelancers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
