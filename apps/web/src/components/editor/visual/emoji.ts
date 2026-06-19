/**
 * Apple-style emoji rendering. Instead of relying on the OS font (which shows
 * Microsoft's flat emojis on Windows), we render emojis as images from the
 * `emoji-datasource-apple` set served over jsDelivr — the same asset set used by
 * emoji-mart. This keeps emojis looking like Apple's everywhere.
 */

const CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64';

/**
 * Convert an emoji grapheme to its emoji-datasource filename codepoint.
 * emoji-datasource-apple keeps the VS16 (fe0f) selector in the "unified" id
 * (e.g. ❤️ -> "2764-fe0f"), so we keep every code point of the grapheme.
 */
export function emojiCode(emoji: string): string {
  return Array.from(emoji)
    .map((ch) => ch.codePointAt(0)!.toString(16))
    .join('-');
}

/** URL of the Apple PNG for a given emoji. */
export function appleEmojiUrl(emoji: string): string {
  return `${CDN}/${emojiCode(emoji)}.png`;
}

/** `<img>` markup for inserting an Apple emoji into the canvas. */
export function appleEmojiImg(emoji: string, sizePx = 48): string {
  return `<img src="${appleEmojiUrl(emoji)}" alt="${emoji}" class="ff-emoji" style="display:inline-block;width:${sizePx}px;height:${sizePx}px;vertical-align:middle" />`;
}

/** Curated emoji palette grouped for the picker. */
export const EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: 'Smileys & people',
    emojis: ['😀', '😄', '😁', '😍', '🥰', '😎', '🤩', '🥳', '🤔', '😴', '🙌', '👍', '👏', '🙏', '💪', '🫶', '👋', '🤝', '✌️', '🫡'],
  },
  {
    label: 'Business & objects',
    emojis: ['🚀', '⭐', '✨', '🔥', '💡', '🎯', '📈', '📊', '💰', '🏆', '🎁', '🛒', '💳', '📱', '💻', '⚙️', '🔧', '🔒', '📌', '📣'],
  },
  {
    label: 'Nature & food',
    emojis: ['🌟', '🌈', '☀️', '🌙', '🌸', '🌿', '🍀', '🌊', '🔆', '☕', '🍔', '🍕', '🍰', '🥗', '🍷', '🍪', '🥑', '🍋', '🌶️', '🧊'],
  },
  {
    label: 'Symbols',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '✅', '❌', '⚡', '♻️', '✔️', '➡️', '⬅️', '⬆️', '⬇️', '➕', '➖', '〰️', '❓', '❗'],
  },
];
