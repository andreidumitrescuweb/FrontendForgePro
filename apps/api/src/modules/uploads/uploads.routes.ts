import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import sharp from 'sharp';
import { uploadImageSchema } from '@forge/shared';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadObject } from '../../lib/s3';
import { badRequest } from '../../lib/errors';
import { logger } from '../../lib/logger';

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

/**
 * Accepts a base64 image data URL, normalizes it to a reasonably-sized WebP and
 * stores it in object storage. Used for reference/brand images in the brief.
 */
uploadsRouter.post('/image', validate(uploadImageSchema), async (req, res, next) => {
  try {
    const base64 = (req.body.dataUrl as string).split(',')[1] ?? '';
    const input = Buffer.from(base64, 'base64');
    if (input.length === 0) throw badRequest('Empty image');
    if (input.length > 10 * 1024 * 1024) throw badRequest('Image too large (max 10MB)');

    const webp = await sharp(input)
      .rotate() // respect EXIF orientation
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const key = `uploads/${req.auth!.userId}/${randomUUID()}.webp`;
    const url = await uploadObject(key, webp, 'image/webp');
    res.status(201).json({ url });
  } catch (err) {
    logger.warn('Image upload failed', { err: String(err) });
    next(err);
  }
});
