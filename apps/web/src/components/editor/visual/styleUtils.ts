/** Shared helpers for translating between CSS computed values and UI controls. */

/** Convert an `rgb()`/`rgba()`/hex computed color into a `#rrggbb` hex string. */
export function toHex(value: string | undefined): string {
  if (!value) return '#000000';
  if (value.startsWith('#')) return value.length === 4 ? expandHex(value) : value.slice(0, 7);
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return '#000000';
  const [r, g, b] = m[1].split(',').map((x) => parseInt(x.trim(), 10));
  return '#' + [r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('');
}

function expandHex(short: string): string {
  return '#' + short.slice(1).split('').map((c) => c + c).join('');
}
function clamp(n: number): number {
  return Math.max(0, Math.min(255, isNaN(n) ? 0 : n));
}

/** Strip the unit from a CSS length, returning a number (0 when unparseable). */
export function toNum(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : Math.round(n);
}

/** True when a computed color is fully transparent. */
export function isTransparent(value: string | undefined): boolean {
  return !value || value === 'transparent' || /rgba?\([^)]*,\s*0\s*\)/.test(value);
}

/** Curated Google Fonts that cover most SMB brand tones. */
export const GOOGLE_FONTS = [
  'Inter',
  'Poppins',
  'Roboto',
  'Montserrat',
  'Open Sans',
  'Lato',
  'Raleway',
  'Nunito',
  'Work Sans',
  'Playfair Display',
  'Merriweather',
  'Lora',
  'Source Sans 3',
  'DM Sans',
  'Space Grotesk',
  'Manrope',
];

export const FONT_WEIGHTS = [
  { label: 'Light', value: '300' },
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extra bold', value: '800' },
];

/** Extract the primary font family name (without fallbacks/quotes). */
export function primaryFont(fontFamily: string | undefined): string {
  if (!fontFamily) return '';
  return fontFamily.split(',')[0].replace(/["']/g, '').trim();
}
