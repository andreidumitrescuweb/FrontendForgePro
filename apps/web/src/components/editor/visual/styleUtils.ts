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

/** Locally-available fonts that need no webfont download. */
export const SYSTEM_FONTS = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Garamond', 'Courier New',
  'Verdana', 'Trebuchet MS', 'Tahoma', 'Palatino Linotype', 'Brush Script MT',
];
const SYSTEM_SET = new Set(SYSTEM_FONTS.map((f) => f.toLowerCase()));
export function isSystemFont(name: string): boolean {
  return SYSTEM_SET.has(name.trim().toLowerCase());
}

/** Fonts grouped by style so the picker can show sections. */
export const FONT_GROUPS: Array<{ label: string; fonts: string[] }> = [
  {
    label: 'Modern / Statement',
    fonts: [
      'Geist', 'Funnel Display', 'Gabarito', 'Instrument Sans', 'Instrument Serif',
      'Bricolage Grotesque', 'Space Grotesk', 'Unbounded', 'Syne', 'Sora', 'Onest',
      'Hanken Grotesk', 'Schibsted Grotesk', 'Anybody', 'Bitcount Prop Single',
      'Doto', 'Climate Crisis', 'Micro 5', 'Pixelify Sans', 'Silkscreen',
      'Rubik Mono One', 'Major Mono Display', 'Honk', 'Nabla',
    ],
  },
  {
    label: 'Sans-serif',
    fonts: [
      'Inter', 'Poppins', 'Roboto', 'Montserrat', 'Open Sans', 'Lato', 'Raleway',
      'Nunito', 'Nunito Sans', 'Work Sans', 'Source Sans 3', 'DM Sans', 'Manrope',
      'Mulish', 'Rubik', 'Karla', 'Figtree', 'Plus Jakarta Sans', 'Outfit',
      'Albert Sans', 'Lexend', 'Be Vietnam Pro', 'Archivo', 'Barlow', 'Kanit',
      'Quicksand', 'Josefin Sans', 'Cabin', 'PT Sans', 'Oxygen', 'Assistant', 'Heebo',
    ],
  },
  {
    label: 'Display / Geometric',
    fonts: [
      'Anton', 'Bebas Neue', 'Oswald', 'Righteous', 'Fraunces', 'Pacifico',
      'Lobster', 'Comfortaa', 'Abril Fatface', 'Alfa Slab One', 'Passion One',
      'Titan One', 'Bungee', 'Monoton',
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
      'Geist Mono', 'Caveat', 'Dancing Script', 'Kalam', 'Shadows Into Light',
      'Permanent Marker', 'Satisfy', 'Sacramento',
    ],
  },
  { label: 'System / Classic', fonts: SYSTEM_FONTS },
];

/** Flat list of every available family (de-duplicated). */
export const ALL_FONTS = Array.from(new Set(FONT_GROUPS.flatMap((g) => g.fonts)));
/** Only the families that must be fetched from Google Fonts. */
export const GOOGLE_FONTS = ALL_FONTS.filter((f) => !isSystemFont(f));

/** Build a Google Fonts stylesheet URL for the given families (single weight for previews). */
export function googleFontsHref(families: string[], weights = false): string {
  const axis = weights ? ':wght@300;400;500;600;700;800' : '';
  const fam = families
    .filter((f) => !isSystemFont(f))
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}${axis}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}

let fontsLoaded = false;
/** Lazily load every previewable Google font into the host document (for the picker). */
export function ensureFontsLoaded(): void {
  if (fontsLoaded || typeof document === 'undefined') return;
  fontsLoaded = true;
  // Chunk so the request URLs stay a sane length.
  for (let i = 0; i < GOOGLE_FONTS.length; i += 24) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontsHref(GOOGLE_FONTS.slice(i, i + 24));
    document.head.appendChild(link);
  }
}

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
