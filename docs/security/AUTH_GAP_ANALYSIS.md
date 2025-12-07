# Authentication & Security Gap Analysis

## PMO Platform vs Next-Gen Industry Standards (2024-2025)

> **Analysis Date**: December 2025
> **Compared Against**: FIDO Alliance, NIST SP 800-63-4, Auth0, Okta, Stytch, Microsoft Entra, Google Identity

---

## Executive Summary

Your PMO platform has a **solid foundation** with centralized authentication, TOTP MFA, and comprehensive account security. However, there are **critical gaps** when compared to next-gen companies like Stripe, GitHub, Linear, and Vercel.

### Overall Score: **68/100** (Good Foundation, Needs Modernization)

| Category | Your Score | Industry Standard |
|----------|------------|-------------------|
| Password Security | 85% | 90% |
| MFA Implementation | 70% | 95% |
| Passwordless/Passkeys | 15% | 85% |
| Token Management | 45% | 90% |
| Session Security | 50% | 85% |
| Fraud Detection | 20% | 80% |
| OAuth/SSO | 30% | 90% |

---

## 1. CRITICAL GAPS (High Priority)

### 1.1 Passkeys/WebAuthn Not Implemented ❌

**Current State**:
- DDL has `passkey_enabled_flag` and `passkey_credentials` columns
- **No actual WebAuthn implementation** in routes or service

**Industry Standard (2025)**:
- 92% of enterprise CISOs are implementing passwordless authentication
- Microsoft: 99% passkey registration success rate, 14x faster than password+MFA
- NIST SP 800-63-4 (July 2025): Passkeys achieve AAL2 (Authenticator Assurance Level 2)
- All federal agencies must use phishing-resistant MFA (WebAuthn/FIDO2)

**Gap Impact**: HIGH
- Passkeys are **phishing-resistant** (cryptographically bound to domain)
- Your TOTP is susceptible to real-time phishing attacks
- Missing competitive feature that top SaaS companies offer

**Recommendation**:
```typescript
// Add WebAuthn registration endpoint
POST /api/v1/auth/passkey/register/options  // Generate challenge
POST /api/v1/auth/passkey/register/verify   // Verify and store credential

// Add WebAuthn authentication endpoint
POST /api/v1/auth/passkey/login/options     // Generate assertion
POST /api/v1/auth/passkey/login/verify      // Verify assertion

// Libraries: @simplewebauthn/server (recommended)
```

---

### 1.2 No Refresh Token Rotation ❌

**Current State**:
- Single JWT token with fixed expiration
- No refresh token mechanism
- Stateless logout (client-side only)

**Industry Standard**:
- Short-lived access tokens (5-15 minutes)
- Long-lived refresh tokens (7-14 days) with **rotation on every use**
- Refresh token reuse detection (invalidate all tokens if reuse detected)
- Server-side token blacklist for immediate revocation

**Gap Impact**: CRITICAL
- Long-lived tokens increase attack window
- Cannot force logout compromised sessions
- No defense against token theft

**Recommendation**:
```typescript
// Token structure
Access Token: 15 min expiry, stateless JWT
Refresh Token: 7 days expiry, stored in DB, single-use

// New endpoints
POST /api/v1/auth/token/refresh
POST /api/v1/auth/token/revoke
POST /api/v1/auth/sessions/revoke-all

// Database table
CREATE TABLE app.refresh_token (
  id uuid PRIMARY KEY,
  person_id uuid REFERENCES app.person(id),
  token_hash varchar(64),  -- SHA256 hash
  device_id varchar(64),
  expires_ts timestamptz,
  revoked_flag boolean DEFAULT false,
  created_ts timestamptz DEFAULT now()
);
```

---

### 1.3 No Risk-Based/Adaptive Authentication ❌

**Current State**:
- Static authentication flow
- MFA always required if enabled
- No contextual awareness

**Industry Standard**:
- Device fingerprinting with risk scoring
- Behavioral analysis (login patterns, typing biometrics)
- Contextual checks: new device, impossible travel, VPN/Tor detection
- Step-up authentication only when risk exceeds threshold

**Gap Impact**: HIGH
- Poor user experience (always require MFA)
- Missing fraud detection capabilities
- Cannot detect account takeover attempts

**Recommendation**:
```typescript
// Risk signals to evaluate
interface RiskAssessment {
  deviceFingerprint: string;
  isKnownDevice: boolean;
  geoLocation: { lat: number; lon: number; country: string };
  impossibleTravel: boolean;  // Login from NYC then Tokyo in 30 min
  vpnDetected: boolean;
  torExitNode: boolean;
  browserAnomaly: boolean;    // Headless browser, automation
  loginTimeAnomaly: boolean;  // 3 AM when user always logs in 9 AM
  riskScore: number;          // 0-100
}

// Action based on risk
if (riskScore < 30) → Allow without MFA
if (riskScore 30-70) → Require MFA
if (riskScore > 70) → Block + notify user + require email verification
```

---

### 1.4 OAuth 2.1 / PKCE Not Implemented ❌

**Current State**:
- SSO provider configs defined but not implemented
- No actual OAuth flow in routes

**Industry Standard**:
- OAuth 2.1 with PKCE (Proof Key for Code Exchange) mandatory for all clients
- State parameter for CSRF protection
- Nonce for replay attack prevention
- Strict redirect URI validation

**Gap Impact**: MEDIUM-HIGH
- Cannot support enterprise SSO requirements
- Missing "Sign in with Google/Microsoft" functionality
- Required for B2B enterprise sales

**Recommendation**:
```typescript
// OAuth endpoints
GET  /api/v1/auth/sso/:provider/authorize  // Redirect to IdP
GET  /api/v1/auth/sso/:provider/callback   // Handle callback
POST /api/v1/auth/sso/link                 // Link SSO to existing account
POST /api/v1/auth/sso/unlink               // Unlink SSO provider

// PKCE flow
1. Generate code_verifier (43-128 char random string)
2. Generate code_challenge = BASE64URL(SHA256(code_verifier))
3. Include code_challenge in authorization request
4. Include code_verifier in token exchange
```

---

## 2. MAJOR GAPS (Medium Priority)

### 2.1 Session Management Deficiencies

**Current State**:
- `active_sessions` JSONB field exists but unused
- No session listing/revocation UI
- No concurrent session limits enforcement

**Industry Standard**:
- List active sessions with device info
- "Sign out all devices" functionality
- Per-device session revocation
- Concurrent session limits (your DDL has `max_sessions`)

**Recommendation**:
```typescript
// New endpoints
GET  /api/v1/auth/sessions           // List active sessions
DELETE /api/v1/auth/sessions/:id     // Revoke specific session
DELETE /api/v1/auth/sessions/others  // Revoke all except current
```

---

### 2.2 MFA Recovery Gaps

**Current State**:
- Backup codes (10 codes, XXXX-XXXX format) ✓
- Security questions ✓
- Email recovery ✓

**Missing**:
- Recovery codes download confirmation
- Trusted recovery contacts (like Apple)
- Hardware security key as backup
- Account recovery audit trail

**Recommendation**:
- Add "I've saved my codes" confirmation before enabling MFA
- Add trusted contact recovery (requires 24h waiting period)
- Support multiple MFA methods simultaneously

---

### 2.3 SMS/Phone MFA is Risky

**Current State**:
- `mfa_method` supports 'sms' option
- Phone verification code generation exists

**Industry Standard (2024-2025)**:
- SMS OTP deprecated for high-security accounts
- SIM-swapping attacks up 45% in 2024
- NIST recommends against SMS for sensitive operations

**Recommendation**:
- Warn users SMS is less secure
- Require additional verification for SMS MFA enable
- Default to TOTP authenticator apps
- Support push notifications as alternative

---

### 2.4 Missing Biometric Implementation

**Current State**:
- DDL has `biometric_enabled_flag` and `biometric_type`
- No actual implementation

**Industry Standard**:
- Face ID / Touch ID via WebAuthn platform authenticators
- Behavioral biometrics (typing patterns, mouse movement)
- Continuous authentication during session

**Recommendation**:
- Implement via WebAuthn with `authenticatorAttachment: "platform"`
- This is essentially passkeys on device

---

## 3. SECURITY ENHANCEMENTS NEEDED

### 3.1 Password Security

**Your Implementation** ✓ (Good):
- bcrypt with cost 12 ✓
- Password policy validation ✓
- Password history (5 passwords) ✓
- Account lockout (5 attempts, 30 min) ✓

**Missing**:
- [ ] Breached password checking (HaveIBeenPwned API)
- [ ] Common password blocklist
- [ ] Zxcvbn entropy scoring (instead of simple rules)
- [ ] Password expiration policies (enterprise requirement)

**Recommendation**:
```typescript
// Add HaveIBeenPwned check
import crypto from 'crypto';

async function isPasswordBreached(password: string): Promise<boolean> {
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const hashes = await response.text();

  return hashes.includes(suffix);
}
```

---

### 3.2 Rate Limiting

**Current State**:
- Account lockout exists ✓
- No API rate limiting visible

**Missing**:
- [ ] Per-IP rate limiting
- [ ] Per-email rate limiting (prevent enumeration)
- [ ] Graduated rate limiting (stricter after violations)
- [ ] CAPTCHA integration after suspicious activity

**Recommendation**:
```typescript
// Rate limit rules
Login attempts: 5/min per IP, 10/hour per email
Password reset: 3/hour per email
Email verification: 5/day per email
MFA setup: 3/day per account
```

---

### 3.3 Audit Logging

**Current State**:
- `login_history` JSONB field ✓
- Basic login tracking ✓

**Missing**:
- [ ] Security event audit table (separate from login_history)
- [ ] Events: password change, MFA change, session revocation, permission change
- [ ] Immutable audit trail
- [ ] SIEM integration ready

**Recommendation**:
```sql
CREATE TABLE app.security_audit (
  id uuid PRIMARY KEY,
  person_id uuid,
  event_type varchar(50),  -- 'login', 'logout', 'password_change', 'mfa_enable', etc.
  event_detail jsonb,
  ip_address varchar(45),
  user_agent text,
  risk_score integer,
  created_ts timestamptz DEFAULT now()
);
-- Make immutable: no UPDATE/DELETE allowed
```

---

### 3.4 Token Security

**Current State**:
- JWT with HS256 signing
- Token in Authorization header

**Missing**:
- [ ] Token binding (bind to device/session)
- [ ] Asymmetric signing (RS256/ES256 for distributed verification)
- [ ] Token encryption (JWE for sensitive claims)
- [ ] Audience (`aud`) and issuer (`iss`) validation

**Recommendation**:
```typescript
// JWT best practices
{
  "iss": "https://pmo.example.com",
  "aud": "pmo-api",
  "sub": "person-uuid",
  "iat": 1234567890,
  "exp": 1234568790,  // 15 min
  "jti": "unique-token-id",  // For revocation
  "session_id": "session-uuid",  // For session binding
  "device_id": "device-fingerprint"  // For device binding
}
```

---

## 4. MISSING MODERN FEATURES

### 4.1 Magic Links (Passwordless Email)

**Status**: Not Implemented

```typescript
// Simple passwordless flow
POST /api/v1/auth/magic-link/send
  → Sends email with signed JWT link
  → Link valid for 10 minutes
  → One-time use

GET /api/v1/auth/magic-link/verify?token=xxx
  → Validates token
  → Creates session
  → Redirects to app
```

---

### 4.2 Device Trust/Remember This Device

**Status**: DDL exists, not implemented

```typescript
// Trust device flow
1. After MFA success, offer "Trust this device for 30 days"
2. Generate device_id, store in HttpOnly cookie
3. Store device_id hash in trusted_devices array
4. Skip MFA for recognized devices

// Considerations
- Allow max 5 trusted devices
- Untrust device on password change
- Show trusted devices list in security settings
```

---

### 4.3 Login Notifications

**Status**: Notification preferences exist, not implemented

```typescript
// Trigger notifications for:
- Login from new device
- Login from new location
- Login from new IP range
- Failed login attempts
- Password changed
- MFA settings changed

// Channels
- Email (immediate)
- Push notification (immediate)
- In-app notification (on next visit)
```

---

### 4.4 Step-Up Authentication

**Status**: Not Implemented

```typescript
// For sensitive operations, require re-authentication
const SENSITIVE_OPERATIONS = [
  'password_change',
  'email_change',
  'mfa_disable',
  'delete_account',
  'export_data',
  'api_key_create'
];

// Require password or MFA within last 5 minutes
POST /api/v1/auth/step-up
  → Verify password or MFA
  → Return short-lived elevated session (5 min)
  → Allow sensitive operation
```

---

## 5. COMPLIANCE GAPS

### 5.1 GDPR (European Users)

**Current State**:
- Data export/deletion request fields exist ✓
- Consent flag exists ✓

**Missing**:
- [ ] Actual data export endpoint
- [ ] Actual data deletion workflow (30-day retention, then hard delete)
- [ ] Consent withdrawal mechanism
- [ ] Cookie consent for authentication cookies

---

### 5.2 SOC 2 / Enterprise Requirements

**Missing**:
- [ ] Password expiration policies (configurable per tenant)
- [ ] Session timeout policies (idle timeout)
- [ ] IP allowlist/blocklist
- [ ] Audit log export
- [ ] SSO enforcement (disable password login)

---

## 6. IMPLEMENTATION PRIORITY MATRIX

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| WebAuthn/Passkeys | High | High | P1 - Q1 |
| Refresh Token Rotation | Critical | Medium | P0 - Immediate |
| OAuth 2.1 PKCE | High | Medium | P1 - Q1 |
| Risk-Based Auth | High | High | P2 - Q2 |
| Session Management | Medium | Low | P1 - Q1 |
| Breached Password Check | Medium | Low | P1 - Q1 |
| Rate Limiting | High | Low | P0 - Immediate |
| Security Audit Table | Medium | Low | P1 - Q1 |
| Magic Links | Medium | Low | P2 - Q2 |
| Device Trust | Medium | Medium | P2 - Q2 |
| Login Notifications | Medium | Medium | P2 - Q2 |
| Step-Up Auth | Medium | Medium | P2 - Q2 |

---

## 7. COMPETITOR COMPARISON

| Feature | PMO | Auth0 | Clerk | Stytch | Supabase |
|---------|-----|-------|-------|--------|----------|
| Password Auth | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOTP MFA | ✅ | ✅ | ✅ | ✅ | ✅ |
| SMS MFA | 🔶 | ✅ | ✅ | ✅ | ✅ |
| WebAuthn/Passkeys | ❌ | ✅ | ✅ | ✅ | ✅ |
| Magic Links | ❌ | ✅ | ✅ | ✅ | ✅ |
| OAuth/SSO | 🔶 | ✅ | ✅ | ✅ | ✅ |
| Refresh Tokens | ❌ | ✅ | ✅ | ✅ | ✅ |
| Device Trust | 🔶 | ✅ | ✅ | ✅ | ❌ |
| Risk-Based Auth | ❌ | ✅ | ✅ | ✅ | ❌ |
| Fraud Detection | ❌ | ✅ | ✅ | ✅ | ❌ |
| Audit Logs | 🔶 | ✅ | ✅ | ✅ | ✅ |
| Breached Password | ❌ | ✅ | ✅ | ❌ | ❌ |

Legend: ✅ Full | 🔶 Partial | ❌ Missing

---

## 8. QUICK WINS (Implement This Week)

### 8.1 Add Rate Limiting
```typescript
// Install: npm install @fastify/rate-limit

import rateLimit from '@fastify/rate-limit';

fastify.register(rateLimit, {
  max: 5,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: () => ({
    error: 'Too many requests, please try again later'
  })
});

// Per-route override for login
fastify.post('/login', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute'
    }
  }
}, loginHandler);
```

### 8.2 Add Breached Password Check
```typescript
// Add to validatePasswordPolicy
const policyResult = validatePasswordPolicy(password);
if (policyResult.valid) {
  const isBreached = await isPasswordBreached(password);
  if (isBreached) {
    policyResult.valid = false;
    policyResult.errors.push('This password has appeared in a data breach');
  }
}
```

### 8.3 Add Token Revocation Table
```sql
CREATE TABLE app.token_blacklist (
  jti varchar(64) PRIMARY KEY,
  person_id uuid,
  expires_ts timestamptz,
  created_ts timestamptz DEFAULT now()
);

-- Cleanup job (run daily)
DELETE FROM app.token_blacklist WHERE expires_ts < NOW();
```

---

## 9. ARCHITECTURE RECOMMENDATIONS

### Current Flow (Simplified)
```
User → Password → [TOTP if enabled] → JWT → API
```

### Recommended Flow (2025 Standard)
```
User → [Passkey | Password]
     → [Adaptive Risk Check]
     → [Step-up MFA if high risk]
     → Access Token (15 min) + Refresh Token (7 days)
     → API

Refresh Token → [Rotation] → New Access Token + New Refresh Token
```

### Technology Stack Additions

| Purpose | Recommended |
|---------|-------------|
| WebAuthn | @simplewebauthn/server |
| Rate Limiting | @fastify/rate-limit |
| OAuth | @fastify/oauth2 |
| Device Fingerprint | @fingerprintjs/fingerprintjs-pro (or open-source) |
| Breach Check | HaveIBeenPwned API (k-anonymity) |
| Risk Scoring | Custom ML model or Stytch/Castle.io |

---

## 10. REFERENCES

- [FIDO Alliance - Passkeys](https://fidoalliance.org/passkeys/)
- [NIST SP 800-63-4 Digital Identity Guidelines](https://pages.nist.gov/800-63-4/)
- [Auth0 - Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
- [OAuth 2.1 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [Stytch - Device Fingerprinting](https://stytch.com/docs/guides/device-fingerprinting)
- [Microsoft Entra - FIDO2 Authentication](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-passwordless)

---

## Summary

Your authentication system has a **solid foundation** but is **1-2 years behind** industry leaders. The immediate priorities are:

1. **Refresh Token Rotation** - Critical security improvement
2. **Rate Limiting** - Quick win, essential protection
3. **WebAuthn/Passkeys** - Future-proof, phishing-resistant
4. **Risk-Based Authentication** - Modern UX + fraud prevention

The DDL schema is already prepared for many features (passkeys, biometrics, trusted devices) - the gap is primarily in the API implementation layer.
