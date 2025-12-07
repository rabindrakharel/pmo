# Authentication System Architecture

## Overview

The PMO platform implements a comprehensive authentication system with multiple authentication methods, multi-factor authentication, and enterprise-grade security features.

---

## Table of Contents

1. [Authentication Methods](#authentication-methods)
2. [Frontend Pages](#frontend-pages)
3. [Backend API Routes](#backend-api-routes)
4. [Database Schema](#database-schema)
5. [Security Features](#security-features)
6. [Flow Diagrams](#flow-diagrams)

---

## Authentication Methods

| Method | Status | Description |
|--------|--------|-------------|
| **Email/Password** | Active | Traditional login with bcrypt-hashed passwords |
| **OAuth SSO** | Active | Google, Microsoft, GitHub via OAuth 2.1 + PKCE |
| **WebAuthn/Passkeys** | Active | FIDO2 passwordless authentication |
| **MFA (TOTP)** | Active | Time-based one-time passwords (Google Authenticator) |
| **Backup Codes** | Active | One-time recovery codes for MFA |
| **Security Questions** | Active | Account recovery via secret questions |

---

## Frontend Pages

### Location: `apps/web/src/pages/auth/`

### 1. SignInPage.tsx

**Purpose**: Main login page supporting multiple authentication methods

**Features**:
- Email/password login form
- "Remember me" checkbox
- OAuth SSO buttons (Google, Microsoft, GitHub)
- Passkey login option
- Link to forgot password
- Link to signup

**State Management**:
- React Hook Form with Zod validation
- TanStack Query for API calls

**API Calls**:
- `POST /api/v1/auth/login` - Password login
- `POST /api/v1/auth/login/mfa` - Login requiring MFA
- `GET /api/v1/auth/sso/:provider/authorize` - OAuth initiation

---

### 2. SignUpPage.tsx

**Purpose**: New user registration

**Features**:
- Email, password, confirm password fields
- Password strength indicator
- Terms of service acceptance
- Email verification flow trigger
- OAuth signup option

**Validation**:
- Email format validation
- Password policy enforcement (min 8 chars, uppercase, lowercase, number, special char)
- Password match confirmation

**API Calls**:
- `POST /api/v1/auth/customer/signup` - Register new user
- `POST /api/v1/auth/email/send-verification` - Send verification email

---

### 3. ForgotPasswordPage.tsx

**Purpose**: Password reset request

**Features**:
- Email input field
- Rate limiting feedback
- Success confirmation message
- Link back to sign in

**API Calls**:
- `POST /api/v1/auth/password/reset-request` - Request reset email

---

### 4. MFASetupPage.tsx

**Purpose**: Configure multi-factor authentication

**Features**:
- QR code display for TOTP setup (via `qrcode.react`)
- Manual entry secret key display
- 6-digit verification code input
- Backup codes generation and display
- Copy to clipboard functionality

**Dependencies**:
- `qrcode.react` - QR code generation

**API Calls**:
- `POST /api/v1/auth/mfa/setup` - Get setup QR code and secret
- `POST /api/v1/auth/mfa/verify` - Verify TOTP code and enable MFA
- `POST /api/v1/auth/mfa/backup-codes/regenerate` - Generate new backup codes

---

### 5. SecurityQuestionsPage.tsx

**Purpose**: Setup security questions for account recovery

**Features**:
- 3 question/answer pairs required
- Dropdown selection from predefined questions
- Duplicate question prevention
- Minimum 2-character answers

**Validation (Zod Schema)**:
```typescript
const securityQuestionsSchema = z.object({
  questions: z.array(z.object({
    question_id: z.string().min(1, 'Please select a question'),
    answer: z.string().min(2, 'Answer must be at least 2 characters'),
  })).length(3, 'Must provide exactly 3 security questions'),
}).refine(data => {
  const questionIds = data.questions.map(q => q.question_id);
  return new Set(questionIds).size === questionIds.length;
}, { message: 'Each question must be unique' });
```

**API Calls**:
- `GET /api/v1/auth/security-questions/list` - Get available questions
- `POST /api/v1/auth/security-questions/setup` - Save user's answers

---

### 6. AccountRecoveryPage.tsx

**Purpose**: Recover account access when locked out

**Features**:
- Multiple recovery options display
- Security questions verification
- Backup code entry
- Email recovery link option

**API Calls**:
- `GET /api/v1/auth/recovery/options` - Get available recovery methods
- `POST /api/v1/auth/security-questions/verify` - Verify security answers
- `POST /api/v1/auth/recovery/backup-code` - Use backup code

---

## Backend API Routes

### Location: `apps/api/src/modules/auth/`

### Core Routes (routes.ts - 2475 lines)

#### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/login` | Email/password login |
| `POST` | `/api/v1/auth/login/mfa` | Login when MFA is required |
| `POST` | `/api/v1/auth/login/mfa/verify` | Verify MFA code during login |
| `POST` | `/api/v1/auth/logout` | Logout (invalidate session) |

#### Customer Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/customer/signup` | Register new customer |
| `POST` | `/api/v1/auth/customer/signin` | Customer-specific login |
| `GET` | `/api/v1/auth/customer/me` | Get current customer profile |

#### MFA Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/mfa/setup` | Generate TOTP secret + QR |
| `POST` | `/api/v1/auth/mfa/verify` | Verify code and enable MFA |
| `POST` | `/api/v1/auth/mfa/disable` | Disable MFA (requires code) |
| `GET` | `/api/v1/auth/mfa/status` | Get MFA status |
| `POST` | `/api/v1/auth/mfa/backup-codes/regenerate` | Generate new backup codes |

#### Email Verification

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/email/send-verification` | Send verification email |
| `POST` | `/api/v1/auth/email/verify` | Verify email token |

#### Password Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/password/validate` | Check password strength |
| `POST` | `/api/v1/auth/password/reset-request` | Request password reset |
| `POST` | `/api/v1/auth/password/reset` | Reset password with token |
| `POST` | `/api/v1/auth/password/change` | Change password (authenticated) |

#### Security Questions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/auth/security-questions/list` | Get available questions |
| `POST` | `/api/v1/auth/security-questions/setup` | Save user's Q&A |
| `GET` | `/api/v1/auth/security-questions/user` | Get user's questions (not answers) |
| `POST` | `/api/v1/auth/security-questions/verify` | Verify answers |

#### Account Recovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/auth/recovery/options` | Get recovery methods |
| `POST` | `/api/v1/auth/recovery/backup-code` | Recover with backup code |

---

### Advanced Routes (routes-advanced.ts - 1250 lines)

#### Token Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/token/refresh` | Refresh access token |
| `POST` | `/api/v1/auth/token/revoke` | Revoke specific token |
| `POST` | `/api/v1/auth/token/revoke-all` | Revoke all user tokens |

**Refresh Token Rotation**:
- New refresh token issued on each refresh
- Old refresh token invalidated
- Reuse detection (if old token used, all tokens revoked)

#### Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/auth/sessions` | List active sessions |
| `DELETE` | `/api/v1/auth/sessions/:sessionId` | Terminate specific session |
| `DELETE` | `/api/v1/auth/sessions/terminate-others` | Terminate all other sessions |

**Session Data Tracked**:
- Device fingerprint
- IP address
- User agent
- Last activity
- Location (approximate)

#### WebAuthn/Passkeys

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/passkey/register/options` | Get registration challenge |
| `POST` | `/api/v1/auth/passkey/register/verify` | Complete registration |
| `POST` | `/api/v1/auth/passkey/login/options` | Get login challenge |
| `POST` | `/api/v1/auth/passkey/login/verify` | Complete login |
| `GET` | `/api/v1/auth/passkeys` | List registered passkeys |
| `DELETE` | `/api/v1/auth/passkeys/:id` | Remove passkey |

#### OAuth SSO

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/auth/sso/:provider/authorize` | Initiate OAuth flow |
| `GET` | `/api/v1/auth/sso/:provider/callback` | Handle OAuth callback |
| `GET` | `/api/v1/auth/sso/accounts` | List linked OAuth accounts |
| `DELETE` | `/api/v1/auth/sso/accounts/:provider` | Unlink OAuth account |

**Supported Providers**:
- Google (openid, email, profile)
- Microsoft (openid, email, profile)
- GitHub (read:user, user:email)

#### Risk-Based Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/risk/assess` | Assess login risk |
| `POST` | `/api/v1/auth/devices/trust` | Mark device as trusted |

**Risk Factors Analyzed**:
- New device detection
- Unusual location
- Unusual time
- Failed login attempts
- Velocity checks

---

## OAuth Service

### Location: `apps/api/src/services/oauth.service.ts`

### Implementation: OAuth 2.1 with PKCE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      OAuth 2.1 + PKCE Flow                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "Sign in with Google"                                   │
│     │                                                                    │
│     ▼                                                                    │
│  2. API generates:                                                       │
│     • state (CSRF protection)                                           │
│     • code_verifier (PKCE)                                              │
│     • code_challenge = SHA256(code_verifier)                            │
│     │                                                                    │
│     ▼                                                                    │
│  3. Store state + code_verifier in app.oauth_state                      │
│     │                                                                    │
│     ▼                                                                    │
│  4. Redirect to Google with:                                            │
│     • client_id                                                          │
│     • redirect_uri                                                       │
│     • code_challenge                                                     │
│     • state                                                              │
│     │                                                                    │
│     ▼                                                                    │
│  5. User authenticates with Google                                       │
│     │                                                                    │
│     ▼                                                                    │
│  6. Google redirects back with:                                          │
│     • code (authorization code)                                          │
│     • state                                                              │
│     │                                                                    │
│     ▼                                                                    │
│  7. API verifies state, retrieves code_verifier                         │
│     │                                                                    │
│     ▼                                                                    │
│  8. API exchanges code + code_verifier for tokens                       │
│     │                                                                    │
│     ▼                                                                    │
│  9. API fetches user info from Google                                   │
│     │                                                                    │
│     ▼                                                                    │
│  10. Create/link user account, issue JWT                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `generateState()` | Generate CSRF protection token |
| `generateCodeVerifier()` | Generate PKCE code verifier |
| `generateCodeChallenge()` | Create S256 challenge from verifier |
| `storeOAuthState()` | Store state in database |
| `consumeOAuthState()` | Retrieve and invalidate state |
| `getAuthorizationUrl()` | Build OAuth authorization URL |
| `exchangeCodeForTokens()` | Exchange code for access token |
| `getUserInfo()` | Fetch user profile from provider |
| `handleOAuthCallback()` | Complete OAuth flow |
| `linkAccount()` | Link OAuth to existing user |
| `unlinkAccount()` | Remove OAuth link |

### Provider Configuration

```typescript
export function getOAuthProvider(provider: string): OAuthProviderConfig | null {
  const providers = {
    google: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scope: 'openid email profile',
    },
    microsoft: {
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scope: 'openid email profile',
    },
    github: {
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scope: 'read:user user:email',
    },
  };
  return providers[provider] || null;
}
```

---

## Database Schema

### Core Authentication Tables

```sql
-- User identity (all auth data)
app.person
├── id UUID PRIMARY KEY
├── email VARCHAR(255) UNIQUE
├── password_hash VARCHAR(255)          -- bcrypt hash
├── mfa_enabled_flag BOOLEAN
├── mfa_secret VARCHAR(255)             -- TOTP secret (encrypted)
├── passkey_enabled_flag BOOLEAN
├── email_verified_flag BOOLEAN
├── failed_login_attempts INTEGER
├── lockout_until TIMESTAMP
├── password_changed_ts TIMESTAMP
├── password_history JSONB              -- Previous password hashes
├── metadata JSONB                      -- { oauth_accounts: [...] }
└── active_flag BOOLEAN

-- MFA backup codes
app.person_mfa_backup_code
├── id UUID PRIMARY KEY
├── person_id UUID REFERENCES app.person
├── code_hash VARCHAR(255)              -- bcrypt hash
├── used_flag BOOLEAN
└── used_ts TIMESTAMP

-- WebAuthn passkeys
app.person_passkey
├── id UUID PRIMARY KEY
├── person_id UUID REFERENCES app.person
├── credential_id VARCHAR(255) UNIQUE
├── public_key TEXT
├── counter INTEGER
├── device_name VARCHAR(255)
├── last_used_ts TIMESTAMP
└── created_ts TIMESTAMP

-- Security questions
app.person_security_question
├── id UUID PRIMARY KEY
├── person_id UUID REFERENCES app.person
├── question_id UUID
├── answer_hash VARCHAR(255)            -- bcrypt hash
└── created_ts TIMESTAMP

-- Active sessions
app.person_session
├── id UUID PRIMARY KEY
├── person_id UUID REFERENCES app.person
├── refresh_token_hash VARCHAR(255)
├── device_fingerprint VARCHAR(255)
├── ip_address INET
├── user_agent TEXT
├── last_activity_ts TIMESTAMP
├── expires_ts TIMESTAMP
└── revoked_flag BOOLEAN

-- OAuth state (temporary)
app.oauth_state
├── state VARCHAR(255) PRIMARY KEY
├── code_verifier VARCHAR(255)
├── provider VARCHAR(50)
├── redirect_uri TEXT
├── action VARCHAR(20)                  -- 'login' | 'signup' | 'link'
├── person_id UUID                      -- For 'link' action
├── used_flag BOOLEAN
└── expires_ts TIMESTAMP

-- Password reset tokens
app.person_password_reset
├── id UUID PRIMARY KEY
├── person_id UUID REFERENCES app.person
├── token_hash VARCHAR(255)
├── used_flag BOOLEAN
├── expires_ts TIMESTAMP
└── created_ts TIMESTAMP

-- Email verification tokens
app.person_email_verification
├── id UUID PRIMARY KEY
├── person_id UUID REFERENCES app.person
├── token_hash VARCHAR(255)
├── used_flag BOOLEAN
├── expires_ts TIMESTAMP
└── created_ts TIMESTAMP

-- Trusted devices
app.person_trusted_device
├── id UUID PRIMARY KEY
├── person_id UUID REFERENCES app.person
├── device_fingerprint VARCHAR(255)
├── device_name VARCHAR(255)
├── last_used_ts TIMESTAMP
├── trusted_until TIMESTAMP
└── created_ts TIMESTAMP
```

---

## Security Features

### Password Policy

```typescript
const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  maxRepeatingChars: 3,
  preventCommonPasswords: true,
  preventUserInfoInPassword: true,
  historyCount: 5,              // Prevent last 5 passwords
  maxAge: 90,                   // Days before password expires
};
```

### Account Lockout

```typescript
const LOCKOUT_POLICY = {
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60,     // 15 minutes
  resetAttemptsAfter: 60 * 60,  // 1 hour
};
```

### Session Security

- **JWT Expiry**: 24 hours (configurable)
- **Refresh Token Rotation**: New token on each refresh
- **Reuse Detection**: All tokens revoked if old refresh token used
- **Device Binding**: Sessions linked to device fingerprint
- **IP Tracking**: Session IP logged for audit

### MFA Implementation

- **TOTP Algorithm**: SHA-1, 6 digits, 30-second window
- **Backup Codes**: 10 codes, single-use, bcrypt-hashed
- **Recovery**: Via security questions or email

---

## Flow Diagrams

### Password Login Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Password Login Flow                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Client                      API                       Database          │
│  ──────                      ───                       ────────          │
│    │                          │                            │             │
│    │  POST /auth/login        │                            │             │
│    │  { email, password }     │                            │             │
│    │─────────────────────────►│                            │             │
│    │                          │                            │             │
│    │                          │  Check lockout status      │             │
│    │                          │───────────────────────────►│             │
│    │                          │                            │             │
│    │                          │  Fetch user by email       │             │
│    │                          │───────────────────────────►│             │
│    │                          │                            │             │
│    │                          │  bcrypt.compare(password)  │             │
│    │                          │                            │             │
│    │                          │                            │             │
│    │                    ┌─────┴─────┐                      │             │
│    │                    │ Password  │                      │             │
│    │                    │  Valid?   │                      │             │
│    │                    └─────┬─────┘                      │             │
│    │                          │                            │             │
│    │                   ┌──────┴──────┐                     │             │
│    │                   ▼             ▼                     │             │
│    │              [Invalid]      [Valid]                   │             │
│    │                   │             │                     │             │
│    │           Increment         Check MFA                 │             │
│    │           failed_attempts   enabled                   │             │
│    │                   │             │                     │             │
│    │◄──────────────────│      ┌──────┴──────┐              │             │
│    │  401 Unauthorized │      ▼             ▼              │             │
│    │                   │  [MFA On]     [MFA Off]           │             │
│    │                   │      │             │              │             │
│    │                   │  Return        Generate           │             │
│    │                   │  mfa_required  JWT + session      │             │
│    │                   │      │             │              │             │
│    │◄─────────────────────────│             │              │             │
│    │  { mfa_required: true,   │             │              │             │
│    │    mfa_token: "..." }    │             │              │             │
│    │                          │             │              │             │
│    │◄───────────────────────────────────────│              │             │
│    │  { token: "eyJ...",                    │              │             │
│    │    refresh_token: "..." }              │              │             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### MFA Verification Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MFA Verification Flow                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Client                      API                       Database          │
│  ──────                      ───                       ────────          │
│    │                          │                            │             │
│    │  POST /auth/login/mfa/verify                          │             │
│    │  { mfa_token, code }     │                            │             │
│    │─────────────────────────►│                            │             │
│    │                          │                            │             │
│    │                          │  Verify mfa_token          │             │
│    │                          │  (contains person_id)      │             │
│    │                          │                            │             │
│    │                          │  Fetch mfa_secret          │             │
│    │                          │───────────────────────────►│             │
│    │                          │                            │             │
│    │                          │  speakeasy.verify(         │             │
│    │                          │    secret, code            │             │
│    │                          │  )                         │             │
│    │                          │                            │             │
│    │                    ┌─────┴─────┐                      │             │
│    │                    │   Valid   │                      │             │
│    │                    │   Code?   │                      │             │
│    │                    └─────┬─────┘                      │             │
│    │                          │                            │             │
│    │              ┌───────────┴───────────┐                │             │
│    │              ▼                       ▼                │             │
│    │          [Invalid]               [Valid]              │             │
│    │              │                       │                │             │
│    │              │               Try backup code?         │             │
│    │              │                       │                │             │
│    │              │               Generate JWT             │             │
│    │              │               Create session           │             │
│    │              │                       │                │             │
│    │◄─────────────│                       │                │             │
│    │  401 Invalid │                       │                │             │
│    │  MFA code    │                       │                │             │
│    │              │                       │                │             │
│    │◄─────────────────────────────────────│                │             │
│    │  { token: "eyJ...",                  │                │             │
│    │    refresh_token: "..." }            │                │             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Account Recovery Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Account Recovery Flow                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "Forgot Password" or "Can't access account"            │
│     │                                                                    │
│     ▼                                                                    │
│  2. GET /auth/recovery/options?email=user@example.com                   │
│     Response: { options: ['email', 'security_questions', 'backup_code']}│
│     │                                                                    │
│     ▼                                                                    │
│  3. User selects recovery method                                         │
│     │                                                                    │
│     ├─────────────────────────────────────────────────────────────────┐ │
│     │                                                                 │ │
│     ▼                                                                 │ │
│  [Email]                                                              │ │
│  POST /auth/password/reset-request                                    │ │
│  → Sends email with reset link                                        │ │
│  → User clicks link                                                   │ │
│  → POST /auth/password/reset { token, new_password }                  │ │
│     │                                                                 │ │
│     ▼                                                                 ▼ │
│  [Security Questions]                             [Backup Code]        │
│  GET /auth/security-questions/user                POST /auth/recovery/ │
│  → Shows user's questions (not answers)             backup-code        │
│  POST /auth/security-questions/verify             { email, code }      │
│  { answers: [...] }                               → Validates code     │
│  → If valid, allows password reset                → Disables MFA       │
│  → POST /auth/password/reset                      → Issues reset token │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Auth Component Hierarchy                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  App.tsx                                                                 │
│  └── AuthProvider (Context)                                             │
│      └── Router                                                          │
│          ├── /signin           → SignInPage                             │
│          │   ├── PasswordForm                                           │
│          │   ├── OAuthButtons (Google, Microsoft, GitHub)               │
│          │   └── PasskeyButton                                          │
│          │                                                               │
│          ├── /signup           → SignUpPage                             │
│          │   ├── SignUpForm                                             │
│          │   ├── PasswordStrengthIndicator                              │
│          │   └── OAuthButtons                                           │
│          │                                                               │
│          ├── /forgot-password  → ForgotPasswordPage                     │
│          │   └── EmailForm                                              │
│          │                                                               │
│          ├── /mfa-setup        → MFASetupPage (Protected)               │
│          │   ├── QRCodeDisplay                                          │
│          │   ├── ManualEntryCode                                        │
│          │   ├── VerificationInput                                      │
│          │   └── BackupCodesDisplay                                     │
│          │                                                               │
│          ├── /security-questions → SecurityQuestionsPage (Protected)   │
│          │   └── QuestionAnswerForm (x3)                                │
│          │                                                               │
│          └── /account-recovery → AccountRecoveryPage                    │
│              ├── RecoveryOptionsDisplay                                 │
│              ├── SecurityQuestionsVerify                                │
│              └── BackupCodeInput                                        │
│                                                                          │
│  Shared Components:                                                      │
│  ├── AuthLayout          - Centered card with logo                      │
│  ├── LoadingSpinner      - Form submission states                       │
│  ├── ErrorAlert          - API error display                            │
│  ├── SuccessAlert        - Success confirmations                        │
│  └── FormInput           - Styled form inputs with validation           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [security_design.md](./security_design.md) - Secrets management architecture
- [RBAC_INFRASTRUCTURE.md](../rbac/RBAC_INFRASTRUCTURE.md) - Permission system
- [STATE_MANAGEMENT.md](../state_management/STATE_MANAGEMENT.md) - Frontend state

---

**Version**: 1.0.0 | **Updated**: 2025-01-02 | **Author**: System Documentation
