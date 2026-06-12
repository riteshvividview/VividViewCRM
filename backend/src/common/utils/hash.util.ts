import * as bcrypt from 'bcryptjs';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { BCRYPT_ROUNDS } from '../constants';

// ── Bcrypt ────────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── AES-256-GCM (for sensitive HR fields) ────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';

export function encryptField(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex.slice(0, 64), 'hex'); // 32 bytes
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

export function decryptField(ciphertext: string, keyHex: string): string {
  const [ivHex, encHex, tagHex] = ciphertext.split(':');
  const key = Buffer.from(keyHex.slice(0, 64), 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ── SHA-256 (for file integrity / token hashing) ──────────────────────────────

export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Mask sensitive strings — shows only last 4 characters */
export function maskSensitive(value: string | null | undefined): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}
