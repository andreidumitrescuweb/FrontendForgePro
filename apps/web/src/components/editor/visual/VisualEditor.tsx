'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import { buildEditorSrcDoc } from './runtime';
import { useVisualBridge } from './useVisualBridge';
import { Inspector } from './Inspector';
import { ThemePanel } from './ThemePanel';
import { SectionLibrary } from './SectionLibrary';
import { ShapesPanel } from './ShapesPanel';
import { EmojiPanel } from './EmojiPanel';
import type { DeviceMode, NodeInfo, NodeStyles } from './protocol';

interface Props {
  files: Record<string, string>;
  entryFile: string;
  assets: Array<{ path: string; url: string }>;
  /** Lift edited files up so Save/Export/Deploy use the latest design. */
  onChange: (files: Record<string, string>) => void;
  /** Immediate save of the current design. */
  onSave: (files: Record<string, string>) => Promise<void> | void;
}

const DEVICE_WIDTH: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

type RightTab = 'inspector' | 'insert' | 'theme';
type InsertTab = 'sections' | 'shapes' | 'emoji';

export function VisualEditor({ files, entryFile, assets, onChange, onSave }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [previewing, setPreviewing] = useState(false);
  const [selected, setSelected] = useState<NodeInfo | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('insert');
  const [insertTab, setInsertTab] = useState<InsertTab>('sections');
  const [saving, setSaving] = useState(false);

  // Files used to (re)build the iframe document. Internal edits don't bump this;
  // only undo/redo and the initial load do, so live editing never reloads.
  const [baseFiles, setBaseFiles] = useState(files);
  const [buildNonce, setBuildNonce] = useState(0);

  // Theme + font state (kept here so element-level fonts and theme fonts merge).
  const [themeCss, setThemeCss] = useState('');
  const [themeFonts, setThemeFonts] = useState<string[]>([]);
  const [elementFonts, setElementFonts] = useState<string[]>([]);

  // History of file snapshots for undo/redo.
  const history = useRef<Array<Record<string, string>>>([files]);
  const histIndex = useRef(0);
  const liveFiles = useRef(files);
  const serializeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [imageModal, setImageModal] = useState<{ ffid: string } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Indirection so the bridge handler always calls the latest committer.
  const commitRef = useRef<() => void>(() => {});

  const refreshHistoryFlags = useCallback(() => {
    setCanUndo(histIndex.current > 0);
    setCanRedo(histIndex.current < history.current.length - 1);
  }, []);

  const { send, serialize } = useVisualBridge(iframeRef, {
    onReady: () => {
      setReady(true);
      send({ type: 'setMode', mode: 'edit' });
    },
    onSelected: (node) => {
      setSelected(node);
      setRightTab('inspector');
    },
    onDeselected: () => setSelected(null),
    onChanged: () => commitRef.current(),
  });

  // Debounced serialize → push to history + lift up.
  const scheduleCommit = useCallback(() => {
    if (serializeTimer.current) clearTimeout(serializeTimer.current);
    serializeTimer.current = setTimeout(async () => {
      try {
        const next = await serialize();
        const merged = { ...liveFiles.current, ...next };
        liveFiles.current = merged;
        // Drop any redo tail, then push.
        history.current = history.current.slice(0, histIndex.current + 1);
        history.current.push(merged);
        if (history.current.length > 60) history.current.shift();
        histIndex.current = history.current.length - 1;
        refreshHistoryFlags();
        onChange(merged);
      } catch {
        // Serialize can fail mid-reload; the next edit will recover.
      }
    }, 400);
  }, [serialize, onChange, refreshHistoryFlags]);

  useEffect(() => {
    commitRef.current = scheduleCommit;
  }, [scheduleCommit]);

  // Push theme/fonts into the iframe whenever they change.
  useEffect(() => {
    if (!ready) return;
    const fontLinks = Array.from(new Set([...themeFonts, ...elementFonts]));
    if (themeCss === '' && fontLinks.length === 0) return;
    send({ type: 'setTheme', css: themeCss, fontLinks });
  }, [ready, themeCss, themeFonts, elementFonts, send]);

  const srcDoc = useMemo(
    () => buildEditorSrcDoc(baseFiles, entryFile, assets),
    // buildNonce forces a rebuild on undo/redo even if object identity is reused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseFiles, entryFile, assets, buildNonce],
  );

  // Toggle edit/preview mode in the runtime.
  useEffect(() => {
    if (ready) send({ type: 'setMode', mode: previewing ? 'preview' : 'edit' });
  }, [previewing, ready, send]);

  function reloadFrom(snapshot: Record<string, string>) {
    liveFiles.current = snapshot;
    setSelected(null);
    setReady(false);
    setBaseFiles(snapshot);
    setBuildNonce((n) => n + 1);
    onChange(snapshot);
  }

  function undo() {
    if (histIndex.current <= 0) return;
    histIndex.current -= 1;
    refreshHistoryFlags();
    reloadFrom(history.current[histIndex.current]);
  }
  function redo() {
    if (histIndex.current >= history.current.length - 1) return;
    histIndex.current += 1;
    refreshHistoryFlags();
    reloadFrom(history.current[histIndex.current]);
  }

  // ---- inspector callbacks ----
  const applyStyle = (styles: Partial<NodeStyles>) => {
    if (selected) send({ type: 'applyStyle', ffid: selected.ffid, styles, breakpoint: device });
  };
  const setAttr = (attr: string, value: string) => {
    if (selected) send({ type: 'setAttr', ffid: selected.ffid, attr, value });
  };
  const setText = (text: string) => {
    if (selected) send({ type: 'setText', ffid: selected.ffid, text });
  };
  const useFont = (family: string) => setElementFonts((prev) => (prev.includes(family) ? prev : [...prev, family]));
  const applyTransform = (tx: number, ty: number, rot: number) => {
    if (selected) send({ type: 'applyTransform', ffid: selected.ffid, tx, ty, rot });
  };
  const applyAnimation = (name: string) => {
    if (selected) send({ type: 'setAnimation', ffid: selected.ffid, name });
  };
  const insertHtml = (html: string) =>
    send({ type: 'insertSection', html, relativeTo: selected?.ffid ?? null, position: selected ? 'after' : 'append' });

  async function save() {
    setSaving(true);
    try {
      // Flush any pending edit before saving.
      if (serializeTimer.current) clearTimeout(serializeTimer.current);
      const next = await serialize().catch(() => liveFiles.current);
      const merged = { ...liveFiles.current, ...next };
      liveFiles.current = merged;
      onChange(merged);
      await onSave(merged);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Canvas column */}
      <div className="flex min-w-0 flex-1 flex-col bg-slate-100">
        {/* Sub-toolbar */}
        <div className="flex h-11 items-center gap-2 border-b border-slate-200 bg-white px-3">
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {(['desktop', 'tablet', 'mobile'] as DeviceMode[]).map((d) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className={`px-2.5 py-1.5 text-xs font-medium ${device === d ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                title={d}
              >
                {d === 'desktop' ? '🖥' : d === 'tablet' ? '📱' : '📲'}
              </button>
            ))}
          </div>
          <div className="ml-1 flex gap-1">
            <IconBtn onClick={undo} disabled={!canUndo} title="Undo">↩</IconBtn>
            <IconBtn onClick={redo} disabled={!canRedo} title="Redo">↪</IconBtn>
          </div>
          <button
            onClick={() => setPreviewing((p) => !p)}
            className={`ml-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${previewing ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {previewing ? '✎ Back to editing' : '👁 Preview'}
          </button>
          <div className="ml-auto flex items-center gap-2">
            {!ready && <Spinner className="h-4 w-4" />}
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? <Spinner className="border-white/40 border-t-white" /> : 'Save design'}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div
            className="mx-auto h-full bg-white shadow-sm transition-all"
            style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}
          >
            <iframe
              ref={iframeRef}
              title="Visual editor"
              sandbox="allow-scripts allow-same-origin allow-forms"
              srcDoc={srcDoc}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex w-[320px] flex-col border-l border-slate-200 bg-white">
        <div className="flex border-b border-slate-200">
          {(['inspector', 'insert', 'theme'] as RightTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold capitalize ${rightTab === tab ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rightTab === 'inspector' &&
            (selected ? (
              <Inspector
                node={selected}
                device={device}
                onStyle={applyStyle}
                onTransform={applyTransform}
                onAnimation={applyAnimation}
                onAttr={setAttr}
                onText={setText}
                onFont={useFont}
                onSelect={(ffid) => send({ type: 'select', ffid })}
                onRemove={() => selected && send({ type: 'remove', ffid: selected.ffid })}
                onDuplicate={() => selected && send({ type: 'duplicate', ffid: selected.ffid })}
                onMove={(dir) => selected && send({ type: 'move', ffid: selected.ffid, direction: dir })}
                onRequestImage={() => setImageModal({ ffid: selected.ffid })}
              />
            ) : (
              <p className="p-4 text-sm text-slate-500">
                Click any element in the page to edit its text, colors, spacing, fonts and more.
                Double-click text to type directly.
              </p>
            ))}
          {rightTab === 'insert' && (
            <div>
              <div className="flex gap-1 border-b border-slate-100 p-2">
                {(['sections', 'shapes', 'emoji'] as InsertTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setInsertTab(t)}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize ${insertTab === t ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {insertTab === 'sections' && <SectionLibrary onInsert={insertHtml} />}
              {insertTab === 'shapes' && <ShapesPanel onInsert={insertHtml} />}
              {insertTab === 'emoji' && <EmojiPanel onInsert={insertHtml} />}
            </div>
          )}
          {rightTab === 'theme' && <ThemePanel onApply={(css, links) => { setThemeCss(css); setThemeFonts(links); }} />}
        </div>
      </div>

      {imageModal && (
        <ImageModal
          onClose={() => setImageModal(null)}
          onPick={(url) => {
            send({ type: 'setAttr', ffid: imageModal.ffid, attr: 'src', value: url });
            setImageModal(null);
          }}
        />
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ImageModal({ onClose, onPick }: { onClose: () => void; onPick: (url: string) => void }) {
  const [url, setUrl] = useState('');
  const [keyword, setKeyword] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-semibold">Replace image</h3>
        <label className="mb-1 block text-xs font-medium text-slate-500">Paste an image URL</label>
        <div className="mb-4 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Button size="sm" disabled={!url} onClick={() => onPick(url)}>Use</Button>
        </div>
        <label className="mb-1 block text-xs font-medium text-slate-500">…or search a free stock photo</label>
        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. coffee shop, team, nature"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && keyword) onPick(`https://loremflickr.com/1200/800/${encodeURIComponent(keyword)}`);
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!keyword}
            onClick={() => onPick(`https://loremflickr.com/1200/800/${encodeURIComponent(keyword)}`)}
          >
            Search
          </Button>
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  );
}
