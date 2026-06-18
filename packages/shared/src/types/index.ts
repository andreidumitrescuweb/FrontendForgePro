export type UserRole = 'USER' | 'ADMIN' | 'SUPERADMIN';
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export type ProjectType =
  | 'LANDING_PAGE'
  | 'ECOMMERCE'
  | 'DASHBOARD'
  | 'BLOG'
  | 'PORTFOLIO'
  | 'OTHER';

export type OutputFramework = 'VANILLA' | 'REACT';

export type GenerationStatus =
  | 'QUEUED'
  | 'PLANNING'
  | 'GENERATING'
  | 'VALIDATING'
  | 'REVIEWING'
  | 'SEO_PASS'
  | 'COMPLETED'
  | 'FAILED';

export type DeploymentProvider = 'VERCEL' | 'NETLIFY' | 'CLOUDFLARE_PAGES' | 'GITHUB_PAGES';
export type DeploymentStatus = 'PENDING' | 'BUILDING' | 'READY' | 'ERROR';

export type ListingStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type ListingLicense = 'PERSONAL' | 'COMMERCIAL' | 'EXTENDED';

/** The brief the user provides; the planner AI consumes this. */
export interface ProjectBrief {
  projectType: ProjectType;
  description: string;
  targetAudience: string;
  brandTone: string;
  colorPalette?: string[]; // hex values; omitted => AI generates one
  framework: OutputFramework;
  languages?: string[]; // ISO codes; first is primary, RTL handled automatically
}

/** Files produced by a generation, keyed by relative path. */
export interface GeneratedBundle {
  files: Record<string, string>;
  entryFile: string; // usually index.html
  assets: GeneratedAsset[];
  seo: SeoMeta | null;
}

export interface GeneratedAsset {
  path: string;
  prompt: string;
  url: string; // CDN/S3 url after upload
  compressed: boolean;
}

export interface SeoMeta {
  title: string;
  description: string;
  openGraph: Record<string, string>;
  schemaOrgJsonLd: string;
  sitemapXml: string;
}

export interface ValidationReport {
  htmlValid: boolean;
  htmlErrors: string[];
  contrastIssues: string[];
  accessibilityScore: number; // 0-100
  performanceScore: number; // 0-100
  layoutOverflows: string[];
  passed: boolean;
}

export interface GenerationResult {
  bundle: GeneratedBundle;
  report: ValidationReport;
  attempts: number;
  modelUsed: string;
  reviewerNotes: string[];
}

export interface PresenceUser {
  userId: string;
  name: string;
  color: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
