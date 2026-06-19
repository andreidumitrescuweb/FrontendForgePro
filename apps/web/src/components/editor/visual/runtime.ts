import { FF_ID_ATTR, FF_SRC_ATTR, FF_THEME_ID } from './protocol';
import { MOTION_ENGINE_SRC } from './motionEngine';
import { BLANK_TEMPLATE } from './templates';

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
  // Fall back to the professional blank skeleton (never a throwaway placeholder
  // string) so an un-generated project is still a clean, savable starting point.
  let html = files[entryFile] || BLANK_TEMPLATE.files['index.html'];

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

  // ---- free transform (drag + rotate via CSS vars) ----------------------
  function ensureTransform(ffid) {
    var rule = ruleFor(ffid, 'desktop');
    if (rule.style.getPropertyValue('--ff-tx') === '') rule.style.setProperty('--ff-tx', '0px');
    if (rule.style.getPropertyValue('--ff-ty') === '') rule.style.setProperty('--ff-ty', '0px');
    if (rule.style.getPropertyValue('--ff-rot') === '') rule.style.setProperty('--ff-rot', '0deg');
    rule.style.setProperty('transform', 'translate(var(--ff-tx),var(--ff-ty)) rotate(var(--ff-rot))', 'important');
    return rule;
  }
  function applyTransform(ffid, tx, ty, rot) {
    var rule = ensureTransform(ffid);
    rule.style.setProperty('--ff-tx', tx + 'px');
    rule.style.setProperty('--ff-ty', ty + 'px');
    rule.style.setProperty('--ff-rot', rot + 'deg');
  }

  // ---- motion / animation presets ---------------------------------------
  var motionInjected = false;
  function ensureMotion() {
    if (motionInjected || document.getElementById('ff-motion')) { motionInjected = true; return; }
    var s = document.createElement('style');
    s.id = 'ff-motion';
    s.textContent =
      '@keyframes ff-fade{from{opacity:0}to{opacity:1}}' +
      '@keyframes ff-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}' +
      '@keyframes ff-left{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:translateX(0)}}' +
      '@keyframes ff-zoom{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}' +
      '@keyframes ff-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}' +
      '@keyframes ff-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}' +
      '@keyframes ff-spin{to{transform:rotate(360deg)}}' +
      '.ff-anim-fade{animation:ff-fade .8s ease both}' +
      '.ff-anim-up{animation:ff-up .8s ease both}' +
      '.ff-anim-left{animation:ff-left .8s ease both}' +
      '.ff-anim-zoom{animation:ff-zoom .8s ease both}' +
      '.ff-anim-float{animation:ff-float 3s ease-in-out infinite}' +
      '.ff-anim-pulse{animation:ff-pulse 2.5s ease-in-out infinite}' +
      '.ff-anim-spin{animation:ff-spin 9s linear infinite}';
    document.head.appendChild(s);
    motionInjected = true;
  }
  // Real scroll-motion engine (shared with templates), injected as a persistent
  // (non-chrome) script so it runs both in the editor preview AND in exports.
  var ENGINE_SRC = ${JSON.stringify(MOTION_ENGINE_SRC)};
  var engineInjected = false;
  function ensureEngine() {
    if (engineInjected || document.querySelector('script[data-ff-engine]')) {
      engineInjected = true;
      if (window.__ffMotion) window.__ffMotion.refresh();
      return;
    }
    var sc = document.createElement('script');
    sc.setAttribute('data-ff-engine', '1');
    sc.textContent = ENGINE_SRC;
    document.body.appendChild(sc);
    engineInjected = true;
  }

  var SCROLL_ANIMS = { up: 1, fade: 1, left: 1, right: 1, zoom: 1, parallax: 1 };
  function setAnimation(ffid, name) {
    var el = byId(ffid);
    if (!el) return;
    var rm = [];
    for (var i = 0; i < el.classList.length; i++) { if (el.classList[i].indexOf('ff-anim-') === 0) rm.push(el.classList[i]); }
    for (var j = 0; j < rm.length; j++) el.classList.remove(rm[j]);
    el.removeAttribute('data-ff-m');
    el.style.removeProperty('transform'); // clear any parallax inline transform
    if (!name) return;
    if (SCROLL_ANIMS[name]) {
      el.setAttribute('data-ff-m', name);
      ensureEngine();
      if (window.__ffMotion) window.__ffMotion.refresh();
    } else {
      ensureMotion();
      el.classList.add('ff-anim-' + name);
      void el.offsetWidth;
    }
  }

  // ---- selection overlay + on-canvas transform controls -----------------
  var hoverEl = null;
  function mkBox(color, alpha) {
    var b = document.createElement('div');
    b.className = 'ff-chrome';
    b.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;display:none;border:1px solid ' + color + ';background:rgba(99,102,241,' + alpha + ')';
    document.documentElement.appendChild(b);
    return b;
  }
  var hoverBox = mkBox('#6366f1', 0.08);
  function place(box, el) {
    if (!el) { box.style.display = 'none'; return; }
    var r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
  }

  // Interactive frame: 8 resize handles + a rotate handle, like Canva/Affinity.
  var controls = document.createElement('div');
  controls.className = 'ff-chrome';
  controls.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646;display:none;outline:2px solid #4f46e5;box-sizing:border-box;transform-origin:center center';
  document.documentElement.appendChild(controls);

  function handleCursor(d) {
    return { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }[d];
  }
  function handlePos(d) {
    var o = '-6px', c = 'calc(50% - 5.5px)';
    var top = d.indexOf('n') >= 0 ? o : (d.indexOf('s') >= 0 ? 'auto' : c);
    var bottom = d.indexOf('s') >= 0 ? o : 'auto';
    var left = d.indexOf('w') >= 0 ? o : (d.indexOf('e') >= 0 ? 'auto' : c);
    var right = d.indexOf('e') >= 0 ? o : 'auto';
    return 'top:' + top + ';bottom:' + bottom + ';left:' + left + ';right:' + right + ';';
  }
  ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (dir) {
    var h = document.createElement('div');
    h.className = 'ff-chrome';
    h.style.cssText = 'position:absolute;width:11px;height:11px;background:#fff;border:1.5px solid #4f46e5;border-radius:2px;pointer-events:auto;box-sizing:border-box;' + handlePos(dir) + 'cursor:' + handleCursor(dir);
    controls.appendChild(h);
    h.addEventListener('mousedown', function (e) { startResize(e, dir); });
  });
  var rotLine = document.createElement('div');
  rotLine.className = 'ff-chrome';
  rotLine.style.cssText = 'position:absolute;left:50%;top:-22px;width:2px;height:22px;background:#4f46e5;margin-left:-1px;pointer-events:none';
  controls.appendChild(rotLine);
  var rotateEl = document.createElement('div');
  rotateEl.className = 'ff-chrome';
  rotateEl.style.cssText = 'position:absolute;left:50%;top:-34px;width:14px;height:14px;margin-left:-7px;background:#4f46e5;border:2px solid #fff;border-radius:50%;pointer-events:auto;cursor:grab';
  controls.appendChild(rotateEl);
  rotateEl.addEventListener('mousedown', startRotate);

  function isTextEl(el) {
    if (el.tagName === 'IMG') return false;
    for (var i = 0; i < el.children.length; i++) { if (!isChrome(el.children[i])) return false; }
    return (el.textContent || '').trim().length > 0;
  }

  function startResize(e, dir) {
    e.preventDefault();
    e.stopPropagation();
    if (!selected) return;
    var ffid = selected.getAttribute(FF_ID);
    var cs = getComputedStyle(selected);
    var rot = parseFloat(cs.getPropertyValue('--ff-rot')) || 0;
    var startW = selected.offsetWidth, startH = selected.offsetHeight;
    var startFont = parseFloat(cs.fontSize) || 16;
    var text = isTextEl(selected);
    var sx = e.clientX, sy = e.clientY;
    function move(ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      var a = -rot * Math.PI / 180;
      var lx = dx * Math.cos(a) - dy * Math.sin(a);
      var ly = dx * Math.sin(a) + dy * Math.cos(a);
      var sgX = dir.indexOf('e') >= 0 ? 1 : (dir.indexOf('w') >= 0 ? -1 : 0);
      var sgY = dir.indexOf('s') >= 0 ? 1 : (dir.indexOf('n') >= 0 ? -1 : 0);
      var rule = ruleFor(ffid, 'desktop');
      if (text && dir.length === 2) {
        var scale = Math.max(0.2, (startW + sgX * lx) / startW);
        rule.style.setProperty('font-size', Math.max(6, Math.round(startFont * scale)) + 'px', 'important');
      } else {
        if (sgX !== 0) rule.style.setProperty('width', Math.max(16, Math.round(startW + sgX * lx)) + 'px', 'important');
        if (sgY !== 0) rule.style.setProperty('height', Math.max(16, Math.round(startH + sgY * ly)) + 'px', 'important');
      }
      refreshControls();
    }
    function up() {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseup', up, true);
      post({ type: 'changed' });
      if (selected) post({ type: 'selected', node: nodeInfo(selected) });
    }
    document.addEventListener('mousemove', move, true);
    document.addEventListener('mouseup', up, true);
  }

  function startRotate(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!selected) return;
    var ffid = selected.getAttribute(FF_ID);
    var cs = getComputedStyle(selected);
    var tx = parseFloat(cs.getPropertyValue('--ff-tx')) || 0;
    var ty = parseFloat(cs.getPropertyValue('--ff-ty')) || 0;
    var r = selected.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    function move(ev) {
      var ang = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90;
      if (ev.shiftKey) ang = Math.round(ang / 15) * 15;
      applyTransform(ffid, tx, ty, Math.round(ang));
      refreshControls();
    }
    function up() {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseup', up, true);
      post({ type: 'changed' });
      if (selected) post({ type: 'selected', node: nodeInfo(selected) });
    }
    document.addEventListener('mousemove', move, true);
    document.addEventListener('mouseup', up, true);
  }

  function refreshControls() {
    if (!selected || mode !== 'edit' || !selected.isConnected) { controls.style.display = 'none'; return; }
    var r = selected.getBoundingClientRect();
    var w = selected.offsetWidth, h = selected.offsetHeight;
    var rot = parseFloat(getComputedStyle(selected).getPropertyValue('--ff-rot')) || 0;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    controls.style.display = 'block';
    controls.style.width = w + 'px';
    controls.style.height = h + 'px';
    controls.style.left = (cx - w / 2) + 'px';
    controls.style.top = (cy - h / 2) + 'px';
    controls.style.transform = 'rotate(' + rot + 'deg)';
  }

  function refresh() { place(hoverBox, mode === 'edit' ? hoverEl : null); refreshControls(); }

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
    var tx = parseFloat(cs.getPropertyValue('--ff-tx')) || 0;
    var ty = parseFloat(cs.getPropertyValue('--ff-ty')) || 0;
    var rot = parseFloat(cs.getPropertyValue('--ff-rot')) || 0;
    var anim = el.getAttribute('data-ff-m') || '';
    if (!anim) { for (var ai = 0; ai < el.classList.length; ai++) { if (el.classList[ai].indexOf('ff-anim-') === 0) { anim = el.classList[ai].slice(8); break; } } }
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
      transform: { tx: tx, ty: ty, rot: rot },
      animation: anim,
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

  // ---- drag the selected element freely ---------------------------------
  var drag = null;
  document.addEventListener('mousedown', function (e) {
    if (mode !== 'edit') return;
    var t = e.target;
    if (isChrome(t) || (t.isContentEditable)) return;
    if (!selected || (t !== selected && !selected.contains(t))) return;
    var ffid = selected.getAttribute(FF_ID);
    var cs = getComputedStyle(selected);
    drag = {
      ffid: ffid,
      startX: e.clientX,
      startY: e.clientY,
      baseTx: parseFloat(cs.getPropertyValue('--ff-tx')) || 0,
      baseTy: parseFloat(cs.getPropertyValue('--ff-ty')) || 0,
      rot: parseFloat(cs.getPropertyValue('--ff-rot')) || 0,
      moved: false,
    };
  }, true);
  document.addEventListener('mousemove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.startX;
    var dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    e.preventDefault();
    applyTransform(drag.ffid, drag.baseTx + dx, drag.baseTy + dy, drag.rot);
    refresh();
  }, true);
  document.addEventListener('mouseup', function () {
    if (drag && drag.moved) {
      post({ type: 'changed' });
      if (selected) post({ type: 'selected', node: nodeInfo(selected) });
    }
    drag = null;
  }, true);

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
      // doc is a cloned <html> element, not a Document — use querySelector.
      var clone = doc.querySelector('#' + FF_OVERRIDES);
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
      case 'applyTransform': applyTransform(m.ffid, m.tx, m.ty, m.rot); refresh(); post({ type: 'changed' }); break;
      case 'setAnimation': setAnimation(m.ffid, m.name); post({ type: 'changed' }); if (selected) post({ type: 'selected', node: nodeInfo(selected) }); break;
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
  if (document.querySelector('[data-ff-m]')) ensureEngine();
  post({ type: 'ready' });
})();
`;
