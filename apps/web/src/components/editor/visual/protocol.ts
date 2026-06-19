/**
 * Message protocol between the React host (parent window) and the editor runtime
 * injected into the preview iframe. The iframe DOM is the source of truth while
 * editing; on save the runtime serializes a cleaned-up copy back into the file map.
 */

/** Attribute the runtime stamps on every editable element to address it stably. */
export const FF_ID_ATTR = 'data-ffid';
/** Marks a `<style>`/`<script>` that was inlined from a separate file (for round-trip). */
export const FF_SRC_ATTR = 'data-ff-src';
/** The single managed style block that holds global theme tokens. */
export const FF_THEME_ID = 'ff-theme';

export type DeviceMode = 'desktop' | 'tablet' | 'mobile';

/** Snapshot of a selected element sent from the iframe to the inspector. */
export interface NodeInfo {
  ffid: string;
  tag: string;
  /** Plain-text content (only for leaf/text elements). */
  text: string;
  /** True when the element is an <img>. */
  isImage: boolean;
  /** True when the element is or sits inside an <a>. */
  isLink: boolean;
  src: string | null;
  alt: string | null;
  href: string | null;
  /** ffid of the parent element, for "select parent" navigation. */
  parentFfid: string | null;
  /** Whether the element can move up / down among its siblings. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Resolved styles (computed unless an inline override exists). */
  computed: NodeStyles;
  /** Current free-transform (drag offset + rotation). */
  transform: { tx: number; ty: number; rot: number };
  /** Active animation preset name, or '' for none. */
  animation: string;
  /** Human label for the breadcrumb, e.g. "section.hero > h1". */
  label: string;
}

/** Style fields the inspector reads/writes. Values are CSS strings. */
export interface NodeStyles {
  color: string;
  backgroundColor: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  textAlign: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  borderRadius: string;
  borderWidth: string;
  borderColor: string;
  borderStyle: string;
  boxShadow: string;
  opacity: string;
  display: string;
  width: string;
  maxWidth: string;
  objectFit: string;
}

/** Theme tokens applied globally via CSS custom properties on :root. */
export interface ThemeTokens {
  vars: Record<string, string>;
  /** Google Font families to load, e.g. ["Inter", "Poppins"]. */
  fontLinks: string[];
}

/** Messages: iframe runtime -> React host. */
export type RuntimeMessage =
  | { source: 'ff'; type: 'ready' }
  | { source: 'ff'; type: 'selected'; node: NodeInfo }
  | { source: 'ff'; type: 'deselected' }
  | { source: 'ff'; type: 'changed' } // DOM mutated -> host marks dirty
  | { source: 'ff'; type: 'serialized'; nonce: number; files: Record<string, string> };

/** Messages: React host -> iframe runtime. Breakpoint targets which media layer to write. */
export type HostMessage =
  | { source: 'ff'; type: 'setMode'; mode: 'edit' | 'preview' }
  | { source: 'ff'; type: 'setDevice'; device: DeviceMode }
  | { source: 'ff'; type: 'select'; ffid: string }
  | { source: 'ff'; type: 'deselect' }
  | { source: 'ff'; type: 'applyStyle'; ffid: string; styles: Partial<NodeStyles>; breakpoint: DeviceMode }
  | { source: 'ff'; type: 'applyTransform'; ffid: string; tx: number; ty: number; rot: number }
  | { source: 'ff'; type: 'setAnimation'; ffid: string; name: string }
  | { source: 'ff'; type: 'setAttr'; ffid: string; attr: string; value: string }
  | { source: 'ff'; type: 'setText'; ffid: string; text: string }
  | { source: 'ff'; type: 'setTheme'; css: string; fontLinks: string[] }
  | { source: 'ff'; type: 'insertSection'; html: string; relativeTo: string | null; position: 'before' | 'after' | 'append' }
  | { source: 'ff'; type: 'remove'; ffid: string }
  | { source: 'ff'; type: 'duplicate'; ffid: string }
  | { source: 'ff'; type: 'move'; ffid: string; direction: 'up' | 'down' }
  | { source: 'ff'; type: 'serialize'; nonce: number }
  | { source: 'ff'; type: 'replaceDoc'; html: string }; // for undo/redo

export function isRuntimeMessage(data: unknown): data is RuntimeMessage {
  return !!data && typeof data === 'object' && (data as { source?: string }).source === 'ff';
}
