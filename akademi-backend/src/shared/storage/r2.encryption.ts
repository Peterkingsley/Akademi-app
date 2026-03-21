import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypts a buffer using AES-256-CBC.
 * @param data The buffer to encrypt.
 * @param key A 32-byte student-specific key.
 * @returns A buffer containing the IV followed by the encrypted data.
 */
export function encrypt(data: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes long.');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

  return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypts a buffer using AES-256-CBC.
 * @param encryptedData The buffer containing the IV and encrypted data.
 * @param key A 32-byte student-specific key.
 * @returns The decrypted buffer.
 */
export function decrypt(encryptedData: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes long.');
  }

  const iv = encryptedData.subarray(0, IV_LENGTH);
  const data = encryptedData.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

  return decrypted;
}
