import { decryptFromString, decryptSecret, encryptSecret, encryptToString, sha256 } from '../src/lib/crypto';

describe('crypto', () => {
  it('round-trips AES-256-GCM payloads', () => {
    const secret = 'sk-ant-very-secret-key-123';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('round-trips compact string form', () => {
    const value = 'JBSWY3DPEHPK3PXP'; // TOTP-like secret
    expect(decryptFromString(encryptToString(value))).toBe(value);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    expect(encryptToString('x')).not.toBe(encryptToString('x'));
  });

  it('rejects tampered ciphertext', () => {
    const enc = encryptSecret('payload');
    const tampered = { ...enc, ciphertext: Buffer.from('tampered!').toString('base64') };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('hashes deterministically', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).toHaveLength(64);
  });
});
