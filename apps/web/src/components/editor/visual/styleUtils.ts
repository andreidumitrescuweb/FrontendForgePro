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

/** Google Fonts grouped by style so the picker can show optgroups. */
export const FONT_GROUPS: Array<{ label: string; fonts: string[] }> = [
  {
    label: 'Sans-serif',
    fonts: [
      'Inter', 'Poppins', 'Roboto', 'Montserrat', 'Open Sans', 'Lato', 'Raleway',
      'Nunito', 'Nunito Sans', 'Work Sans', 'Source Sans 3', 'DM Sans', 'Manrope',
      'Mulish', 'Rubik', 'Karla', 'Figtree', 'Plus Jakarta Sans', 'Outfit',
      'Sora', 'Albert Sans', 'Onest', 'Hanken Grotesk', 'Schibsted Grotesk',
      'Be Vietnam Pro', 'Archivo', 'Barlow', 'Kanit', 'Quicksand', 'Josefin Sans',
      'Cabin', 'PT Sans', 'Oxygen', 'Assistant', 'Heebo',
    ],
  },
  {
    label: 'Display / Geometric',
    fonts: [
      'Space Grotesk', 'Lexend', 'Unbounded', 'Clash Display', 'Syne', 'Bricolage Grotesque',
      'Fraunces', 'Bricolage Grotesque', 'Anton', 'Bebas Neue', 'Oswald', 'Righteous',
      'Pacifico', 'Lobster', 'Comfortaa',
    ],
  },
  {
    label: 'Serif',
    fonts: [
      'Playfair Display', 'Merriweather', 'Lora', 'PT Serif', 'Source Serif 4',
      'Cormorant Garamond', 'EB Garamond', 'Libre Baskerville', 'Crimson Text',
      'DM Serif Display', 'Spectral', 'Bitter', 'Zilla Slab', 'Newsreader',
    ],
  },
  {
    label: 'Monospace / Handwriting',
    fonts: [
      'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Space Mono', 'Roboto Mono',
      'Caveat', 'Dancing Script', 'Kalam', 'Shadows Into Light', 'Permanent Marker',
    ],
  },
];

/** Flat list of every available font family (de-duplicated). */
export const GOOGLE_FONTS = Array.from(new Set(FONT_GROUPS.flatMap((g) => g.fonts)));

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
