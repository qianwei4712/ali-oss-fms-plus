import CryptoJS from 'crypto-js';

const SALT = 'oss-fms-client-salt'; // Fixed salt for client-side only encryption

/**
 * Encrypts a string using AES
 * @param text The text to encrypt
 * @param secret The secret key (user password or pin)
 * @returns Encrypted string
 */
export const encrypt = (text: string, secret: string = 'default'): string => {
  if (!text) return '';
  return CryptoJS.AES.encrypt(text, secret + SALT).toString();
};

/**
 * Decrypts a string using AES
 * @param ciphertext The encrypted text
 * @param secret The secret key
 * @returns Decrypted string
 */
export const decrypt = (ciphertext: string, secret: string = 'default'): string => {
  if (!ciphertext) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secret + SALT);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
};
