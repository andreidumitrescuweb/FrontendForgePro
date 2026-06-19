import { FF_ID_ATTR, FF_SRC_ATTR, FF_THEME_ID } from './protocol';

/**
 * Builds the self-contained HTML document loaded into the editor iframe.
 *
 * The generated project's separate CSS/JS files are inlined so the sandbox
 * renders without a server, but each inlined block is tagged with
 * `data-ff-src` so the runtime can split them back into files on save.
 */
export function buildEditorSrcDoc(
  files: Record<string, string>,
  entryFile: string,
  assets: Array<{ path: string; url: string }>,
): string {
  let html =
    files[entryFile] ??
    '<!doctype html><html><body style="font-family:sans-serif;padding:2rem">Generate the project to start designing.</body></html>';

  // Point generated asset references at their CDN/S3 URLs for rendering.
  for (const asset of assets) {
    html = html.split(asset.path).join(asset.url);
  }

  // Inline local stylesheets/scripts, tagging them for the save round-trip.
  for (const [path, content] of Object.entries(files)) {
    if (path === entryFile) continue;
    if (path.endsWith('.css')) {
      const linkRe = new RegExp(`<link[^>]*href=["']\\.?/?${escapeRegExp(path)}["'][^>]*>`, 'i');
      const block = `<style ${FF_SRC_ATTR}="${path}">${content}</style>`;
      html = linkRe.test(html) ? html.replace(linkRe, block) : html.replace('</head>', `${block}</head>`);
    } else if (path.endsWith('.js')) {
      const scriptRe = new RegExp(`<script[^>]*src=["']\\.?/?${escapeRegExp(path)}["'][^>]*></script>`, 'i');
      const block = `<script ${FF_SRC_ATTR}="${path}">${content}</script>`;
      if (scriptRe.test(html)) html = html.replace(scriptRe, block);
    }
  }

  const config = JSON.stringify({ entryFile, assets });
  const bootstrap =
    `<script class="ff-chrome">window.__FF_CONFIG__=${config};</script>` +
    `<script class="ff-chrome" id="ff-runtime">${RUNTIME_SOURCE}</script>`;
  if (html.includes('</body>')) return html.replace('</body>', `${bootstrap}</body>`);
  return html + bootstrap;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The editor runtime, injected as a string into the iframe. It runs in the
 * iframe's own context (no imports), talks to the host via postMessage, and is
 * the single owner of the live document while editing.
 */
export const RUNTIME_SOURCE = /* js */ `
(function () {
  var FF_ID = ${JSON.stringify(FF_ID_ATTR)};
  var FF_SRC = ${JSON.stringify(FF_SRC_ATTR)};
  var FF_THEME = ${JSON.stringify(FF_THEME_ID)};
  var FF_OVERRIDES = 'ff-overrides';
  var cfg = window.__FF_CONFIG__ || { entryFile: 'index.html', assets: [] };
  var mode = 'edit';
  var selected = null;
  var idCounter = 0;

  // ---- helpers ----------------------------------------------------------
  function post(msg) { msg.source = 'ff'; parent.postMessage(msg, '*'); }
  function isChrome(el) { return el && el.classList && el.classList.contains('ff-chrome'); }
  function kebab(s) { return s.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }); }

  function ensureIds() {
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (isChrome(el)) continue;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK' || el.tagName === 'META') continue;
      if (!el.getAttribute(FF_ID)) el.setAttribute(FF_ID, 'e' + (++idCounter));
      else {
        var n = parseInt(String(el.getAttribute(FF_ID)).slice(1), 10);
        if (!isNaN(n) && n > idCounter) idCounter = n;
      }
    }
  }

  function byId(ffid) { return document.querySelector('[' + FF_ID + '="' + ffid + '"]'); }

  // ---- managed stylesheets ---------------------------------------------
  function getOverrideSheet() {
    var el = document.getElementById(FF_OVERRIDES);
    if (!el) {
      el = document.createElement('style');
      el.id = FF_OVERRIDES;
      document.head.appendChild(el);
    }
    return el.sheet;
  }

  function findRule(sheet, selector) {
    for (var i = 0; i < sheet.cssRules.length; i++) {
      if (sheet.cssRules[i].type === 1 && sheet.cssRules[i].selectorText === selector) return sheet.cssRules[i];
    }
    var idx = sheet.insertRule(selector + '{}', sheet.cssRules.length);
    return sheet.cssRules[idx];
  }

  function findMedia(sheet, query) {
    for (var i = 0; i < sheet.cssRules.length; i++) {
      if (sheet.cssRules[i].type === 4 && sheet.cssRules[i].conditionText === query) return sheet.cssRules[i];
    }
    var idx = sheet.insertRule('@media ' + query + '{}', sheet.cssRules.length);
    return sheet.cssRules[idx];
  }

  var BP = { desktop: null, tablet: '(max-width: 1024px)', mobile: '(max-width: 640px)' };

  function ruleFor(ffid, breakpoint) {
    var sheet = getOverrideSheet();
    var selector = '[' + FF_ID + '="' + ffid + '"]';
    if (!breakpoint || breakpoint === 'desktop') return findRule(sheet, selector);
    var media = findMedia(sheet, BP[breakpoint]);
    return findRule(media, selector);
  }

  function applyStyle(ffid, styles, breakpoint) {
    var rule = ruleFor(ffid, breakpoint);
    for (var prop in styles) {
      if (!Object.prototype.hasOwnProperty.call(styles, prop)) continue;
      var val = styles[prop];
      if (val === '' || val == null) rule.style.removeProperty(kebab(prop));
      else rule.style.setProperty(kebab(prop), String(val), 'important');
    }
  }

  // ---- selection overlay ------------------------------------------------
  var hoverBox = mkBox('#6366f1', 0.08);
  var selBox = mkBox('#4f46e5', 0.0);
  selBox.style.outline = '2px solid #4f46e5';
  function mkBox(color, alpha) {
    var b = document.createElement('div');
    b.className = 'ff-chrome';
    b.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;display:none;border:1px solid ' + color + ';background:rgba(99,102,241,' + alpha + ');transition:all .03s linear';
    document.documentElement.appendChild(b);
    return b;
  }
  function place(box, el) {
    if (!el) { box.style.display = 'none'; return; }
    var r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
  }
  function refresh() { place(hoverBox, mode === 'edit' ? hoverEl : null); place(selBox, selected); }
  var hoverEl = null;

  // ---- node info --------------------------------------------------------
  var STYLE_KEYS = ['color','backgroundColor','fontFamily','fontSize','fontWeight','fontStyle','textAlign','lineHeight','letterSpacing','textTransform','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft','borderRadius','borderWidth','borderColor','borderStyle','boxShadow','opacity','display','width','maxWidth','objectFit'];

  function labelOf(el) {
    function tag(e) {
      var t = e.tagName.toLowerCase();
      if (e.id) return t + '#' + e.id;
      if (e.className && typeof e.className === 'string') {
        var c = e.className.split(/\\s+/).filter(function (x) { return x && x.indexOf('ff-') !== 0; })[0];
        if (c) return t + '.' + c;
      }
      return t;
    }
    var parent = el.parentElement && el.parentElement !== document.body ? tag(el.parentElement) + ' › ' : '';
    return parent + tag(el);
  }

  function nodeInfo(el) {
    var cs = getComputedStyle(el);
    var computed = {};
    for (var i = 0; i < STYLE_KEYS.length; i++) computed[STYLE_KEYS[i]] = cs[STYLE_KEYS[i]];
    var sib = el; var up = false, down = false;
    var prev = el.previousElementSibling; while (prev) { if (!isChrome(prev)) { up = true; break; } prev = prev.previousElementSibling; }
    var next = el.nextElementSibling; while (next) { if (!isChrome(next)) { down = true; break; } next = next.nextElementSibling; }
    var link = el.closest ? el.closest('a') : null;
    var hasElementChildren = false;
    for (var c = 0; c < el.children.length; c++) { if (!isChrome(el.children[c])) { hasElementChildren = true; break; } }
    return {
      ffid: el.getAttribute(FF_ID),
      tag: el.tagName.toLowerCase(),
      text: hasElementChildren ? '' : (el.textContent || '').trim(),
      isImage: el.tagName === 'IMG',
      isLink: !!link,
      src: el.tagName === 'IMG' ? el.getAttribute('src') : null,
      alt: el.tagName === 'IMG' ? (el.getAttribute('alt') || '') : null,
      href: link ? link.getAttribute('href') : null,
      parentFfid: el.parentElement && el.parentElement.getAttribute ? el.parentElement.getAttribute(FF_ID) : null,
      canMoveUp: up,
      canMoveDown: down,
      computed: computed,
      label: labelOf(el)
    };
  }

  function select(el) {
    if (!el || isChrome(el)) return;
    selected = el;
    refresh();
    post({ type: 'selected', node: nodeInfo(el) });
  }

  // ---- event handlers ---------------------------------------------------
  document.addEventListener('mouseover', function (e) {
    if (mode !== 'edit') return;
    var t = e.target;
    if (isChrome(t) || t === document.documentElement || t === document.body) { hoverEl = null; place(hoverBox, null); return; }
    hoverEl = t; place(hoverBox, t);
  }, true);

  document.addEventListener('click', function (e) {
    if (mode !== 'edit') return;
    var t = e.target;
    if (isChrome(t)) return;
    if (t.isContentEditable) return; // let text editing handle its own clicks
    e.preventDefault();
    e.stopPropagation();
    select(t);
  }, true);

  document.addEventListener('dblclick', function (e) {
    if (mode !== 'edit') return;
    var t = e.target;
    if (isChrome(t) || t.tagName === 'IMG') return;
    var hasChild = false;
    for (var c = 0; c < t.children.length; c++) { if (!isChrome(t.children[c])) { hasChild = true; break; } }
    if (hasChild) return;
    t.setAttribute('contenteditable', 'true');
    t.focus();
    t.addEventListener('blur', function onBlur() {
      t.removeAttribute('contenteditable');
      t.removeEventListener('blur', onBlur);
      post({ type: 'changed' });
      if (selected === t) post({ type: 'selected', node: nodeInfo(t) });
    });
  }, true);

  window.addEventListener('scroll', refresh, true);
  window.addEventListener('resize', refresh);

  // ---- DOM ops ----------------------------------------------------------
  function siblingDir(el, dir) {
    var s = dir === 'up' ? el.previousElementSibling : el.nextElementSibling;
    while (s && isChrome(s)) s = dir === 'up' ? s.previousElementSibling : s.nextElementSibling;
    return s;
  }

  // ---- serialization ----------------------------------------------------
  function syncManagedBlocks(doc) {
    // CSSOM edits don't update <style>.textContent; rebuild it before serializing.
    var live = document.getElementById(FF_OVERRIDES);
    if (live && live.sheet) {
      var text = '';
      for (var i = 0; i < live.sheet.cssRules.length; i++) text += live.sheet.cssRules[i].cssText + '\\n';
      var clone = doc.getElementById(FF_OVERRIDES);
      if (clone) clone.textContent = text;
    }
  }

  function serialize(nonce) {
    var root = document.documentElement.cloneNode(true);
    syncManagedBlocks(root);

    // Strip editor-only chrome and state.
    var chrome = root.querySelectorAll('.ff-chrome, #ff-runtime');
    for (var i = 0; i < chrome.length; i++) chrome[i].parentNode.removeChild(chrome[i]);
    var editing = root.querySelectorAll('[contenteditable]');
    for (var j = 0; j < editing.length; j++) editing[j].removeAttribute('contenteditable');

    var files = {};

    // Split inlined CSS/JS back into their files and restore the original tags.
    var inlined = root.querySelectorAll('[' + FF_SRC + ']');
    for (var k = 0; k < inlined.length; k++) {
      var node = inlined[k];
      var path = node.getAttribute(FF_SRC);
      files[path] = node.textContent || '';
      var repl;
      if (node.tagName === 'STYLE') {
        repl = document.createElement('link');
        repl.setAttribute('rel', 'stylesheet');
        repl.setAttribute('href', path);
      } else {
        repl = document.createElement('script');
        repl.setAttribute('src', path);
      }
      node.parentNode.replaceChild(repl, node);
    }

    var outer = root.outerHTML;
    // Reverse asset CDN URLs back to their original relative paths.
    for (var a = 0; a < cfg.assets.length; a++) {
      if (cfg.assets[a].url) outer = outer.split(cfg.assets[a].url).join(cfg.assets[a].path);
    }
    files[cfg.entryFile] = '<!DOCTYPE html>\\n' + outer;
    post({ type: 'serialized', nonce: nonce, files: files });
  }

  // ---- host message handling -------------------------------------------
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.source !== 'ff') return;
    switch (m.type) {
      case 'setMode':
        mode = m.mode;
        document.body.style.cursor = mode === 'edit' ? 'default' : '';
        if (mode !== 'edit') { selected = null; hoverEl = null; }
        refresh();
        break;
      case 'select': select(byId(m.ffid)); break;
      case 'deselect': selected = null; refresh(); break;
      case 'applyStyle': applyStyle(m.ffid, m.styles, m.breakpoint); refresh(); post({ type: 'changed' }); break;
      case 'setAttr': { var el = byId(m.ffid); if (el) { if (m.value === '' && m.attr !== 'alt') el.removeAttribute(m.attr); else el.setAttribute(m.attr, m.value); } post({ type: 'changed' }); break; }
      case 'setText': { var el2 = byId(m.ffid); if (el2) el2.textContent = m.text; post({ type: 'changed' }); break; }
      case 'setTheme': {
        var t = document.getElementById(FF_THEME);
        if (!t) { t = document.createElement('style'); t.id = FF_THEME; document.head.appendChild(t); }
        t.textContent = m.css;
        applyFontLinks(m.fontLinks);
        post({ type: 'changed' });
        break;
      }
      case 'insertSection': {
        var tmp = document.createElement('div');
        tmp.innerHTML = m.html;
        var nodes = Array.prototype.slice.call(tmp.childNodes);
        var anchor = m.relativeTo ? byId(m.relativeTo) : null;
        for (var n = 0; n < nodes.length; n++) {
          if (m.position === 'before' && anchor) anchor.parentNode.insertBefore(nodes[n], anchor);
          else if (m.position === 'after' && anchor) anchor.parentNode.insertBefore(nodes[n], anchor.nextSibling);
          else document.body.appendChild(nodes[n]);
        }
        ensureIds();
        post({ type: 'changed' });
        break;
      }
      case 'remove': { var r = byId(m.ffid); if (r) r.parentNode.removeChild(r); if (selected && !selected.isConnected) selected = null; refresh(); post({ type: 'deselected' }); post({ type: 'changed' }); break; }
      case 'duplicate': { var d = byId(m.ffid); if (d) { var clone = d.cloneNode(true); clearIds(clone); d.parentNode.insertBefore(clone, d.nextSibling); ensureIds(); } post({ type: 'changed' }); break; }
      case 'move': { var mv = byId(m.ffid); var sib = mv ? siblingDir(mv, m.direction) : null; if (mv && sib) { if (m.direction === 'up') sib.parentNode.insertBefore(mv, sib); else sib.parentNode.insertBefore(mv, sib.nextSibling); } refresh(); post({ type: 'changed' }); break; }
      case 'serialize': serialize(m.nonce); break;
    }
  });

  function clearIds(el) {
    if (el.removeAttribute) el.removeAttribute(FF_ID);
    if (el.querySelectorAll) { var k = el.querySelectorAll('[' + FF_ID + ']'); for (var i = 0; i < k.length; i++) k[i].removeAttribute(FF_ID); }
  }

  function applyFontLinks(links) {
    var existing = document.querySelectorAll('link[data-ff-font]');
    for (var i = 0; i < existing.length; i++) existing[i].parentNode.removeChild(existing[i]);
    for (var j = 0; j < (links || []).length; j++) {
      var l = document.createElement('link');
      l.setAttribute('rel', 'stylesheet');
      l.setAttribute('data-ff-font', '1');
      l.setAttribute('href', 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(links[j]).replace(/%20/g, '+') + ':wght@300;400;500;600;700;800&display=swap');
      document.head.appendChild(l);
    }
  }

  // ---- boot -------------------------------------------------------------
  ensureIds();
  post({ type: 'ready' });
})();
`;
