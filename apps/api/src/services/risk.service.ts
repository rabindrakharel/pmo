/**
 * Risk Assessment Service
 *
 * Implements:
 * - Device fingerprinting and trust scoring
 * - Login risk assessment
 * - Impossible travel detection
 * - Behavioral anomaly detection
 * - Adaptive MFA triggers
 */

import crypto from 'crypto';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const RISK_CONFIG = {
  // Thresholds for MFA decisions
  ALLOW_WITHOUT_MFA: 30,      // Risk score below this: skip MFA
  REQUIRE_MFA: 70,            // Risk score above this: always require MFA
  BLOCK_THRESHOLD: 90,        // Risk score above this: block and notify

  // Risk weights
  WEIGHTS: {
    NEW_DEVICE: 25,
    NEW_IP: 15,
    NEW_COUNTRY: 30,
    VPN_DETECTED: 20,
    TOR_DETECTED: 40,
    IMPOSSIBLE_TRAVEL: 50,
    UNUSUAL_TIME: 15,
    FAILED_ATTEMPTS_RECENT: 20,
    SUSPICIOUS_USER_AGENT: 25,
    BROWSER_MISMATCH: 15,
  },

  // Time windows
  IMPOSSIBLE_TRAVEL_HOURS: 2,  // Max hours for impossible travel check
  MAX_TRAVEL_SPEED_KMH: 1000,  // Realistic max travel speed
  UNUSUAL_TIME_WINDOW_HOURS: 2, // Hours deviation from normal login time
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface LoginContext {
  personId?: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  timestamp?: Date;
}

export interface GeoLocation {
  ip: string;
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  isVpn?: boolean;
  isTor?: boolean;
  isProxy?: boolean;
}

export interface RiskAssessment {
  score: number;                // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendation: 'allow' | 'mfa' | 'block';
  requiresMfa: boolean;
  shouldBlock: boolean;
  deviceTrusted: boolean;
  isNewDevice: boolean;
  location?: GeoLocation;
}

export interface RiskFactor {
  name: string;
  weight: number;
  description: string;
  severity: 'info' | 'warning' | 'danger';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEVICE FINGERPRINTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a device fingerprint from request context
 */
export function generateDeviceFingerprint(context: LoginContext): string {
  // Combine stable device characteristics
  const components = [
    context.userAgent,
    // In production, add more stable fingerprint data from client:
    // - Screen resolution
    // - Timezone
    // - Language
    // - Installed plugins
    // - Canvas fingerprint
    // - WebGL renderer
  ].join('|');

  return crypto.createHash('sha256').update(components).digest('hex').slice(0, 16);
}

/**
 * Parse user agent for device analysis
 */
export function parseUserAgentForRisk(userAgent: string): {
  browser: string;
  os: string;
  isMobile: boolean;
  isBot: boolean;
  isSuspicious: boolean;
} {
  const ua = userAgent.toLowerCase();

  // Detect bots and automation
  const botPatterns = [
    'bot', 'crawler', 'spider', 'headless', 'phantom', 'selenium',
    'puppeteer', 'playwright', 'webdriver', 'chrome-lighthouse'
  ];
  const isBot = botPatterns.some((p) => ua.includes(p));

  // Detect suspicious patterns
  const suspiciousPatterns = [
    'curl', 'wget', 'python', 'java/', 'go-http', 'node-fetch',
    'scrapy', 'httpie'
  ];
  const isSuspicious = suspiciousPatterns.some((p) => ua.includes(p)) || isBot;

  // Detect mobile
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);

  // Extract browser
  let browser = 'Unknown';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';

  // Extract OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return { browser, os, isMobile, isBot, isSuspicious };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GEOLOCATION (Placeholder - use real IP geolocation service in production)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get geolocation from IP address
 * In production, use a service like MaxMind, ipinfo.io, or ip-api.com
 */
export async function getGeoLocation(ipAddress: string): Promise<GeoLocation> {
  // Skip for localhost/private IPs
  if (
    ipAddress === '127.0.0.1' ||
    ipAddress === '::1' ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('172.')
  ) {
    return {
      ip: ipAddress,
      country: 'Local',
      countryCode: 'LO',
      city: 'Local',
      isVpn: false,
      isTor: false,
      isProxy: false,
    };
  }

  // In production, make API call to geolocation service
  // Example with ip-api.com (free tier):
  /*
  try {
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,country,countryCode,city,region,lat,lon,isp,proxy`);
    const data = await response.json();
    if (data.status === 'success') {
      return {
        ip: ipAddress,
        country: data.country,
        countryCode: data.countryCode,
        city: data.city,
        region: data.region,
        latitude: data.lat,
        longitude: data.lon,
        isp: data.isp,
        isVpn: false, // Would need VPN detection service
        isTor: await checkTorExitNode(ipAddress),
        isProxy: data.proxy,
      };
    }
  } catch (error) {
    console.error('Geolocation lookup failed:', error);
  }
  */

  // Fallback
  return {
    ip: ipAddress,
    isVpn: false,
    isTor: false,
    isProxy: false,
  };
}

/**
 * Check if IP is a known Tor exit node
 */
export async function checkTorExitNode(_ipAddress: string): Promise<boolean> {
  // In production, check against Tor exit node list
  // https://check.torproject.org/exit-addresses
  return false;
}

/**
 * Calculate distance between two coordinates in kilometers
 */
export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RISK ASSESSMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Assess login risk based on context
 */
export async function assessLoginRisk(
  context: LoginContext
): Promise<RiskAssessment> {
  const factors: RiskFactor[] = [];
  let score = 0;

  const deviceId = context.deviceId || generateDeviceFingerprint(context);
  const location = await getGeoLocation(context.ipAddress);
  const uaAnalysis = parseUserAgentForRisk(context.userAgent);

  // ─────────────────────────────────────────────────────────────────────────
  // Check: Suspicious User Agent
  // ─────────────────────────────────────────────────────────────────────────
  if (uaAnalysis.isSuspicious) {
    factors.push({
      name: 'suspicious_user_agent',
      weight: RISK_CONFIG.WEIGHTS.SUSPICIOUS_USER_AGENT,
      description: 'Automated or suspicious browser detected',
      severity: 'danger',
    });
    score += RISK_CONFIG.WEIGHTS.SUSPICIOUS_USER_AGENT;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check: Tor Exit Node
  // ─────────────────────────────────────────────────────────────────────────
  if (location.isTor) {
    factors.push({
      name: 'tor_detected',
      weight: RISK_CONFIG.WEIGHTS.TOR_DETECTED,
      description: 'Login from Tor network',
      severity: 'danger',
    });
    score += RISK_CONFIG.WEIGHTS.TOR_DETECTED;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check: VPN/Proxy
  // ─────────────────────────────────────────────────────────────────────────
  if (location.isVpn || location.isProxy) {
    factors.push({
      name: 'vpn_detected',
      weight: RISK_CONFIG.WEIGHTS.VPN_DETECTED,
      description: 'Login from VPN or proxy',
      severity: 'warning',
    });
    score += RISK_CONFIG.WEIGHTS.VPN_DETECTED;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check: Known Device & Trust Status
  // ─────────────────────────────────────────────────────────────────────────
  let isNewDevice = true;
  let deviceTrusted = false;

  if (context.personId) {
    // Check if device is known
    const knownDevice = await db.execute(sql`
      SELECT trusted_flag, trust_expires_ts
      FROM app.known_device
      WHERE person_id = ${context.personId}::uuid
        AND device_id = ${deviceId}
        AND active_flag = true
    `);

    if (knownDevice.length > 0) {
      isNewDevice = false;
      const trustExpires = knownDevice[0].trust_expires_ts as Date | null;
      deviceTrusted = knownDevice[0].trusted_flag as boolean &&
        (!trustExpires || new Date(trustExpires) > new Date());
    }

    if (isNewDevice) {
      factors.push({
        name: 'new_device',
        weight: RISK_CONFIG.WEIGHTS.NEW_DEVICE,
        description: 'Login from new device',
        severity: 'warning',
      });
      score += RISK_CONFIG.WEIGHTS.NEW_DEVICE;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Check: Impossible Travel
    // ─────────────────────────────────────────────────────────────────────────
    if (location.latitude && location.longitude) {
      const lastLogin = await db.execute(sql`
        SELECT last_login_ip, last_login_ts, last_login_location
        FROM app.person
        WHERE id = ${context.personId}::uuid
      `);

      if (lastLogin.length > 0 && lastLogin[0].last_login_location) {
        const lastLocation = lastLogin[0].last_login_location as any;
        const lastTs = new Date(lastLogin[0].last_login_ts as string);
        const hoursSince = (Date.now() - lastTs.getTime()) / (1000 * 60 * 60);

        if (
          hoursSince < RISK_CONFIG.IMPOSSIBLE_TRAVEL_HOURS &&
          lastLocation.latitude &&
          lastLocation.longitude
        ) {
          const distance = calculateDistance(
            lastLocation.latitude,
            lastLocation.longitude,
            location.latitude,
            location.longitude
          );

          const speed = distance / hoursSince;
          if (speed > RISK_CONFIG.MAX_TRAVEL_SPEED_KMH) {
            factors.push({
              name: 'impossible_travel',
              weight: RISK_CONFIG.WEIGHTS.IMPOSSIBLE_TRAVEL,
              description: `Impossible travel detected: ${Math.round(distance)}km in ${Math.round(hoursSince * 60)} minutes`,
              severity: 'danger',
            });
            score += RISK_CONFIG.WEIGHTS.IMPOSSIBLE_TRAVEL;
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Check: New Country
    // ─────────────────────────────────────────────────────────────────────────
    if (location.countryCode) {
      const loginHistory = await db.execute(sql`
        SELECT DISTINCT geo_country FROM app.security_audit
        WHERE person_id = ${context.personId}::uuid
          AND event_type = 'login_success'
          AND created_ts > NOW() - INTERVAL '90 days'
        LIMIT 10
      `);

      const knownCountries = loginHistory.map((r) => r.geo_country as string);
      if (!knownCountries.includes(location.country || '')) {
        factors.push({
          name: 'new_country',
          weight: RISK_CONFIG.WEIGHTS.NEW_COUNTRY,
          description: `Login from new country: ${location.country}`,
          severity: 'warning',
        });
        score += RISK_CONFIG.WEIGHTS.NEW_COUNTRY;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Check: Recent Failed Attempts
    // ─────────────────────────────────────────────────────────────────────────
    const recentFailures = await db.execute(sql`
      SELECT COUNT(*) as count FROM app.security_audit
      WHERE (person_id = ${context.personId}::uuid OR email = ${context.email})
        AND event_type = 'login_failure'
        AND created_ts > NOW() - INTERVAL '1 hour'
    `);

    if ((recentFailures[0].count as number) >= 3) {
      factors.push({
        name: 'recent_failures',
        weight: RISK_CONFIG.WEIGHTS.FAILED_ATTEMPTS_RECENT,
        description: `${recentFailures[0].count} failed login attempts in the last hour`,
        severity: 'warning',
      });
      score += RISK_CONFIG.WEIGHTS.FAILED_ATTEMPTS_RECENT;
    }
  } else {
    // No person ID means this is a pre-auth check
    isNewDevice = true;
    factors.push({
      name: 'unknown_user',
      weight: 10,
      description: 'Pre-authentication risk check',
      severity: 'info',
    });
    score += 10;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Final Score & Recommendation
  // ─────────────────────────────────────────────────────────────────────────
  score = Math.min(100, score); // Cap at 100

  // Trusted devices get score reduction
  if (deviceTrusted) {
    score = Math.max(0, score - 20);
  }

  // Determine risk level
  let level: 'low' | 'medium' | 'high' | 'critical';
  if (score < 30) level = 'low';
  else if (score < 50) level = 'medium';
  else if (score < 75) level = 'high';
  else level = 'critical';

  // Determine recommendation
  let recommendation: 'allow' | 'mfa' | 'block';
  let requiresMfa = false;
  let shouldBlock = false;

  if (score >= RISK_CONFIG.BLOCK_THRESHOLD) {
    recommendation = 'block';
    shouldBlock = true;
    requiresMfa = true;
  } else if (score >= RISK_CONFIG.REQUIRE_MFA) {
    recommendation = 'mfa';
    requiresMfa = true;
  } else if (score >= RISK_CONFIG.ALLOW_WITHOUT_MFA) {
    recommendation = 'mfa';
    requiresMfa = true;
  } else {
    recommendation = 'allow';
    requiresMfa = false;
  }

  return {
    score,
    level,
    factors,
    recommendation,
    requiresMfa,
    shouldBlock,
    deviceTrusted,
    isNewDevice,
    location,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RATE LIMITING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface RateLimitConfig {
  maxAttempts: number;
  windowMinutes: number;
  blockMinutes: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { maxAttempts: 5, windowMinutes: 15, blockMinutes: 30 },
  password_reset: { maxAttempts: 3, windowMinutes: 60, blockMinutes: 60 },
  mfa_verify: { maxAttempts: 5, windowMinutes: 5, blockMinutes: 15 },
  email_verify: { maxAttempts: 5, windowMinutes: 60, blockMinutes: 60 },
};

/**
 * Check if an action is rate limited
 */
export async function checkRateLimit(
  action: string,
  key: string
): Promise<{ allowed: boolean; remainingAttempts: number; blockedUntil?: Date }> {
  const config = RATE_LIMITS[action] || RATE_LIMITS.login;
  const fullKey = `${action}:${key}`;

  // Check if currently blocked
  const result = await db.execute(sql`
    SELECT attempt_count, blocked_until_ts, window_end_ts
    FROM app.rate_limit
    WHERE key = ${fullKey} AND action = ${action}
  `);

  if (result.length > 0) {
    const record = result[0];

    // Check if blocked
    if (record.blocked_until_ts) {
      const blockedUntil = new Date(record.blocked_until_ts as string);
      if (blockedUntil > new Date()) {
        return {
          allowed: false,
          remainingAttempts: 0,
          blockedUntil,
        };
      }
    }

    // Check if window is still active
    const windowEnd = new Date(record.window_end_ts as string);
    if (windowEnd > new Date()) {
      const attempts = record.attempt_count as number;
      if (attempts >= config.maxAttempts) {
        // Block the key
        const blockedUntil = new Date(Date.now() + config.blockMinutes * 60 * 1000);
        await db.execute(sql`
          UPDATE app.rate_limit
          SET blocked_until_ts = ${blockedUntil.toISOString()}
          WHERE key = ${fullKey} AND action = ${action}
        `);
        return {
          allowed: false,
          remainingAttempts: 0,
          blockedUntil,
        };
      }
      return {
        allowed: true,
        remainingAttempts: config.maxAttempts - attempts,
      };
    }
  }

  return {
    allowed: true,
    remainingAttempts: config.maxAttempts,
  };
}

/**
 * Record a rate limit attempt
 */
export async function recordRateLimitAttempt(
  action: string,
  key: string
): Promise<void> {
  const config = RATE_LIMITS[action] || RATE_LIMITS.login;
  const fullKey = `${action}:${key}`;
  const windowEnd = new Date(Date.now() + config.windowMinutes * 60 * 1000);

  await db.execute(sql`
    INSERT INTO app.rate_limit (key, action, attempt_count, window_end_ts)
    VALUES (${fullKey}, ${action}, 1, ${windowEnd.toISOString()})
    ON CONFLICT (key, action) DO UPDATE SET
      attempt_count = CASE
        WHEN app.rate_limit.window_end_ts < NOW() THEN 1
        ELSE app.rate_limit.attempt_count + 1
      END,
      window_start_ts = CASE
        WHEN app.rate_limit.window_end_ts < NOW() THEN NOW()
        ELSE app.rate_limit.window_start_ts
      END,
      window_end_ts = CASE
        WHEN app.rate_limit.window_end_ts < NOW() THEN ${windowEnd.toISOString()}
        ELSE app.rate_limit.window_end_ts
      END
  `);
}

/**
 * Reset rate limit for a key (e.g., after successful login)
 */
export async function resetRateLimit(
  action: string,
  key: string
): Promise<void> {
  const fullKey = `${action}:${key}`;
  await db.execute(sql`
    DELETE FROM app.rate_limit WHERE key = ${fullKey} AND action = ${action}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const riskService = {
  // Configuration
  RISK_CONFIG,

  // Device fingerprinting
  generateDeviceFingerprint,
  parseUserAgentForRisk,

  // Geolocation
  getGeoLocation,
  calculateDistance,

  // Risk assessment
  assessLoginRisk,

  // Rate limiting
  checkRateLimit,
  recordRateLimitAttempt,
  resetRateLimit,
};

export default riskService;
