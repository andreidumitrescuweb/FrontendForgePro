'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_FONTS, ensureFontsLoaded, FONT_GROUPS } from './styleUtils';

interface Props {
  value: string;
  onChange: (font: string) => void;
  /** Label shown for the empty value. */
  placeholder?: string;
}

/**
 * Font selector that previews each family in its own typeface (native <select>
 * can't render webfonts in its option list, so this is a custom popover).
 */
export function FontPicker({ value, onChange, placeholder = 'Default' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) ensureFontsLoaded();
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FONT_GROUPS;
    return FONT_GROUPS.map((g) => ({
      label: g.label,
      fonts: g.fonts.filter((f) => f.toLowerCase().includes(q)),
    })).filter((g) => g.fonts.length > 0);
  }, [query]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50"
      >
        <span style={{ fontFamily: value ? `"${value}"` : undefined }} className="truncate">
          {value || placeholder}
        </span>
        <span className="text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fonts…"
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="block w-full px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50"
            >
              {placeholder}
            </button>
            {filtered.map((g) => (
              <div key={g.label}>
                <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {g.label}
                </p>
                {g.fonts.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { onChange(f); setOpen(false); }}
                    style={{ fontFamily: `"${f}"` }}
                    className={`block w-full truncate px-3 py-1.5 text-left text-[15px] hover:bg-brand-50 ${value === f ? 'bg-brand-50 text-brand-700' : 'text-slate-700'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && <p className="px-3 py-3 text-xs text-slate-400">No fonts match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export { ALL_FONTS };
