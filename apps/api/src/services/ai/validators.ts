import type { ValidationReport } from '@forge/shared';

/**
 * Static validation that runs server-side without a browser:
 * - structural HTML checks (doctype, lang, landmarks, alt text, labels)
 * - WCAG contrast on inline hex pairs we can detect
 * - heuristics for layout overflow (fixed widths beyond viewport)
 * Browser-based Lighthouse runs are executed client-side in the preview
 * sandbox; this is the server-side gate.
 */
export function validateHtmlBundle(files: Record<string, string>, entryFile: string): Omit<ValidationReport, 'accessibilityScore' | 'performanceScore' | 'passed'> {
  const html = files[entryFile] ?? '';
  const htmlErrors: string[] = [];
  const contrastIssues: string[] = [];
  const layoutOverflows: string[] = [];

  if (!/^\s*<!doctype html>/i.test(html)) htmlErrors.push('Missing <!DOCTYPE html>');
  if (!/<html[^>]*\slang=/i.test(html)) htmlErrors.push('<html> missing lang attribute');
  if (!/<meta[^>]*charset/i.test(html)) htmlErrors.push('Missing <meta charset>');
  if (!/<meta[^>]*name=["']viewport["']/i.test(html)) htmlErrors.push('Missing viewport meta tag');
  if (!/<title>/i.test(html)) htmlErrors.push('Missing <title>');
  if (!/<main[\s>]/i.test(html)) htmlErrors.push('Missing <main> landmark');

  // Every <img> needs alt text.
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const img of imgs) {
    if (!/\salt=/i.test(img)) htmlErrors.push(`<img> without alt attribute: ${img.slice(0, 80)}`);
  }

  // Inputs should be labelled or aria-labelled.
  const inputs = html.match(/<input\b[^>]*>/gi) ?? [];
  for (const input of inputs) {
    const hasId = /\sid=["']([^"']+)["']/i.exec(input);
    const hasAria = /\saria-label(ledby)?=/i.test(input);
    const isHidden = /type=["']hidden["']/i.test(input);
    if (isHidden || hasAria) continue;
    if (!hasId || !new RegExp(`for=["']${hasId[1]}["']`, 'i').test(html)) {
      htmlErrors.push(`<input> without label or aria-label: ${input.slice(0, 80)}`);
    }
  }

  // Unbalanced tag heuristic for common containers.
  for (const tag of ['div', 'section', 'main', 'header', 'footer', 'nav', 'ul', 'li']) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) ?? []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length;
    if (open !== close) htmlErrors.push(`Unbalanced <${tag}>: ${open} open vs ${close} close`);
  }

  // Fixed pixel widths beyond a mobile viewport are an overflow smell.
  const wideMatches = html.match(/w-\[(\d{3,5})px\]|width:\s*(\d{3,5})px/g) ?? [];
  for (const m of wideMatches) {
    const px = Number(/(\d{3,5})/.exec(m)?.[1] ?? 0);
    if (px > 480) layoutOverflows.push(`Fixed width ${px}px may overflow small viewports (${m})`);
  }

  // Naive same-element fg/bg contrast detection on inline styles.
  const stylePairs = html.match(/style=["'][^"']*color:\s*#[0-9a-f]{6}[^"']*background(-color)?:\s*#[0-9a-f]{6}[^"']*["']/gi) ?? [];
  for (const pair of stylePairs) {
    const colors = pair.match(/#[0-9a-f]{6}/gi) ?? [];
    if (colors.length >= 2 && contrastRatio(colors[0]!, colors[1]!) < 4.5) {
      contrastIssues.push(`Contrast below 4.5:1 between ${colors[0]} and ${colors[1]}`);
    }
  }

  return { htmlValid: htmlErrors.length === 0, htmlErrors, contrastIssues, layoutOverflows };
}

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const [l1, l2] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (l1! + 0.05) / (l2! + 0.05);
}

/** Strip markdown fences and extract the first JSON object from model output. */
export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model output contained no JSON object');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
