import { contrastRatio, extractJson, validateHtmlBundle } from '../src/services/ai/validators';

const VALID_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Test</title></head>
<body>
  <header><nav aria-label="Main"><a href="#main">Skip</a></nav></header>
  <main id="main"><h1>Hello</h1><img src="a.png" alt="A descriptive alt"></main>
  <footer><p>Footer</p></footer>
</body>
</html>`;

describe('validateHtmlBundle', () => {
  it('passes a well-formed accessible document', () => {
    const report = validateHtmlBundle({ 'index.html': VALID_HTML }, 'index.html');
    expect(report.htmlErrors).toEqual([]);
    expect(report.htmlValid).toBe(true);
  });

  it('flags missing doctype, lang, main and alt text', () => {
    const html = '<html><body><img src="x.png"><div>hi</div></body></html>';
    const report = validateHtmlBundle({ 'index.html': html }, 'index.html');
    expect(report.htmlValid).toBe(false);
    expect(report.htmlErrors.join('\n')).toMatch(/DOCTYPE/);
    expect(report.htmlErrors.join('\n')).toMatch(/lang/);
    expect(report.htmlErrors.join('\n')).toMatch(/<main>/);
    expect(report.htmlErrors.join('\n')).toMatch(/alt/);
  });

  it('flags fixed widths likely to overflow mobile viewports', () => {
    const html = VALID_HTML.replace('<h1>Hello</h1>', '<div class="w-[1200px]">wide</div>');
    const report = validateHtmlBundle({ 'index.html': html }, 'index.html');
    expect(report.layoutOverflows.length).toBeGreaterThan(0);
  });
});

describe('contrastRatio', () => {
  it('computes 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
  it('computes 1:1 for identical colors', () => {
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('extractJson', () => {
  it('parses fenced model output', () => {
    expect(extractJson<{ a: number }>('```json\n{"a":1}\n```').a).toBe(1);
  });
  it('parses JSON embedded in prose', () => {
    expect(extractJson<{ ok: boolean }>('Sure! Here it is: {"ok":true} hope that helps').ok).toBe(true);
  });
  it('throws when no JSON present', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});
