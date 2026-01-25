/**
 * Encryption Utility
 *
 * Provides secure encryption/decryption for sensitive data like API secrets.
 * Uses AES-256-GCM for authenticated encryption.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment variable.
 * Key should be 32 bytes (256 bits) for AES-256.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // If key is base64 encoded, decode it
  if (key.length === 44 && key.endsWith('=')) {
    return Buffer.from(key, 'base64');
  }

  // If key is hex encoded (64 chars for 32 bytes)
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }

  // Otherwise use raw string (will be hashed to 32 bytes)
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a string value.
 * Returns base64 encoded string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Combine IV + Auth Tag + Ciphertext
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);

  return combined.toString('base64');
}

/**
 * Decrypt a string value.
 * Expects base64 encoded string: iv + authTag + ciphertext
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract IV, Auth Tag, and Ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Generate a new encryption key (32 bytes for AES-256).
 * Returns base64 encoded key.
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}
