import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
}

const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

async function completeAnthropic(req: CompletionRequest, model: string): Promise<CompletionResult> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY not configured');
  const msg = await anthropic.messages.create({
    model,
    max_tokens: req.maxTokens ?? 8192,
    temperature: req.temperature ?? 0.7,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return { text, model };
}

async function completeOpenAI(req: CompletionRequest, model: string): Promise<CompletionResult> {
  if (!openai) throw new Error('OPENAI_API_KEY not configured');
  const completion = await openai.chat.completions.create({
    model,
    max_tokens: req.maxTokens ?? 8192,
    temperature: req.temperature ?? 0.7,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
  });
  return { text: completion.choices[0]?.message?.content ?? '', model };
}

/**
 * Primary generator: Anthropic; automatic fallback to OpenAI when the
 * primary fails or is not configured.
 */
export async function generateCompletion(req: CompletionRequest): Promise<CompletionResult> {
  if (anthropic) {
    try {
      return await completeAnthropic(req, env.AI_PRIMARY_MODEL);
    } catch (err) {
      logger.warn('Primary model failed, falling back', { err: String(err) });
    }
  }
  if (openai) return completeOpenAI(req, env.AI_FALLBACK_MODEL);
  throw new Error('No AI provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)');
}

/** Cheap reviewer model (Haiku) for a11y / performance / SEO critique. */
export async function reviewCompletion(req: CompletionRequest): Promise<CompletionResult> {
  if (anthropic) return completeAnthropic({ ...req, temperature: 0.2 }, env.AI_REVIEWER_MODEL);
  if (openai) return completeOpenAI({ ...req, temperature: 0.2 }, env.AI_FALLBACK_MODEL);
  throw new Error('No AI provider configured');
}

/** DALL·E 3 image generation; returns the remote image URL. */
export async function generateImage(prompt: string, size: '1024x1024' | '1792x1024' = '1024x1024'): Promise<string> {
  if (!openai) throw new Error('OPENAI_API_KEY required for image generation');
  const result = await openai.images.generate({
    model: env.AI_IMAGE_MODEL,
    prompt,
    n: 1,
    size,
    quality: 'standard',
  });
  const url = result.data?.[0]?.url;
  if (!url) throw new Error('Image generation returned no URL');
  return url;
}
