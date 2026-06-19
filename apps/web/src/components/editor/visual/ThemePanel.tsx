'use client';

import { useState } from 'react';
import { GOOGLE_FONTS } from './styleUtils';
import { Input, Select } from '@/components/ui';

export interface ThemeState {
  headingFont: string;
  bodyFont: string;
  baseSize: number;
  accent: string;
  pageBg: string;
  textColor: string;
  maxWidth: number;
}

const EMPTY: ThemeState = {
  headingFont: '',
  bodyFont: '',
  baseSize: 0,
  accent: '',
  pageBg: '',
  textColor: '',
  maxWidth: 0,
};

interface Preset {
  name: string;
  swatch: string[];
  apply: Partial<ThemeState>;
}

const PRESETS: Preset[] = [
  { name: 'Indigo', swatch: ['#4f46e5', '#ffffff', '#0f172a'], apply: { accent: '#4f46e5', pageBg: '#ffffff', textColor: '#0f172a' } },
  { name: 'Emerald', swatch: ['#059669', '#f8fafc', '#064e3b'], apply: { accent: '#059669', pageBg: '#f8fafc', textColor: '#064e3b' } },
  { name: 'Sunset', swatch: ['#ea580c', '#fffbeb', '#431407'], apply: { accent: '#ea580c', pageBg: '#fffbeb', textColor: '#431407' } },
  { name: 'Rose', swatch: ['#e11d48', '#fff1f2', '#4c0519'], apply: { accent: '#e11d48', pageBg: '#fff1f2', textColor: '#4c0519' } },
  { name: 'Midnight', swatch: ['#6366f1', '#0b1120', '#e2e8f0'], apply: { accent: '#6366f1', pageBg: '#0b1120', textColor: '#e2e8f0' } },
  { name: 'Mono', swatch: ['#111827', '#ffffff', '#111827'], apply: { accent: '#111827', pageBg: '#ffffff', textColor: '#111827' } },
];

/** Builds the global theme stylesheet from the active tokens. */
export function buildThemeCss(t: ThemeState): { css: string; fontLinks: string[] } {
  const rules: string[] = [];
  const fontLinks: string[] = [];
  if (t.bodyFont) {
    rules.push(`body{font-family:"${t.bodyFont}",sans-serif !important}`);
    fontLinks.push(t.bodyFont);
  }
  if (t.headingFont) {
    rules.push(`h1,h2,h3,h4,h5,h6{font-family:"${t.headingFont}",sans-serif !important}`);
    if (t.headingFont !== t.bodyFont) fontLinks.push(t.headingFont);
  }
  if (t.baseSize) rules.push(`body{font-size:${t.baseSize}px !important}`);
  if (t.pageBg) rules.push(`body{background-color:${t.pageBg} !important}`);
  if (t.textColor) rules.push(`body{color:${t.textColor} !important}`);
  if (t.accent) {
    rules.push(`a{color:${t.accent} !important}`);
    rules.push(`button,.btn,[class*="button"],[class*="btn"]{background-color:${t.accent} !important;border-color:${t.accent} !important}`);
  }
  if (t.maxWidth) {
    rules.push(`.container,main>section>div,header>div,footer>div{max-width:${t.maxWidth}px !important;margin-left:auto !important;margin-right:auto !important}`);
  }
  return { css: rules.join('\n'), fontLinks };
}

interface Props {
  onApply: (css: string, fontLinks: string[]) => void;
}

export function ThemePanel({ onApply }: Props) {
  const [t, setT] = useState<ThemeState>(EMPTY);

  function update(patch: Partial<ThemeState>) {
    const next = { ...t, ...patch };
    setT(next);
    const { css, fontLinks } = buildThemeCss(next);
    onApply(css, fontLinks);
  }

  return (
    <div className="space-y-4 p-3 text-sm">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Color presets</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => update(p.apply)}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 p-2 hover:border-brand-400 hover:bg-slate-50"
            >
              <span className="flex h-6 w-full overflow-hidden rounded">
                {p.swatch.map((c, i) => (
                  <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </span>
              <span className="text-xs text-slate-600">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <Group label="Typography">
        <Labeled label="Heading font">
          <Select value={t.headingFont} onChange={(e) => update({ headingFont: e.target.value })}>
            <option value="">Keep current</option>
            {GOOGLE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </Labeled>
        <Labeled label="Body font">
          <Select value={t.bodyFont} onChange={(e) => update({ bodyFont: e.target.value })}>
            <option value="">Keep current</option>
            {GOOGLE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </Labeled>
        <Labeled label="Base text size (px)">
          <Input
            type="number"
            value={t.baseSize || ''}
            placeholder="default"
            onChange={(e) => update({ baseSize: Number(e.target.value) })}
          />
        </Labeled>
      </Group>

      <Group label="Colors">
        <ColorField label="Accent (buttons & links)" value={t.accent} onChange={(v) => update({ accent: v })} />
        <ColorField label="Page background" value={t.pageBg} onChange={(v) => update({ pageBg: v })} />
        <ColorField label="Default text" value={t.textColor} onChange={(v) => update({ textColor: v })} />
      </Group>

      <Group label="Layout">
        <Labeled label="Max content width (px)">
          <Input
            type="number"
            value={t.maxWidth || ''}
            placeholder="unchanged"
            onChange={(e) => update({ maxWidth: Number(e.target.value) })}
          />
        </Labeled>
      </Group>

      <button
        onClick={() => { setT(EMPTY); onApply('', []); }}
        className="w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        Reset theme overrides
      </button>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Theme tokens apply site-wide on top of the generated styles. Per-element tweaks in the
        Inspector always win over these.
      </p>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
        />
        <Input value={value} placeholder="unchanged" onChange={(e) => onChange(e.target.value)} className="h-9 font-mono text-xs" />
        {value && (
          <button onClick={() => onChange('')} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">✕</button>
        )}
      </div>
    </label>
  );
}
