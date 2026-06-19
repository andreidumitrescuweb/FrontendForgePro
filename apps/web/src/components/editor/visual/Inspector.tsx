'use client';

import { useState, type ReactNode } from 'react';
import type { DeviceMode, NodeInfo, NodeStyles } from './protocol';
import { FONT_WEIGHTS, GOOGLE_FONTS, primaryFont, toHex, toNum } from './styleUtils';
import { Input, Select } from '@/components/ui';

interface Props {
  node: NodeInfo;
  device: DeviceMode;
  onStyle: (styles: Partial<NodeStyles>) => void;
  onAttr: (attr: string, value: string) => void;
  onText: (text: string) => void;
  onFont: (family: string) => void;
  onSelect: (ffid: string) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRequestImage: () => void;
}

export function Inspector(props: Props) {
  const { node, device, onStyle } = props;
  const c = node.computed;
  // Re-mount fields when the selection or breakpoint changes so they reflect
  // the freshly-computed values instead of stale input state.
  const fieldKey = `${node.ffid}:${device}`;

  return (
    <div key={fieldKey} className="flex flex-col text-sm">
      {/* Breadcrumb + element actions */}
      <div className="border-b border-slate-200 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1 text-xs text-slate-500">
          {node.parentFfid && (
            <button
              onClick={() => props.onSelect(node.parentFfid!)}
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              title="Select parent"
            >
              ↑
            </button>
          )}
          <span className="truncate font-medium text-slate-700">{node.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <ActionBtn disabled={!node.canMoveUp} onClick={() => props.onMove('up')}>↑ Move</ActionBtn>
          <ActionBtn disabled={!node.canMoveDown} onClick={() => props.onMove('down')}>↓ Move</ActionBtn>
          <ActionBtn onClick={props.onDuplicate}>⧉ Duplicate</ActionBtn>
          <ActionBtn onClick={props.onRemove} danger>🗑 Delete</ActionBtn>
        </div>
      </div>

      {/* Content / link */}
      {(node.text || node.isLink) && (
        <Section title="Content" defaultOpen>
          {node.text !== '' && (
            <Field label="Text">
              <textarea
                defaultValue={node.text}
                onBlur={(e) => props.onText(e.target.value)}
                rows={2}
                className="w-full resize-y rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </Field>
          )}
          {node.isLink && (
            <Field label="Link URL">
              <Input defaultValue={node.href ?? ''} onBlur={(e) => props.onAttr('href', e.target.value)} />
            </Field>
          )}
        </Section>
      )}

      {/* Image */}
      {node.isImage && (
        <Section title="Image" defaultOpen>
          <Field label="Image URL">
            <Input defaultValue={node.src ?? ''} onBlur={(e) => props.onAttr('src', e.target.value)} />
          </Field>
          <Field label="Alt text (SEO/a11y)">
            <Input defaultValue={node.alt ?? ''} onBlur={(e) => props.onAttr('alt', e.target.value)} />
          </Field>
          <Field label="Fit">
            <Select defaultValue={c.objectFit || 'fill'} onChange={(e) => onStyle({ objectFit: e.target.value })}>
              {['fill', 'cover', 'contain', 'none', 'scale-down'].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
          </Field>
          <button
            onClick={props.onRequestImage}
            className="mt-1 w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            ✨ Replace with AI / stock image
          </button>
        </Section>
      )}

      {/* Typography */}
      {!node.isImage && (
        <Section title="Typography" defaultOpen={!!node.text}>
          <Field label="Font">
            <Select
              defaultValue={primaryFont(c.fontFamily) || ''}
              onChange={(e) => {
                const fam = e.target.value;
                if (fam) {
                  props.onFont(fam);
                  onStyle({ fontFamily: `"${fam}", sans-serif` });
                }
              }}
            >
              <option value="">Default</option>
              {GOOGLE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size (px)">
              <NumberInput defaultValue={toNum(c.fontSize)} onCommit={(v) => onStyle({ fontSize: `${v}px` })} />
            </Field>
            <Field label="Weight">
              <Select defaultValue={c.fontWeight} onChange={(e) => onStyle({ fontWeight: e.target.value })}>
                {FONT_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </Select>
            </Field>
            <Field label="Line height">
              <NumberInput
                defaultValue={toNum(c.lineHeight)}
                step={0.1}
                onCommit={(v) => onStyle({ lineHeight: v ? String(v) : '' })}
              />
            </Field>
            <Field label="Letter sp. (px)">
              <NumberInput defaultValue={toNum(c.letterSpacing)} onCommit={(v) => onStyle({ letterSpacing: `${v}px` })} />
            </Field>
          </div>
          <Field label="Alignment">
            <ButtonGroup
              value={c.textAlign}
              options={[['left', '⬅'], ['center', '⬌'], ['right', '➡'], ['justify', '☰']]}
              onChange={(v) => onStyle({ textAlign: v })}
            />
          </Field>
          <Field label="Transform">
            <Select defaultValue={c.textTransform} onChange={(e) => onStyle({ textTransform: e.target.value })}>
              {['none', 'uppercase', 'lowercase', 'capitalize'].map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          </Field>
        </Section>
      )}

      {/* Colors */}
      <Section title="Colors" defaultOpen>
        {!node.isImage && (
          <ColorRow label="Text color" value={toHex(c.color)} onChange={(v) => onStyle({ color: v })} />
        )}
        <ColorRow
          label="Background"
          value={toHex(c.backgroundColor)}
          onChange={(v) => onStyle({ backgroundColor: v })}
          onClear={() => onStyle({ backgroundColor: 'transparent' })}
        />
      </Section>

      {/* Spacing */}
      <Section title="Spacing">
        <p className="mb-1 text-xs font-medium text-slate-500">Padding (px)</p>
        <BoxFour
          values={[toNum(c.paddingTop), toNum(c.paddingRight), toNum(c.paddingBottom), toNum(c.paddingLeft)]}
          onChange={(side, v) => onStyle({ [`padding${side}`]: `${v}px` } as Partial<NodeStyles>)}
        />
        <p className="mb-1 mt-3 text-xs font-medium text-slate-500">Margin (px)</p>
        <BoxFour
          values={[toNum(c.marginTop), toNum(c.marginRight), toNum(c.marginBottom), toNum(c.marginLeft)]}
          onChange={(side, v) => onStyle({ [`margin${side}`]: `${v}px` } as Partial<NodeStyles>)}
        />
      </Section>

      {/* Size & layout */}
      <Section title="Size & layout">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width">
            <Input defaultValue={c.width} onBlur={(e) => onStyle({ width: e.target.value })} placeholder="auto" />
          </Field>
          <Field label="Max width">
            <Input defaultValue={c.maxWidth} onBlur={(e) => onStyle({ maxWidth: e.target.value })} placeholder="none" />
          </Field>
        </div>
        <Field label="Display">
          <Select defaultValue={c.display} onChange={(e) => onStyle({ display: e.target.value })}>
            {['block', 'flex', 'inline-block', 'inline-flex', 'grid', 'inline', 'none'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
        </Field>
      </Section>

      {/* Border & effects */}
      <Section title="Border & effects">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Radius (px)">
            <NumberInput defaultValue={toNum(c.borderRadius)} onCommit={(v) => onStyle({ borderRadius: `${v}px` })} />
          </Field>
          <Field label="Border (px)">
            <NumberInput
              defaultValue={toNum(c.borderWidth)}
              onCommit={(v) => onStyle({ borderWidth: `${v}px`, borderStyle: v ? 'solid' : 'none' })}
            />
          </Field>
        </div>
        <ColorRow label="Border color" value={toHex(c.borderColor)} onChange={(v) => onStyle({ borderColor: v })} />
        <Field label="Shadow">
          <Select
            defaultValue={shadowPreset(c.boxShadow)}
            onChange={(e) => onStyle({ boxShadow: e.target.value })}
          >
            <option value="none">None</option>
            <option value="0 1px 3px rgba(0,0,0,0.12)">Small</option>
            <option value="0 4px 12px rgba(0,0,0,0.15)">Medium</option>
            <option value="0 10px 30px rgba(0,0,0,0.2)">Large</option>
          </Select>
        </Field>
        <Field label={`Opacity (${Math.round((parseFloat(c.opacity) || 1) * 100)}%)`}>
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={Math.round((parseFloat(c.opacity) || 1) * 100)}
            onChange={(e) => onStyle({ opacity: String(Number(e.target.value) / 100) })}
            className="w-full"
          />
        </Field>
      </Section>
    </div>
  );
}

function shadowPreset(value: string): string {
  if (!value || value === 'none') return 'none';
  return value;
}

// ---- small primitives ---------------------------------------------------

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-slate-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
      >
        {title}
        <span className="text-slate-400">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="space-y-2.5 px-3 pb-3">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({
  defaultValue,
  onCommit,
  step = 1,
}: {
  defaultValue: number;
  onCommit: (v: number) => void;
  step?: number;
}) {
  return (
    <Input
      type="number"
      step={step}
      defaultValue={defaultValue}
      onChange={(e) => onCommit(Number(e.target.value))}
      className="h-9"
    />
  );
}

function ColorRow({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          defaultValue={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
        />
        <Input defaultValue={value} onBlur={(e) => onChange(e.target.value)} className="h-9 font-mono text-xs" />
        {onClear && (
          <button onClick={onClear} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" title="Clear">
            ✕
          </button>
        )}
      </div>
    </Field>
  );
}

function BoxFour({
  values,
  onChange,
}: {
  values: [number, number, number, number];
  onChange: (side: 'Top' | 'Right' | 'Bottom' | 'Left', v: number) => void;
}) {
  const sides: Array<['Top' | 'Right' | 'Bottom' | 'Left', string]> = [
    ['Top', 'T'],
    ['Right', 'R'],
    ['Bottom', 'B'],
    ['Left', 'L'],
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {sides.map(([side, abbr], i) => (
        <label key={side} className="flex flex-col items-center">
          <span className="mb-0.5 text-[10px] text-slate-400">{abbr}</span>
          <Input
            type="number"
            defaultValue={values[i]}
            onChange={(e) => onChange(side, Number(e.target.value))}
            className="h-8 px-1 text-center text-xs"
          />
        </label>
      ))}
    </div>
  );
}

function ButtonGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-300">
      {options.map(([val, icon]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`flex-1 py-1.5 text-sm ${value === val ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-40 ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
