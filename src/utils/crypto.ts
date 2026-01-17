import crypto from 'crypto';
import { createHmac } from 'crypto';
import bcrypt from 'bcrypt';
import { config } from '../config';

/**
 * Cryptographic utilities
 */

/**
 * Generate a random API key
 */
export function generateApiKey(prefix: string = 'sk_live'): string {
  const randomBytes = crypto.randomBytes(32);
  return `${prefix}_${randomBytes.toString('hex')}`;
}

/**
 * Generate a random webhook secret
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate HMAC signature for webhook payloads
 */
export function generateHmacSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateHmacSignature(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(data: string, key: string): { encrypted: string; iv: string; tag: string } {
  const keyBuffer = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encrypted: string, key: string, iv: string, tag: string): string {
  const keyBuffer = Buffer.from(key, 'hex');
  const ivBuffer = Buffer.from(iv, 'hex');
  const tagBuffer = Buffer.from(tag, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Hash data using SHA-256
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a UUID v4
 */
export function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * Constant-time string comparison
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Generate a correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Hash a password using bcrypt
 * Uses salt rounds from configuration
 */
export async function hashPassword(password: string, saltRounds?: number): Promise<string> {
  const rounds = saltRounds || config.apiKeySaltRounds;
  return await bcrypt.hash(password, rounds);
}

/**
 * Compare a plain text password with a bcrypt hash
 * Returns true if password matches the hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
