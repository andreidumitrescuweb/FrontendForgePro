'use client';

import { appleEmojiImg, appleEmojiUrl, EMOJI_GROUPS } from './emoji';

interface Props {
  onInsert: (html: string) => void;
}

/** Inserts Apple-styled emojis (as <img>) so they look identical on every OS. */
export function EmojiPanel({ onInsert }: Props) {
  return (
    <div className="p-3">
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        Click an emoji to drop it in (after the selected element). They render as Apple emojis
        everywhere — then drag, resize or rotate them like any element.
      </p>
      <div className="space-y-4">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</p>
            <div className="grid grid-cols-8 gap-1">
              {group.emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => onInsert(appleEmojiImg(e))}
                  title={e}
                  className="flex items-center justify-center rounded-md p-1 hover:bg-slate-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={appleEmojiUrl(e)} alt={e} className="h-6 w-6" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
