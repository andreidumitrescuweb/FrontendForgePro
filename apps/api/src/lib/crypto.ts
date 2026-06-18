import crypto from 'node:crypto';
import { env } from '../config/env';

const KEY = Buffer.from(env.SECRETS_ENCRYPTION_KEY, 'hex');

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/** AES-256-GCM encryption for secrets at rest (API keys, TOTP seeds). */
export function encryptSecret(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSecret(payload: EncryptedPayload): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

/** Compact single-string form for columns that store one value. */
export function encryptToString(plaintext: string): string {
  const p = encryptSecret(plaintext);
  return `${p.iv}.${p.authTag}.${p.ciphertext}`;
}

export function decryptFromString(value: string): string {
  const [iv, authTag, ciphertext] = value.split('.');
  if (!iv || !authTag || !ciphertext) throw new Error('Malformed encrypted value');
  return decryptSecret({ iv, authTag, ciphertext });
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}
