/**
 * Token Service - Secure Token Management
 *
 * Features:
 * - Refresh token generation with rotation
 * - Token family tracking for reuse detection
 * - Access token blacklisting
 * - Session management
 * - Device fingerprinting
 */

import crypto from 'crypto';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY_MINUTES: 15,        // Short-lived access tokens
  REFRESH_TOKEN_EXPIRY_DAYS: 7,           // Long-lived refresh tokens
  SESSION_EXPIRY_DAYS: 30,                // Session lifetime
  MAX_SESSIONS_PER_USER: 5,               // Concurrent session limit
  DEVICE_TRUST_DAYS: 30,                  // How long to trust a device
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: Date;
  refreshTokenExpires: Date;
  sessionId: string;
}

export interface RefreshTokenData {
  token: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionInfo {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  location?: {
    city?: string;
    country?: string;
  };
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Hash a token using SHA256
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a unique token family ID
 */
export function generateTokenFamilyId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a unique JWT ID (jti)
 */
export function generateJti(): string {
  return crypto.randomUUID();
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Parse user agent string to extract device info
 */
export function parseUserAgent(userAgent: string): Partial<DeviceInfo> {
  const ua = userAgent.toLowerCase();

  // Detect device type
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
    deviceType = /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile';
  }

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  // Generate device name
  const deviceName = `${browser} on ${os}`;

  return { deviceType, browser, os, deviceName };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REFRESH TOKEN MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a new refresh token
 */
export async function createRefreshToken(
  personId: string,
  deviceInfo: DeviceInfo,
  familyId?: string
): Promise<RefreshTokenData> {
  const token = generateSecureToken(32);
  const tokenHash = hashToken(token);
  const tokenFamilyId = familyId || generateTokenFamilyId();
  const expiresAt = new Date(
    Date.now() + TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  await db.execute(sql`
    INSERT INTO app.refresh_token (
      token_hash,
      token_family,
      person_id,
      device_id,
      device_name,
      ip_address,
      user_agent,
      expires_ts
    ) VALUES (
      ${tokenHash},
      ${tokenFamilyId}::uuid,
      ${personId}::uuid,
      ${deviceInfo.deviceId || null},
      ${deviceInfo.deviceName || null},
      ${deviceInfo.ipAddress || null},
      ${deviceInfo.userAgent || null},
      ${expiresAt.toISOString()}
    )
  `);

  return {
    token,
    tokenHash,
    familyId: tokenFamilyId,
    expiresAt,
  };
}

/**
 * Rotate a refresh token (exchange old for new)
 * Implements refresh token rotation with reuse detection
 */
export async function rotateRefreshToken(
  oldToken: string,
  deviceInfo: DeviceInfo
): Promise<{ newToken: RefreshTokenData; personId: string } | null> {
  const oldTokenHash = hashToken(oldToken);

  // Find the token
  const tokenResult = await db.execute(sql`
    SELECT id, token_family, person_id, used_flag, revoked_flag, expires_ts
    FROM app.refresh_token
    WHERE token_hash = ${oldTokenHash}
  `);

  if (tokenResult.length === 0) {
    return null; // Token not found
  }

  const tokenRecord = tokenResult[0];

  // Check if token is valid
  if (tokenRecord.revoked_flag) {
    return null; // Token was revoked
  }

  if (new Date(tokenRecord.expires_ts as string) < new Date()) {
    return null; // Token expired
  }

  // CRITICAL: Check for reuse attack
  if (tokenRecord.used_flag) {
    // This token was already used! Possible token theft.
    // Revoke entire token family
    await revokeTokenFamily(
      tokenRecord.token_family as string,
      'reuse_detected'
    );

    // Log security event
    await logSecurityEvent({
      eventType: 'token_reuse_detected',
      eventCategory: 'session',
      personId: tokenRecord.person_id as string,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      success: false,
      failureReason: 'Refresh token reuse detected - possible theft',
      riskScore: 90,
      riskFactors: ['token_reuse'],
    });

    return null;
  }

  // Mark old token as used
  await db.execute(sql`
    UPDATE app.refresh_token
    SET used_flag = true, used_ts = NOW()
    WHERE id = ${tokenRecord.id as string}::uuid
  `);

  // Create new token in same family
  const newToken = await createRefreshToken(
    tokenRecord.person_id as string,
    deviceInfo,
    tokenRecord.token_family as string
  );

  // Link old token to new token
  await db.execute(sql`
    UPDATE app.refresh_token
    SET replaced_by_id = (
      SELECT id FROM app.refresh_token WHERE token_hash = ${newToken.tokenHash}
    )
    WHERE id = ${tokenRecord.id as string}::uuid
  `);

  return {
    newToken,
    personId: tokenRecord.person_id as string,
  };
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(
  token: string,
  reason: string = 'logout'
): Promise<boolean> {
  const tokenHash = hashToken(token);

  const result = await db.execute(sql`
    UPDATE app.refresh_token
    SET revoked_flag = true, revoked_ts = NOW(), revoked_reason = ${reason}
    WHERE token_hash = ${tokenHash} AND revoked_flag = false
    RETURNING id
  `);

  return result.length > 0;
}

/**
 * Revoke all tokens in a token family
 */
export async function revokeTokenFamily(
  familyId: string,
  reason: string = 'security'
): Promise<number> {
  const result = await db.execute(sql`
    UPDATE app.refresh_token
    SET revoked_flag = true, revoked_ts = NOW(), revoked_reason = ${reason}
    WHERE token_family = ${familyId}::uuid AND revoked_flag = false
    RETURNING id
  `);

  return result.length;
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserRefreshTokens(
  personId: string,
  reason: string = 'logout_all'
): Promise<number> {
  const result = await db.execute(sql`
    UPDATE app.refresh_token
    SET revoked_flag = true, revoked_ts = NOW(), revoked_reason = ${reason}
    WHERE person_id = ${personId}::uuid AND revoked_flag = false
    RETURNING id
  `);

  return result.length;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCESS TOKEN BLACKLISTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Blacklist an access token (for immediate revocation)
 */
export async function blacklistAccessToken(
  jti: string,
  personId: string,
  expiresAt: Date,
  reason: string = 'logout'
): Promise<void> {
  await db.execute(sql`
    INSERT INTO app.token_blacklist (jti, person_id, expires_ts, reason)
    VALUES (${jti}, ${personId}::uuid, ${expiresAt.toISOString()}, ${reason})
    ON CONFLICT (jti) DO NOTHING
  `);
}

/**
 * Check if an access token is blacklisted
 */
export async function isAccessTokenBlacklisted(jti: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM app.token_blacklist
    WHERE jti = ${jti} AND expires_ts > NOW()
    LIMIT 1
  `);

  return result.length > 0;
}

/**
 * Blacklist all access tokens for a user
 * Note: This requires knowing all JTIs, so we track sessions instead
 */
export async function blacklistAllUserTokens(
  personId: string,
  reason: string = 'logout_all'
): Promise<void> {
  // Since we can't know all JTIs, we'll terminate all sessions
  // The session check will fail for tokens with terminated sessions
  await terminateAllSessions(personId, reason);
  await revokeAllUserRefreshTokens(personId, reason);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SESSION MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a new session
 */
export async function createSession(
  personId: string,
  deviceInfo: DeviceInfo,
  riskScore: number = 0
): Promise<string> {
  const sessionId = generateSessionId();
  const sessionTokenHash = hashToken(sessionId);
  const expiresAt = new Date(
    Date.now() + TOKEN_CONFIG.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  const parsedDevice = parseUserAgent(deviceInfo.userAgent || '');

  // Check session limit and remove oldest if exceeded
  const sessionCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM app.user_session
    WHERE person_id = ${personId}::uuid AND active_flag = true
  `);

  if ((sessionCount[0].count as number) >= TOKEN_CONFIG.MAX_SESSIONS_PER_USER) {
    // Terminate oldest session
    await db.execute(sql`
      UPDATE app.user_session
      SET active_flag = false, terminated_ts = NOW(), terminated_reason = 'new_session_limit'
      WHERE id = (
        SELECT id FROM app.user_session
        WHERE person_id = ${personId}::uuid AND active_flag = true
        ORDER BY last_active_ts ASC
        LIMIT 1
      )
    `);
  }

  await db.execute(sql`
    INSERT INTO app.user_session (
      id,
      person_id,
      session_token_hash,
      device_id,
      device_name,
      device_type,
      browser,
      os,
      ip_address,
      expires_ts,
      risk_score
    ) VALUES (
      ${sessionId}::uuid,
      ${personId}::uuid,
      ${sessionTokenHash},
      ${deviceInfo.deviceId || null},
      ${parsedDevice.deviceName || deviceInfo.deviceName || null},
      ${parsedDevice.deviceType || deviceInfo.deviceType || null},
      ${parsedDevice.browser || deviceInfo.browser || null},
      ${parsedDevice.os || deviceInfo.os || null},
      ${deviceInfo.ipAddress || null},
      ${expiresAt.toISOString()},
      ${riskScore}
    )
  `);

  return sessionId;
}

/**
 * Update session last active time
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  await db.execute(sql`
    UPDATE app.user_session
    SET last_active_ts = NOW()
    WHERE id = ${sessionId}::uuid AND active_flag = true
  `);
}

/**
 * Validate a session
 */
export async function validateSession(sessionId: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT person_id FROM app.user_session
    WHERE id = ${sessionId}::uuid
      AND active_flag = true
      AND expires_ts > NOW()
  `);

  if (result.length === 0) {
    return null;
  }

  // Update last active
  await updateSessionActivity(sessionId);

  return result[0].person_id as string;
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(
  personId: string,
  currentSessionId?: string
): Promise<SessionInfo[]> {
  const result = await db.execute(sql`
    SELECT
      id,
      device_id,
      device_name,
      device_type,
      browser,
      os,
      ip_address,
      location_city,
      location_country,
      created_ts,
      last_active_ts
    FROM app.user_session
    WHERE person_id = ${personId}::uuid AND active_flag = true
    ORDER BY last_active_ts DESC
  `);

  return result.map((row) => ({
    id: row.id as string,
    deviceId: row.device_id as string || 'unknown',
    deviceName: row.device_name as string || 'Unknown Device',
    deviceType: row.device_type as string || 'unknown',
    browser: row.browser as string || 'Unknown',
    os: row.os as string || 'Unknown',
    ipAddress: row.ip_address as string || 'unknown',
    location: row.location_city || row.location_country
      ? {
          city: row.location_city as string,
          country: row.location_country as string,
        }
      : undefined,
    createdAt: (row.created_ts as Date).toISOString(),
    lastActiveAt: (row.last_active_ts as Date).toISOString(),
    isCurrent: row.id === currentSessionId,
  }));
}

/**
 * Terminate a specific session
 */
export async function terminateSession(
  sessionId: string,
  reason: string = 'logout'
): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE app.user_session
    SET active_flag = false, terminated_ts = NOW(), terminated_reason = ${reason}
    WHERE id = ${sessionId}::uuid AND active_flag = true
    RETURNING id
  `);

  return result.length > 0;
}

/**
 * Terminate all sessions for a user
 */
export async function terminateAllSessions(
  personId: string,
  reason: string = 'logout_all'
): Promise<number> {
  const result = await db.execute(sql`
    UPDATE app.user_session
    SET active_flag = false, terminated_ts = NOW(), terminated_reason = ${reason}
    WHERE person_id = ${personId}::uuid AND active_flag = true
    RETURNING id
  `);

  return result.length;
}

/**
 * Terminate all sessions except current
 */
export async function terminateOtherSessions(
  personId: string,
  currentSessionId: string,
  reason: string = 'logout_others'
): Promise<number> {
  const result = await db.execute(sql`
    UPDATE app.user_session
    SET active_flag = false, terminated_ts = NOW(), terminated_reason = ${reason}
    WHERE person_id = ${personId}::uuid
      AND active_flag = true
      AND id != ${currentSessionId}::uuid
    RETURNING id
  `);

  return result.length;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEVICE MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a device fingerprint from available info
 */
export function generateDeviceFingerprint(
  userAgent: string,
  ipAddress: string,
  additionalData?: Record<string, string>
): string {
  const data = `${userAgent}|${ipAddress}|${JSON.stringify(additionalData || {})}`;
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Register or update a known device
 */
export async function registerDevice(
  personId: string,
  deviceInfo: DeviceInfo
): Promise<void> {
  const parsedDevice = parseUserAgent(deviceInfo.userAgent || '');

  await db.execute(sql`
    INSERT INTO app.known_device (
      person_id,
      device_id,
      device_name,
      device_type,
      browser,
      os
    ) VALUES (
      ${personId}::uuid,
      ${deviceInfo.deviceId},
      ${parsedDevice.deviceName || deviceInfo.deviceName || null},
      ${parsedDevice.deviceType || deviceInfo.deviceType || null},
      ${parsedDevice.browser || deviceInfo.browser || null},
      ${parsedDevice.os || deviceInfo.os || null}
    )
    ON CONFLICT (person_id, device_id) DO UPDATE SET
      last_seen_ts = NOW(),
      login_count = app.known_device.login_count + 1
  `);
}

/**
 * Check if a device is known for a user
 */
export async function isKnownDevice(
  personId: string,
  deviceId: string
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM app.known_device
    WHERE person_id = ${personId}::uuid
      AND device_id = ${deviceId}
      AND active_flag = true
    LIMIT 1
  `);

  return result.length > 0;
}

/**
 * Check if a device is trusted (can skip MFA)
 */
export async function isDeviceTrusted(
  personId: string,
  deviceId: string
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM app.known_device
    WHERE person_id = ${personId}::uuid
      AND device_id = ${deviceId}
      AND trusted_flag = true
      AND (trust_expires_ts IS NULL OR trust_expires_ts > NOW())
      AND active_flag = true
      AND blocked_flag = false
    LIMIT 1
  `);

  return result.length > 0;
}

/**
 * Trust a device (skip MFA for this device)
 */
export async function trustDevice(
  personId: string,
  deviceId: string
): Promise<void> {
  const trustExpires = new Date(
    Date.now() + TOKEN_CONFIG.DEVICE_TRUST_DAYS * 24 * 60 * 60 * 1000
  );

  await db.execute(sql`
    UPDATE app.known_device
    SET trusted_flag = true, trust_expires_ts = ${trustExpires.toISOString()}
    WHERE person_id = ${personId}::uuid AND device_id = ${deviceId}
  `);
}

/**
 * Untrust all devices for a user (e.g., after password change)
 */
export async function untrustAllDevices(personId: string): Promise<void> {
  await db.execute(sql`
    UPDATE app.known_device
    SET trusted_flag = false, trust_expires_ts = NULL
    WHERE person_id = ${personId}::uuid
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECURITY AUDIT LOGGING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface SecurityEventParams {
  eventType: string;
  eventCategory: 'authentication' | 'authorization' | 'account' | 'session';
  personId?: string;
  email?: string;
  eventDetail?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  geoCountry?: string;
  geoCity?: string;
  riskScore?: number;
  riskFactors?: string[];
  success: boolean;
  failureReason?: string;
}

/**
 * Log a security event
 */
export async function logSecurityEvent(
  params: SecurityEventParams
): Promise<void> {
  await db.execute(sql`
    INSERT INTO app.security_audit (
      event_type,
      event_category,
      person_id,
      email,
      event_detail,
      ip_address,
      user_agent,
      device_id,
      geo_country,
      geo_city,
      risk_score,
      risk_factors,
      success_flag,
      failure_reason
    ) VALUES (
      ${params.eventType},
      ${params.eventCategory},
      ${params.personId ? sql`${params.personId}::uuid` : sql`NULL`},
      ${params.email || null},
      ${JSON.stringify(params.eventDetail || {})}::jsonb,
      ${params.ipAddress || null},
      ${params.userAgent || null},
      ${params.deviceId || null},
      ${params.geoCountry || null},
      ${params.geoCity || null},
      ${params.riskScore || null},
      ${JSON.stringify(params.riskFactors || [])}::jsonb,
      ${params.success},
      ${params.failureReason || null}
    )
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const tokenService = {
  // Token generation
  generateSecureToken,
  hashToken,
  generateJti,
  generateSessionId,
  generateDeviceFingerprint,

  // Refresh tokens
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeTokenFamily,
  revokeAllUserRefreshTokens,

  // Access token blacklist
  blacklistAccessToken,
  isAccessTokenBlacklisted,
  blacklistAllUserTokens,

  // Sessions
  createSession,
  validateSession,
  getUserSessions,
  terminateSession,
  terminateAllSessions,
  terminateOtherSessions,

  // Devices
  registerDevice,
  isKnownDevice,
  isDeviceTrusted,
  trustDevice,
  untrustAllDevices,

  // Audit
  logSecurityEvent,

  // Config
  TOKEN_CONFIG,
};

export default tokenService;
