import CryptoJS from 'crypto-js';
import { config } from '../config';

export class Encryption {
  private static key = config.encryptionKey;

  static encrypt(text: string): string {
    if (!text) return '';
    return CryptoJS.AES.encrypt(text, this.key).toString();
  }

  static decrypt(encryptedText: string): string {
    if (!encryptedText) return '';
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  static hash(text: string): string {
    return CryptoJS.SHA256(text).toString();
  }
}
