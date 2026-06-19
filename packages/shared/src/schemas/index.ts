import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a digit');

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema,
  name: z.string().min(2).max(80),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().regex(/^\d{6}$/).optional(),
});

export const totpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(60),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
});

export const projectBriefSchema = z.object({
  projectType: z.enum(['LANDING_PAGE', 'ECOMMERCE', 'DASHBOARD', 'BLOG', 'PORTFOLIO', 'OTHER']),
  description: z.string().min(20).max(8000),
  targetAudience: z.string().min(3).max(500),
  brandTone: z.string().min(3).max(300),
  colorPalette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(8).optional(),
  framework: z.enum(['VANILLA', 'REACT']).default('VANILLA'),
  languages: z.array(z.string().min(2).max(8)).max(10).optional(),
  // Existing/inspiration sites the AI should read for content & style cues.
  referenceUrls: z.array(z.string().url()).max(5).optional(),
  // User-uploaded images (S3 URLs) the AI should place into the site.
  referenceImages: z.array(z.string().url()).max(10).optional(),
});

export const uploadImageSchema = z.object({
  dataUrl: z.string().regex(/^data:image\/(png|jpe?g|webp|gif|avif);base64,/, 'Must be an image data URL'),
});

export const createProjectSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z.string().min(2).max(100),
  brief: projectBriefSchema,
});

export const aiEditSchema = z.object({
  instruction: z.string().min(3).max(4000),
  selection: z
    .object({ filePath: z.string(), startLine: z.number().int().min(1), endLine: z.number().int().min(1) })
    .optional(),
});

export const createVersionSchema = z.object({
  label: z.string().max(120).optional(),
  files: z.record(z.string(), z.string()),
  branchName: z.string().max(60).optional(),
  parentVersionId: z.string().cuid().optional(),
});

export const createListingSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().min(5).max(120),
  description: z.string().min(20).max(5000),
  priceCents: z.number().int().min(0).max(1_000_000),
  license: z.enum(['PERSONAL', 'COMMERCIAL', 'EXTENDED']),
  category: z.string().min(2).max(60),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export const deploySchema = z.object({
  provider: z.enum(['VERCEL', 'NETLIFY', 'CLOUDFLARE_PAGES', 'GITHUB_PAGES']),
});

export const analyticsEventSchema = z.object({
  projectKey: z.string().min(8).max(64),
  type: z.enum(['pageview', 'event']),
  path: z.string().max(2048),
  referrer: z.string().max(2048).optional(),
  name: z.string().max(120).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type AiEditInput = z.infer<typeof aiEditSchema>;
