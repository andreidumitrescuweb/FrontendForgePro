/* Standalone smoke test for the visual-editor runtime (which TS can't check,
 * since it lives inside a template string). Generates a harness we load in a
 * real browser, and parse-checks the runtime source. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUNTIME_SOURCE, buildEditorSrcDoc } from '../apps/web/src/components/editor/visual/runtime';
import { TEMPLATES } from '../apps/web/src/components/editor/visual/templates';

// 1) Parse-check the injected runtime — catches syntax errors tsc misses.
try {
  // eslint-disable-next-line no-new-func
  new Function(RUNTIME_SOURCE);
  console.log('RUNTIME_SOURCE: parse OK');
} catch (e) {
  console.error('RUNTIME_SOURCE: PARSE ERROR ->', (e as Error).message);
  process.exit(2);
}

// Load the Agency template THROUGH the editor — exercises templates + engine +
// selection + serialize together.
const tpl = TEMPLATES[0];
const srcDoc = buildEditorSrcDoc(tpl.files, tpl.entryFile, []);

const outDir = join(process.cwd(), '.fftest');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'iframe.html'), srcDoc, 'utf8');

const harness = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">
<iframe id="f" src="./iframe.html" sandbox="allow-scripts allow-same-origin allow-forms" style="width:900px;height:600px;border:0"></iframe>
<script>
  window.__log = [];
  window.addEventListener('message', function (e) { if (e.data && e.data.source === 'ff') window.__log.push(e.data); });
  window.__send = function (m) { document.getElementById('f').contentWindow.postMessage(Object.assign({ source: 'ff' }, m), '*'); };
  window.__doc = function () { return document.getElementById('f').contentDocument; };
</script>
</body></html>`;
writeFileSync(join(outDir, 'harness.html'), harness, 'utf8');

// 2) Minimal static server so the iframe is same-origin (lets the harness reach in).
import http from 'node:http';
import { readFileSync } from 'node:fs';
const port = 8852;
http
  .createServer((req, res) => {
    try {
      const name = (req.url || '/').split('?')[0].replace(/^\//, '') || 'harness.html';
      const body = readFileSync(join(outDir, name));
      res.setHeader('Content-Type', name.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end('nf');
    }
  })
  .listen(port, () => console.log('TEST SERVER READY http://localhost:' + port + '/harness.html'));
