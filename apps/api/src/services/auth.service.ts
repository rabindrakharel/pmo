/**
 * Auth Service - Next-Generation Authentication
 *
 * Features:
 * - TOTP MFA generation and verification
 * - Backup codes generation
 * - Security questions hashing
 * - Password policy enforcement
 * - Email verification tokens
 * - Session management
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';

// TOTP Configuration
const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'sha1';

/**
 * Base32 encoding/decoding for TOTP secrets
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return result;
}

export function base32Decode(encoded: string): Buffer {
  const cleanEncoded = encoded.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleanEncoded) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a cryptographically secure TOTP secret
 */
export function generateTOTPSecret(): string {
  const buffer = crypto.randomBytes(20); // 160 bits
  return base32Encode(buffer);
}

/**
 * Generate TOTP code for a given secret and time
 */
export function generateTOTP(secret: string, time?: number): string {
  const currentTime = time ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(currentTime / TOTP_PERIOD);

  // Convert counter to 8-byte buffer (big-endian)
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  // Decode secret
  const secretBuffer = base32Decode(secret);

  // Generate HMAC
  const hmac = crypto.createHmac(TOTP_ALGORITHM, secretBuffer);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify TOTP code with time window tolerance
 */
export function verifyTOTP(secret: string, code: string, window: number = 1): boolean {
  const currentTime = Math.floor(Date.now() / 1000);

  // Check current period and adjacent periods
  for (let i = -window; i <= window; i++) {
    const checkTime = currentTime + i * TOTP_PERIOD;
    const expectedCode = generateTOTP(secret, checkTime);
    if (code === expectedCode) {
      return true;
    }
  }

  return false;
}

/**
 * Generate TOTP URI for QR code
 */
export function generateTOTPUri(
  secret: string,
  email: string,
  issuer: string = 'PMO Platform'
): string {
  const encodedEmail = encodeURIComponent(email);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate backup codes for MFA recovery
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

/**
 * Hash backup codes for storage
 */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
}

/**
 * Verify a backup code against stored hashes
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; index: number }> {
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(code, hashedCodes[i])) {
      return { valid: true, index: i };
    }
  }
  return { valid: false, index: -1 };
}

/**
 * Hash security question answer
 */
export async function hashSecurityAnswer(answer: string): Promise<string> {
  // Normalize answer (lowercase, trim)
  const normalized = answer.toLowerCase().trim();
  return bcrypt.hash(normalized, 10);
}

/**
 * Verify security question answer
 */
export async function verifySecurityAnswer(
  answer: string,
  hashedAnswer: string
): Promise<boolean> {
  const normalized = answer.toLowerCase().trim();
  return bcrypt.compare(normalized, hashedAnswer);
}

/**
 * Generate secure verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate password reset token with expiry
 */
export function generatePasswordResetToken(): {
  token: string;
  expiresAt: Date;
} {
  return {
    token: crypto.randomBytes(32).toString('hex'),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  };
}

/**
 * Generate email verification code (6 digits)
 */
export function generateEmailVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generate phone verification code (6 digits)
 */
export function generatePhoneVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate device ID for trusted device tracking
 */
export function generateDeviceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Password policy validation
 */
export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const errors: string[] = [];
  let score = 0;

  // Minimum length (8 characters)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  // Maximum length (128 characters)
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  // Contains uppercase
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  // Contains lowercase
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  // Contains number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Contains special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  // Determine strength
  let strength: 'weak' | 'fair' | 'good' | 'strong';
  if (score <= 2) {
    strength = 'weak';
  } else if (score <= 3) {
    strength = 'fair';
  } else if (score <= 4) {
    strength = 'good';
  } else {
    strength = 'strong';
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Check if password was previously used
 */
export async function isPasswordPreviouslyUsed(
  password: string,
  passwordHistory: string[]
): Promise<boolean> {
  for (const oldHash of passwordHistory) {
    if (await bcrypt.compare(password, oldHash)) {
      return true;
    }
  }
  return false;
}

/**
 * Predefined security questions
 */
export const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What city were you born in?',
  'What is your mother\'s maiden name?',
  'What was the name of your elementary school?',
  'What is your favorite movie?',
  'What was the make of your first car?',
  'What is the name of the street you grew up on?',
  'What was your childhood nickname?',
  'What is your oldest sibling\'s middle name?',
  'What was the first concert you attended?',
];

/**
 * SSO Provider configurations
 */
export interface SSOProviderConfig {
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
}

export const SSO_PROVIDERS: Record<string, Partial<SSOProviderConfig>> = {
  google: {
    name: 'Google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'email profile',
  },
  microsoft: {
    name: 'Microsoft',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: 'openid email profile',
  },
};

/**
 * Generate login history entry
 */
export interface LoginHistoryEntry {
  ts: string;
  ip: string;
  device: string;
  location?: {
    city?: string;
    country?: string;
  };
  success: boolean;
  method: 'password' | 'mfa' | 'sso' | 'passkey';
}

export function createLoginHistoryEntry(
  ip: string,
  device: string,
  success: boolean,
  method: 'password' | 'mfa' | 'sso' | 'passkey' = 'password'
): LoginHistoryEntry {
  return {
    ts: new Date().toISOString(),
    ip,
    device,
    success,
    method,
  };
}

/**
 * Export all auth utilities
 */
export const authService = {
  // TOTP
  generateTOTPSecret,
  generateTOTP,
  verifyTOTP,
  generateTOTPUri,

  // Backup codes
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,

  // Security questions
  hashSecurityAnswer,
  verifySecurityAnswer,
  SECURITY_QUESTIONS,

  // Tokens
  generateVerificationToken,
  generatePasswordResetToken,
  generateEmailVerificationCode,
  generatePhoneVerificationCode,
  generateSessionId,
  generateDeviceId,

  // Password policy
  validatePasswordPolicy,
  isPasswordPreviouslyUsed,

  // Login history
  createLoginHistoryEntry,

  // SSO
  SSO_PROVIDERS,
};

export default authService;
