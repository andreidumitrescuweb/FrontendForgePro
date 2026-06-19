/* Standalone smoke test for the visual-editor runtime (which TS can't check,
 * since it lives inside a template string). Generates a harness we load in a
 * real browser, and parse-checks the runtime source. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUNTIME_SOURCE, buildEditorSrcDoc } from '../apps/web/src/components/editor/visual/runtime';

// 1) Parse-check the injected runtime — catches syntax errors tsc misses.
try {
  // eslint-disable-next-line no-new-func
  new Function(RUNTIME_SOURCE);
  console.log('RUNTIME_SOURCE: parse OK');
} catch (e) {
  console.error('RUNTIME_SOURCE: PARSE ERROR ->', (e as Error).message);
  process.exit(2);
}

const files: Record<string, string> = {
  'index.html': `<!doctype html><html><head><meta charset="utf-8"><title>T</title><link rel="stylesheet" href="styles.css"></head><body><section class="hero"><h1>Hello world</h1><p>Some paragraph text</p><button>Click me</button><img src="https://placehold.co/120x80" alt="x"></section><section class="features"><h2>Features</h2></section></body></html>`,
  'styles.css': `body{font-family:system-ui;margin:0}.hero{padding:40px}h1{color:#111;font-size:40px}`,
};

const srcDoc = buildEditorSrcDoc(files, 'index.html', []);

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
const port = 8850;
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
