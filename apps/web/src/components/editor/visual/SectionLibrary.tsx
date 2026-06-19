'use client';

import { appleEmojiUrl } from './emoji';

/**
 * A palette of ready-made sections. Each block ships with self-contained inline
 * styles (responsive grids, fluid headings) so it renders correctly on phone,
 * tablet and desktop no matter what the host page's CSS looks like; the user
 * then refines it with the Inspector.
 */

interface Block {
  id: string;
  label: string;
  icon: string;
  html: string;
}

const wrap = (inner: string, bg = '#ffffff') =>
  `<section style="padding:64px 24px;background:${bg};font-family:system-ui,-apple-system,sans-serif;color:#0f172a">${inner}</section>`;

const BLOCKS: Block[] = [
  {
    id: 'hero',
    label: 'Hero',
    icon: '🦸',
    html: wrap(
      `<div style="max-width:760px;margin:0 auto;text-align:center">
        <h1 style="font-size:clamp(32px,6vw,48px);line-height:1.1;margin:0 0 16px;font-weight:800">Your headline goes here</h1>
        <p style="font-size:clamp(16px,2.5vw,20px);color:#475569;margin:0 0 28px">A short, compelling sub-headline that tells visitors exactly what you do.</p>
        <a href="#" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Get started</a>
      </div>`,
    ),
  },
  {
    id: 'features',
    label: 'Features',
    icon: '⭐',
    html: wrap(
      `<div style="max-width:1100px;margin:0 auto">
        <h2 style="text-align:center;font-size:34px;font-weight:700;margin:0 0 40px">Why choose us</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px">
          ${[1, 2, 3]
            .map(
              () => `<div style="padding:28px;border:1px solid #e2e8f0;border-radius:14px">
            <div style="width:44px;height:44px;border-radius:10px;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:14px">✓</div>
            <h3 style="font-size:19px;font-weight:600;margin:0 0 8px">Feature title</h3>
            <p style="color:#64748b;margin:0;line-height:1.6">Describe the benefit in one or two clear sentences.</p>
          </div>`,
            )
            .join('')}
        </div>
      </div>`,
      '#f8fafc',
    ),
  },
  {
    id: 'cta',
    label: 'Call to action',
    icon: '📣',
    html: wrap(
      `<div style="max-width:820px;margin:0 auto;text-align:center;background:#4f46e5;color:#fff;padding:48px;border-radius:20px">
        <h2 style="font-size:32px;font-weight:700;margin:0 0 12px">Ready to get started?</h2>
        <p style="font-size:18px;opacity:.9;margin:0 0 24px">Join hundreds of happy customers today.</p>
        <a href="#" style="display:inline-block;background:#fff;color:#4f46e5;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Sign up free</a>
      </div>`,
    ),
  },
  {
    id: 'pricing',
    label: 'Pricing',
    icon: '💳',
    html: wrap(
      `<div style="max-width:1000px;margin:0 auto">
        <h2 style="text-align:center;font-size:34px;font-weight:700;margin:0 0 40px">Simple pricing</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px">
          ${['Starter|19|Basics for individuals', 'Pro|49|For growing teams', 'Business|99|Advanced needs']
            .map((p) => {
              const [name, price, desc] = p.split('|');
              return `<div style="padding:32px;border:1px solid #e2e8f0;border-radius:16px;text-align:center">
              <h3 style="font-size:20px;font-weight:600;margin:0 0 8px">${name}</h3>
              <p style="font-size:40px;font-weight:800;margin:0">$${price}<span style="font-size:15px;font-weight:400;color:#94a3b8">/mo</span></p>
              <p style="color:#64748b;margin:8px 0 20px">${desc}</p>
              <a href="#" style="display:block;background:#0f172a;color:#fff;padding:12px;border-radius:10px;text-decoration:none;font-weight:600">Choose</a>
            </div>`;
            })
            .join('')}
        </div>
      </div>`,
      '#f8fafc',
    ),
  },
  {
    id: 'testimonial',
    label: 'Testimonial',
    icon: '💬',
    html: wrap(
      `<div style="max-width:720px;margin:0 auto;text-align:center">
        <p style="font-size:24px;line-height:1.5;font-weight:500;margin:0 0 24px">“This product completely changed how our team works. Couldn't recommend it more.”</p>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px">
          <img src="https://placehold.co/48x48" alt="Customer" style="width:48px;height:48px;border-radius:50%"/>
          <div style="text-align:left"><strong style="display:block">Jane Doe</strong><span style="color:#64748b;font-size:14px">CEO, Company</span></div>
        </div>
      </div>`,
    ),
  },
  {
    id: 'gallery',
    label: 'Gallery',
    icon: '📸',
    html: wrap(
      `<div style="max-width:1100px;margin:0 auto">
        <h2 style="text-align:center;font-size:34px;font-weight:700;margin:0 0 32px">Gallery</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px">
          ${[1, 2, 3, 4, 5, 6]
            .map(() => `<img src="https://placehold.co/400x300" alt="Gallery image" style="width:100%;border-radius:12px;display:block"/>`)
            .join('')}
        </div>
      </div>`,
    ),
  },
  {
    id: 'contact',
    label: 'Contact form',
    icon: '✉️',
    html: wrap(
      `<div style="max-width:560px;margin:0 auto">
        <h2 style="text-align:center;font-size:32px;font-weight:700;margin:0 0 24px">Get in touch</h2>
        <form style="display:grid;gap:14px">
          <input placeholder="Your name" style="padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px"/>
          <input placeholder="Email address" style="padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px"/>
          <textarea placeholder="Message" rows="4" style="padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px"></textarea>
          <button type="button" style="background:#4f46e5;color:#fff;padding:13px;border:none;border-radius:10px;font-weight:600;font-size:15px;cursor:pointer">Send message</button>
        </form>
      </div>`,
      '#f8fafc',
    ),
  },
  {
    id: 'footer',
    label: 'Footer',
    icon: '🧱',
    html: `<footer style="padding:40px 24px;background:#0f172a;color:#cbd5e1;font-family:system-ui,sans-serif">
      <div style="max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:space-between;gap:24px">
        <div><strong style="color:#fff;font-size:18px">Brand</strong><p style="margin:8px 0 0;font-size:14px">© 2024 All rights reserved.</p></div>
        <div style="display:flex;gap:32px">
          <div><strong style="color:#fff;display:block;margin-bottom:8px">Product</strong><a href="#" style="display:block;color:#cbd5e1;text-decoration:none;font-size:14px;margin-bottom:4px">Features</a><a href="#" style="display:block;color:#cbd5e1;text-decoration:none;font-size:14px">Pricing</a></div>
          <div><strong style="color:#fff;display:block;margin-bottom:8px">Company</strong><a href="#" style="display:block;color:#cbd5e1;text-decoration:none;font-size:14px;margin-bottom:4px">About</a><a href="#" style="display:block;color:#cbd5e1;text-decoration:none;font-size:14px">Contact</a></div>
        </div>
      </div>
    </footer>`,
  },
];

interface Props {
  onInsert: (html: string) => void;
}

export function SectionLibrary({ onInsert }: Props) {
  return (
    <div className="p-3">
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        Click a block to add it to the bottom of the page, then drag-reorder via the Inspector or
        select it and fine-tune.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {BLOCKS.map((b) => (
          <button
            key={b.id}
            onClick={() => onInsert(b.html)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white py-4 hover:border-brand-400 hover:bg-brand-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={appleEmojiUrl(b.icon)} alt="" className="h-6 w-6" loading="lazy" />
            <span className="text-xs font-medium text-slate-700">{b.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
