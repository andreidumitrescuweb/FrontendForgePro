'use client';

/**
 * Inserts decorative geometric shapes. Each is a self-contained element the user
 * can then recolor, resize, drag and rotate with the Inspector's free-transform.
 */

interface Shape {
  id: string;
  label: string;
  preview: string; // small inline SVG/markup for the button
  html: string; // what gets inserted into the canvas
}

const accent = '#4f46e5';

const SHAPES: Shape[] = [
  {
    id: 'rect',
    label: 'Rectangle',
    preview: `<div style="width:28px;height:18px;background:${accent};border-radius:3px"></div>`,
    html: `<div style="width:160px;height:100px;background:${accent};border-radius:8px"></div>`,
  },
  {
    id: 'circle',
    label: 'Circle',
    preview: `<div style="width:22px;height:22px;background:${accent};border-radius:50%"></div>`,
    html: `<div style="width:120px;height:120px;background:${accent};border-radius:50%"></div>`,
  },
  {
    id: 'pill',
    label: 'Pill',
    preview: `<div style="width:30px;height:14px;background:${accent};border-radius:999px"></div>`,
    html: `<div style="width:180px;height:64px;background:${accent};border-radius:999px"></div>`,
  },
  {
    id: 'line',
    label: 'Line',
    preview: `<div style="width:30px;height:3px;background:${accent}"></div>`,
    html: `<div style="width:220px;height:4px;background:${accent};border-radius:4px"></div>`,
  },
  {
    id: 'triangle',
    label: 'Triangle',
    preview: `<div style="width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-bottom:19px solid ${accent}"></div>`,
    html: `<div style="width:0;height:0;border-left:70px solid transparent;border-right:70px solid transparent;border-bottom:120px solid ${accent}"></div>`,
  },
  {
    id: 'star',
    label: 'Star',
    preview: `<div style="width:22px;height:22px;background:${accent};clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"></div>`,
    html: `<div style="width:120px;height:120px;background:${accent};clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"></div>`,
  },
  {
    id: 'blob',
    label: 'Blob',
    preview: `<div style="width:24px;height:24px;background:${accent};border-radius:42% 58% 70% 30%/45% 45% 55% 55%"></div>`,
    html: `<div style="width:180px;height:180px;background:${accent};border-radius:42% 58% 70% 30%/45% 45% 55% 55%"></div>`,
  },
  {
    id: 'badge',
    label: 'Badge',
    preview: `<div style="width:24px;height:24px;background:${accent};border-radius:8px;transform:rotate(45deg)"></div>`,
    html: `<div style="width:120px;height:120px;background:${accent};border-radius:16px;transform:rotate(45deg)"></div>`,
  },
];

interface Props {
  onInsert: (html: string) => void;
}

export function ShapesPanel({ onInsert }: Props) {
  return (
    <div className="p-3">
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        Add a shape, then recolor it in Colors, resize in Size, and drag/rotate it with
        free-transform in the Inspector.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {SHAPES.map((s) => (
          <button
            key={s.id}
            onClick={() => onInsert(s.html)}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white py-4 hover:border-brand-400 hover:bg-brand-50"
          >
            <span className="flex h-7 items-center justify-center" dangerouslySetInnerHTML={{ __html: s.preview }} />
            <span className="text-[11px] font-medium text-slate-600">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
