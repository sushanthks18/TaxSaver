import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

class EncryptionService {
  private algorithm = 'aes-256-cbc';
  private key: Buffer;
  private iv: Buffer;

  constructor() {
    const encryptionKey = config.encryptionKey || 'default-key-change-in-production';
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
    this.iv = Buffer.alloc(16, 0);
  }

  /**
   * Encrypt sensitive data (PAN, API keys, etc.)
   */
  encrypt(text: string): string {
    try {
      const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error: any) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText: string): string {
    try {
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error: any) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash password using bcrypt (handled by auth service)
   */
  hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate PAN number format
   */
  validatePAN(pan: string): boolean {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    return panRegex.test(pan);
  }

  /**
   * Mask sensitive data for logs
   */
  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars) return '***';
    return data.slice(0, visibleChars) + '*'.repeat(data.length - visibleChars);
  }
}

export default new EncryptionService();
