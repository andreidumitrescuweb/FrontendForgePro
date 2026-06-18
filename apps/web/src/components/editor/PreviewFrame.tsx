'use client';

import { useMemo } from 'react';

interface Props {
  files: Record<string, string>;
  entryFile: string;
  assets: Array<{ path: string; url: string }>;
}

/**
 * Isolated preview sandbox. Scripts are allowed so generated interactivity
 * works; the iframe is same-origin-sandboxed and gets only the generated code.
 */
export function PreviewFrame({ files, entryFile, assets }: Props) {
  const srcDoc = useMemo(() => {
    let html = files[entryFile] ?? '<p style="font-family:sans-serif;padding:2rem">Generate the project to see a preview.</p>';

    // Point generated asset references at their CDN/S3 URLs.
    for (const asset of assets) {
      html = html.split(asset.path).join(asset.url);
    }
    // Inline locally-referenced css/js files so the sandbox is self-contained.
    for (const [path, content] of Object.entries(files)) {
      if (path === entryFile) continue;
      if (path.endsWith('.css')) {
        html = html.replace(
          new RegExp(`<link[^>]*href=["']\\.?/?${escapeRegExp(path)}["'][^>]*>`, 'i'),
          `<style>${content}</style>`,
        );
      } else if (path.endsWith('.js')) {
        html = html.replace(
          new RegExp(`<script[^>]*src=["']\\.?/?${escapeRegExp(path)}["'][^>]*></script>`, 'i'),
          `<script>${content}</script>`,
        );
      }
    }
    return html;
  }, [files, entryFile, assets]);

  return (
    <iframe
      title="Project preview"
      sandbox="allow-scripts allow-same-origin"
      srcDoc={srcDoc}
      className="h-full w-full border-0 bg-white"
    />
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
