import sharp from 'sharp';
import type {
  GeneratedAsset,
  GeneratedBundle,
  GenerationResult,
  ProjectBrief,
  SeoMeta,
  ValidationReport,
} from '@forge/shared';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { uploadObject } from '../../lib/s3';
import {
  generateCompletion,
  generateImage,
  reviewCompletion,
} from './providers';
import {
  GENERATOR_SYSTEM,
  PLANNER_SYSTEM,
  REVIEWER_SYSTEM,
  SEO_SYSTEM,
  generatorUser,
  plannerUser,
} from './prompts';
import { extractJson, validateHtmlBundle } from './validators';

interface BuildPlan {
  sections: Array<{ id: string; purpose: string; layout: string; content: string }>;
  colorPalette: string[];
  fonts: { heading: string; body: string };
  imageAssets: Array<{ path: string; prompt: string }>;
  notes: string;
}

interface ReviewerVerdict {
  accessibilityScore: number;
  performanceScore: number;
  issues: string[];
  contrastIssues: string[];
  pass: boolean;
}

export type StatusCallback = (status: string) => Promise<void>;

/**
 * Full generation pipeline:
 *  plan -> generate -> static validation -> AI review -> (regenerate up to N times) -> SEO pass -> assets
 */
export async function runGenerationPipeline(
  projectId: string,
  brief: ProjectBrief,
  onStatus: StatusCallback,
  options: { watermark: boolean; analyticsKey: string },
): Promise<GenerationResult> {
  await onStatus('PLANNING');
  const planRaw = await generateCompletion({
    system: PLANNER_SYSTEM,
    user: plannerUser(brief),
    temperature: 0.6,
  });
  const plan = extractJson<BuildPlan>(planRaw.text);
  logger.info('Plan ready', { projectId, sections: plan.sections.length });

  let files: Record<string, string> = {};
  let entryFile = 'index.html';
  let modelUsed = '';
  let verdict: ReviewerVerdict = {
    accessibilityScore: 0,
    performanceScore: 0,
    issues: [],
    contrastIssues: [],
    pass: false,
  };
  let staticReport = { htmlValid: false, htmlErrors: [] as string[], contrastIssues: [] as string[], layoutOverflows: [] as string[] };
  let feedback: string | undefined;
  let attempts = 0;

  while (attempts < env.AI_MAX_REGEN_ATTEMPTS) {
    attempts += 1;
    await onStatus('GENERATING');
    const genRaw = await generateCompletion({
      system: GENERATOR_SYSTEM,
      user: generatorUser(brief, JSON.stringify(plan), feedback),
      maxTokens: 8192,
      temperature: 0.5,
    });
    modelUsed = genRaw.model;
    const bundle = extractJson<{ files: Record<string, string>; entryFile: string }>(genRaw.text);
    files = bundle.files;
    entryFile = bundle.entryFile ?? 'index.html';

    await onStatus('VALIDATING');
    staticReport = validateHtmlBundle(files, entryFile);

    await onStatus('REVIEWING');
    const reviewRaw = await reviewCompletion({
      system: REVIEWER_SYSTEM,
      user: `Files:\n${serializeFiles(files)}`,
      maxTokens: 2048,
    });
    verdict = extractJson<ReviewerVerdict>(reviewRaw.text);

    const blockingIssues = [
      ...staticReport.htmlErrors,
      ...staticReport.contrastIssues,
      ...staticReport.layoutOverflows,
      ...(verdict.pass ? [] : verdict.issues),
    ];
    if (staticReport.htmlValid && verdict.pass) break;
    feedback = blockingIssues.map((i, n) => `${n + 1}. ${i}`).join('\n');
    logger.info('Regeneration needed', { projectId, attempt: attempts, issues: blockingIssues.length });
  }

  await onStatus('SEO_PASS');
  let seo: SeoMeta | null = null;
  try {
    const seoRaw = await reviewCompletion({
      system: SEO_SYSTEM,
      user: `Brief:\n${plannerUser(brief)}\n\nFinal HTML:\n${files[entryFile] ?? ''}`,
      maxTokens: 2048,
    });
    seo = extractJson<SeoMeta>(seoRaw.text);
    files['sitemap.xml'] = seo.sitemapXml;
  } catch (err) {
    logger.warn('SEO pass failed; continuing without it', { err: String(err) });
  }

  const assets = await materializeImageAssets(projectId, plan.imageAssets);
  if (options.watermark) {
    files[entryFile] = injectWatermark(files[entryFile] ?? '');
  }
  files[entryFile] = injectAnalyticsSnippet(files[entryFile] ?? '', options.analyticsKey);

  const report: ValidationReport = {
    ...staticReport,
    accessibilityScore: verdict.accessibilityScore,
    performanceScore: verdict.performanceScore,
    passed: staticReport.htmlValid && verdict.pass,
  };

  const result: GenerationResult = {
    bundle: { files, entryFile, assets, seo },
    report,
    attempts,
    modelUsed,
    reviewerNotes: verdict.issues,
  };
  return result;
}

/** Generate DALL·E images, compress with sharp, upload to S3/MinIO. Failures are non-fatal. */
async function materializeImageAssets(
  projectId: string,
  specs: Array<{ path: string; prompt: string }>,
): Promise<GeneratedAsset[]> {
  const assets: GeneratedAsset[] = [];
  for (const spec of specs.slice(0, 6)) {
    try {
      const remoteUrl = await generateImage(spec.prompt);
      const res = await fetch(remoteUrl);
      const original = Buffer.from(await res.arrayBuffer());
      // Compress: webp at quality 80 cuts DALL·E PNGs by ~90%.
      const compressed = await sharp(original).webp({ quality: 80 }).toBuffer();
      const key = `projects/${projectId}/${spec.path.replace(/\.[a-z]+$/i, '.webp')}`;
      const url = await uploadObject(key, compressed, 'image/webp');
      assets.push({ path: spec.path, prompt: spec.prompt, url, compressed: true });
    } catch (err) {
      logger.warn('Asset generation failed; using placeholder', { path: spec.path, err: String(err) });
      assets.push({
        path: spec.path,
        prompt: spec.prompt,
        url: `https://placehold.co/1024x768?text=${encodeURIComponent(spec.path)}`,
        compressed: false,
      });
    }
  }
  return assets;
}

function serializeFiles(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([path, content]) => `--- ${path} ---\n${content}`)
    .join('\n\n');
}

function injectWatermark(html: string): string {
  const badge = `<a href="https://frontendforge.pro" rel="noopener" style="position:fixed;bottom:12px;right:12px;background:#111;color:#fff;padding:6px 10px;border-radius:8px;font:12px sans-serif;z-index:9999;text-decoration:none">Built with FrontendForge</a>`;
  return html.replace('</body>', `${badge}</body>`);
}

function injectAnalyticsSnippet(html: string, analyticsKey: string): string {
  const snippet = `<script defer src="${env.API_URL}/api/v1/analytics/script.js" data-project="${analyticsKey}"></script>`;
  return html.replace('</head>', `${snippet}</head>`);
}
