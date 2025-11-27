// ============================================================================
// PubSub Service - JWT Authentication
// ============================================================================

import jwt from 'jsonwebtoken';
import type { JwtPayload } from './types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Verify a JWT token and return the decoded payload
 * @returns Decoded payload or null if invalid
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    console.warn('[Auth] JWT verification failed:', (error as Error).message);
    return null;
  }
}

/**
 * Decode a JWT without verification (for debugging)
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expiring within the given seconds
 */
export function isTokenExpiringSoon(tokenExp: number, withinSeconds = 300): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return tokenExp - nowSeconds <= withinSeconds;
}

/**
 * Get seconds until token expiration
 */
export function getSecondsUntilExpiry(tokenExp: number): number {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(0, tokenExp - nowSeconds);
}
