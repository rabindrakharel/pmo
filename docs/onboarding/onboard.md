# Next-Generation Authentication System

> Complete documentation for the PMO authentication, MFA, and security infrastructure

**Version**: 1.0.0
**Updated**: 2025-12-07
**Architecture**: Centralized Person-Based Authentication

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Person Table Schema](#2-person-table-schema)
3. [Authentication Flows](#3-authentication-flows)
4. [API Endpoints Reference](#4-api-endpoints-reference)
5. [Auth Service Module](#5-auth-service-module)
6. [Frontend Pages & Components](#6-frontend-pages--components)
7. [Security Features](#7-security-features)
8. [Sequence Diagrams](#8-sequence-diagrams)
9. [UI/UX Design System](#9-uiux-design-system)

---

## 1. Architecture Overview

### Core Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CENTRALIZED AUTHENTICATION HUB                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│   │   Employee   │     │   Customer   │     │   Supplier   │                │
│   │    Table     │     │    Table     │     │    Table     │                │
│   │              │     │              │     │              │                │
│   │ - first_name │     │ - first_name │     │ - contact_   │                │
│   │ - last_name  │     │ - last_name  │     │   first_name │                │
│   │ - department │     │ - company    │     │ - company    │                │
│   │ - title      │     │ - cust_type  │     │ - address    │                │
│   │ - person_id ─┼─┐   │ - person_id ─┼─┐   │ - person_id ─┼─┐              │
│   └──────────────┘ │   └──────────────┘ │   └──────────────┘ │              │
│                    │                    │                    │              │
│                    └────────────┬───────┴────────────────────┘              │
│                                 │                                            │
│                                 ▼                                            │
│                    ┌────────────────────────┐                               │
│                    │      PERSON TABLE      │                               │
│                    │    (Auth Hub)          │                               │
│                    ├────────────────────────┤                               │
│                    │ - email (unique)       │                               │
│                    │ - password_hash        │                               │
│                    │ - entity_code          │                               │
│                    │ - mfa_secret           │                               │
│                    │ - mfa_backup_codes     │                               │
│                    │ - security_questions   │                               │
│                    │ - email_verified_flag  │                               │
│                    │ - account_locked_*     │                               │
│                    │ - login_history        │                               │
│                    └────────────────────────┘                               │
│                                 │                                            │
│                                 ▼                                            │
│                    ┌────────────────────────┐                               │
│                    │     JWT TOKEN          │                               │
│                    │   sub = person.id      │                               │
│                    │   entityCode           │                               │
│                    │   entityId             │                               │
│                    └────────────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Design Philosophy

| Principle | Implementation |
|-----------|----------------|
| **Single Source of Truth** | All authentication data in `app.person` |
| **Separation of Concerns** | Auth in person, profile data in entity tables |
| **Entity Agnostic** | Same auth flow for employee, customer, supplier |
| **Security First** | MFA, password history, account lockout |
| **Offline-Ready** | JWT tokens for stateless authentication |

---

## 2. Person Table Schema

### Complete DDL

```sql
-- ============================================================
-- PERSON TABLE (Centralized Authentication Hub)
-- ============================================================
-- Purpose: Unified authentication for all entity types
-- Entities: employee, customer, vendor, supplier, role
--
-- Design Principles:
-- 1. All auth credentials (passwords, MFA, security) stored HERE
-- 2. Personal details (name, address) stored in ENTITY tables
-- 3. Person table handles: auth, RBAC, messaging, notification
-- ============================================================

CREATE TABLE IF NOT EXISTS app.person (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE,

    -- ============================================================
    -- ENTITY LINKAGE
    -- ============================================================
    entity_code VARCHAR(100),  -- 'employee', 'customer', 'vendor', 'supplier', 'role'

    -- Direct entity references (only one should be populated based on entity_code)
    employee_id UUID REFERENCES app.employee(id),
    customer_id UUID REFERENCES app.customer(id),
    supplier_id UUID REFERENCES app.supplier(id),
    role_id UUID REFERENCES app.role(id),

    -- ============================================================
    -- CORE AUTHENTICATION
    -- ============================================================
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    password_changed_ts TIMESTAMPTZ,
    force_password_change_flag BOOLEAN DEFAULT false,
    password_history JSONB DEFAULT '[]',  -- Last 5 password hashes

    -- ============================================================
    -- MULTI-FACTOR AUTHENTICATION (MFA)
    -- ============================================================
    mfa_enabled_flag BOOLEAN DEFAULT false,
    mfa_method VARCHAR(50),  -- 'totp', 'sms', 'email', 'webauthn'
    mfa_secret VARCHAR(255),  -- TOTP secret key (encrypted)
    mfa_backup_codes JSONB DEFAULT '[]',  -- Hashed backup codes
    mfa_enabled_ts TIMESTAMPTZ,

    -- ============================================================
    -- SECURITY QUESTIONS
    -- ============================================================
    security_questions JSONB DEFAULT '[]',
    -- Format: [{ questionId: 0, question: "...", answerHash: "..." }, ...]
    security_questions_set_flag BOOLEAN DEFAULT false,

    -- ============================================================
    -- EMAIL VERIFICATION
    -- ============================================================
    email_verified_flag BOOLEAN DEFAULT false,
    email_verified_ts TIMESTAMPTZ,
    email_verification_token VARCHAR(255),
    email_verification_expires_ts TIMESTAMPTZ,

    -- ============================================================
    -- PHONE VERIFICATION
    -- ============================================================
    phone_number VARCHAR(50),
    phone_verified_flag BOOLEAN DEFAULT false,
    phone_verified_ts TIMESTAMPTZ,
    phone_verification_code VARCHAR(10),
    phone_verification_expires_ts TIMESTAMPTZ,

    -- ============================================================
    -- PASSWORD RESET
    -- ============================================================
    password_reset_token VARCHAR(255),
    password_reset_expires_ts TIMESTAMPTZ,

    -- ============================================================
    -- PASSKEY / WEBAUTHN (Future)
    -- ============================================================
    passkey_enabled_flag BOOLEAN DEFAULT false,
    passkey_credentials JSONB DEFAULT '[]',
    biometric_enabled_flag BOOLEAN DEFAULT false,

    -- ============================================================
    -- ACCOUNT SECURITY
    -- ============================================================
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until_ts TIMESTAMPTZ,
    account_locked_reason VARCHAR(100),
    permanent_lock_flag BOOLEAN DEFAULT false,

    -- ============================================================
    -- SESSION & LOGIN TRACKING
    -- ============================================================
    last_login_ts TIMESTAMPTZ,
    last_login_ip VARCHAR(50),
    login_count INTEGER DEFAULT 0,
    active_sessions JSONB DEFAULT '[]',
    trusted_devices JSONB DEFAULT '[]',
    login_history JSONB DEFAULT '[]',
    -- Format: [{ ts, ip, userAgent, success, method }, ...]

    -- ============================================================
    -- TERMS & CONSENT
    -- ============================================================
    tos_accepted_flag BOOLEAN DEFAULT false,
    tos_accepted_ts TIMESTAMPTZ,
    tos_version VARCHAR(20),
    privacy_policy_accepted_flag BOOLEAN DEFAULT false,
    privacy_policy_accepted_ts TIMESTAMPTZ,
    marketing_consent_flag BOOLEAN DEFAULT false,

    -- ============================================================
    -- NOTIFICATION PREFERENCES
    -- ============================================================
    notification_preferences JSONB DEFAULT '{
        "email": true,
        "push": true,
        "sms": false,
        "inApp": true
    }',

    -- ============================================================
    -- STANDARD FIELDS
    -- ============================================================
    active_flag BOOLEAN DEFAULT true,
    from_ts TIMESTAMPTZ DEFAULT NOW(),
    to_ts TIMESTAMPTZ,
    created_ts TIMESTAMPTZ DEFAULT NOW(),
    updated_ts TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER DEFAULT 1,

    -- ============================================================
    -- CONSTRAINTS
    -- ============================================================
    CONSTRAINT person_email_unique UNIQUE (email),
    CONSTRAINT person_entity_code_check CHECK (
        entity_code IN ('employee', 'customer', 'vendor', 'supplier', 'role')
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_person_email ON app.person(email);
CREATE INDEX IF NOT EXISTS idx_person_entity_code ON app.person(entity_code);
CREATE INDEX IF NOT EXISTS idx_person_employee_id ON app.person(employee_id);
CREATE INDEX IF NOT EXISTS idx_person_customer_id ON app.person(customer_id);
CREATE INDEX IF NOT EXISTS idx_person_active ON app.person(active_flag);
```

### Field Categories

| Category | Fields | Purpose |
|----------|--------|---------|
| **Identity** | `id`, `code`, `email` | Unique identifiers |
| **Entity Link** | `entity_code`, `employee_id`, `customer_id`, etc. | Links to profile tables |
| **Password** | `password_hash`, `password_history`, `force_password_change_flag` | Password management |
| **MFA** | `mfa_enabled_flag`, `mfa_secret`, `mfa_backup_codes` | Two-factor authentication |
| **Security** | `security_questions`, `account_locked_*`, `failed_login_attempts` | Account protection |
| **Verification** | `email_verified_flag`, `phone_verified_flag` | Identity verification |
| **Session** | `login_history`, `trusted_devices`, `active_sessions` | Session management |

---

## 3. Authentication Flows

### 3.1 Customer Sign-Up Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER SIGN-UP FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
     │   STEP 1    │     │   STEP 2    │     │   STEP 3    │     │  STEP 4  │
     │  Account    │────▶│  Password   │────▶│   Verify    │────▶│ Complete │
     │  Details    │     │   Setup     │     │   Email     │     │          │
     └─────────────┘     └─────────────┘     └─────────────┘     └──────────┘
           │                   │                   │                   │
           │                   │                   │                   │
           ▼                   ▼                   ▼                   ▼
     ┌───────────┐       ┌───────────┐       ┌───────────┐       ┌───────────┐
     │ Collect:  │       │ Validate: │       │ Send:     │       │ Store:    │
     │ - name    │       │ - policy  │       │ - 6-digit │       │ - token   │
     │ - email   │       │ - strength│       │   code    │       │ - session │
     │ - type    │       │ - match   │       │           │       │           │
     └───────────┘       └───────────┘       └───────────┘       └───────────┘

                              DATABASE OPERATIONS
     ┌─────────────────────────────────────────────────────────────────────────┐
     │                                                                         │
     │  1. Check email uniqueness in app.person                               │
     │  2. Hash password with bcrypt (salt rounds: 12)                        │
     │  3. Generate customer code (APP-XXXX)                                  │
     │  4. INSERT into app.person (email, password_hash, entity_code)         │
     │  5. INSERT into app.customer (first_name, last_name, person_id)        │
     │  6. UPDATE app.person SET customer_id = [new customer id]              │
     │  7. Generate JWT token (subject = person.id)                           │
     │  8. Send verification email                                            │
     │                                                                         │
     └─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Sign-In with MFA Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SIGN-IN WITH MFA FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

     User                   Frontend                  API                  DB
       │                       │                       │                    │
       │  Enter credentials    │                       │                    │
       │──────────────────────▶│                       │                    │
       │                       │  POST /login/mfa      │                    │
       │                       │──────────────────────▶│                    │
       │                       │                       │  Find person       │
       │                       │                       │───────────────────▶│
       │                       │                       │◀───────────────────│
       │                       │                       │                    │
       │                       │                       │  Check locks       │
       │                       │                       │  Verify password   │
       │                       │                       │                    │
       │                       │                       │                    │
       │                       │                       │                    │
       │              ┌────────┴────────┐              │                    │
       │              │  MFA Enabled?   │              │                    │
       │              └────────┬────────┘              │                    │
       │                       │                       │                    │
       │         ┌─────────────┼─────────────┐         │                    │
       │         │ YES         │         NO  │         │                    │
       │         ▼             │             ▼         │                    │
       │  ┌────────────┐       │      ┌────────────┐   │                    │
       │  │ Return     │       │      │ Return     │   │                    │
       │  │ mfaToken   │       │      │ JWT token  │   │                    │
       │  │ requiresMFA│       │      │ + user     │   │                    │
       │  └────────────┘       │      └────────────┘   │                    │
       │         │             │             │         │                    │
       │         ▼             │             │         │                    │
       │  ┌────────────┐       │             │         │                    │
       │  │ Show MFA   │       │             │         │                    │
       │  │ input      │       │             │         │                    │
       │  └────────────┘       │             │         │                    │
       │         │             │             │         │                    │
       │  Enter TOTP code      │             │         │                    │
       │─────────────────────▶ │             │         │                    │
       │                       │ POST /login/mfa/verify│                    │
       │                       │──────────────────────▶│                    │
       │                       │                       │  Verify TOTP       │
       │                       │                       │  or backup code    │
       │                       │◀──────────────────────│                    │
       │                       │  JWT token + user     │                    │
       │◀──────────────────────│                       │                    │
       │                       │                       │                    │
```

### 3.3 MFA Setup Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MFA SETUP FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  START   │───▶│  SCAN    │───▶│  VERIFY  │───▶│  BACKUP  │───▶│ COMPLETE │
  │          │    │  QR CODE │    │  CODE    │    │  CODES   │    │          │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
       │               │               │               │               │
       ▼               ▼               ▼               ▼               ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Explain  │    │ Generate │    │ User     │    │ Display  │    │ Enable   │
  │ MFA      │    │ TOTP     │    │ enters   │    │ 10 codes │    │ mfa_flag │
  │ benefits │    │ secret   │    │ 6-digit  │    │ for      │    │ = true   │
  │          │    │ + QR URI │    │ code     │    │ recovery │    │          │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘

                         API Operations:
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │  POST /mfa/setup                                                           │
  │  ─────────────────                                                         │
  │  1. Generate 32-char base32 secret (generateTOTPSecret)                    │
  │  2. Create QR URI: otpauth://totp/HuronPMO:{email}?secret={secret}         │
  │  3. Generate 10 backup codes (XXXX-XXXX format)                            │
  │  4. Hash backup codes with bcrypt                                          │
  │  5. Store secret + hashed codes in person table (NOT enabled yet)          │
  │  6. Return: { secret, qrCodeUri, backupCodes }                             │
  │                                                                             │
  │  POST /mfa/verify                                                          │
  │  ─────────────────                                                         │
  │  1. Get stored secret from person table                                    │
  │  2. Verify TOTP code using HMAC-SHA1                                       │
  │  3. Allow ±1 time window (30 seconds tolerance)                            │
  │  4. If valid: SET mfa_enabled_flag = true, mfa_method = 'totp'            │
  │                                                                             │
  └─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Password Reset Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PASSWORD RESET FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
     │   REQUEST   │─────────────▶│   VERIFY    │─────────────▶│    RESET    │
     │   RESET     │              │   IDENTITY  │              │   PASSWORD  │
     └─────────────┘              └─────────────┘              └─────────────┘
           │                            │                            │
           │                            │                            │
           ▼                            ▼                            ▼

     ┌───────────────────┐    ┌─────────────────────┐    ┌───────────────────┐
     │ Methods:          │    │ Verification:       │    │ Validation:       │
     │                   │    │                     │    │                   │
     │ 1. Email link     │    │ - Click email link  │    │ - Min 8 chars     │
     │ 2. Security Q's   │    │ - Answer 3 Q's      │    │ - Uppercase       │
     │ 3. Backup code    │    │ - Use backup code   │    │ - Lowercase       │
     │                   │    │                     │    │ - Number          │
     └───────────────────┘    └─────────────────────┘    │ - Special char    │
                                                         │ - Not in history  │
                                                         └───────────────────┘

                              TOKEN LIFECYCLE
     ┌─────────────────────────────────────────────────────────────────────────┐
     │                                                                         │
     │  1. Generate 64-char secure random token (crypto.randomBytes)          │
     │  2. Set expiration: 1 hour from generation                             │
     │  3. Store in person.password_reset_token                               │
     │  4. Store expiry in person.password_reset_expires_ts                   │
     │  5. On use: validate token, check expiry, then NULLIFY both fields     │
     │  6. Add new password hash to password_history (keep last 5)            │
     │                                                                         │
     └─────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Account Recovery Options

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ACCOUNT RECOVERY OPTIONS                               │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │  Enter Email     │
                              │  Address         │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │  Check Recovery  │
                              │  Options         │
                              └────────┬─────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
                 ▼                     ▼                     ▼
        ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
        │  EMAIL RESET   │    │   SECURITY     │    │  BACKUP CODE   │
        │                │    │   QUESTIONS    │    │                │
        ├────────────────┤    ├────────────────┤    ├────────────────┤
        │ Always         │    │ If configured  │    │ If MFA enabled │
        │ available      │    │ (3 questions)  │    │ & codes exist  │
        │                │    │                │    │                │
        │ Sends reset    │    │ Answer all 3   │    │ Use one of 10  │
        │ link to email  │    │ correctly      │    │ backup codes   │
        └────────────────┘    └────────────────┘    └────────────────┘
                 │                     │                     │
                 │                     │                     │
                 └─────────────────────┴─────────────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │  Recovery Token  │
                              │  Generated       │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │  Password Reset  │
                              │  Page            │
                              └──────────────────┘
```

---

## 4. API Endpoints Reference

### Authentication Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/login` | No | Standard login |
| `POST` | `/api/v1/auth/login/mfa` | No | Login with MFA support |
| `POST` | `/api/v1/auth/login/mfa/verify` | No | Complete MFA verification |
| `POST` | `/api/v1/auth/logout` | Yes | Logout (token cleanup) |
| `GET` | `/api/v1/auth/me` | Yes | Get current user profile |

### Customer Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/customer/signup` | No | Create customer account |
| `POST` | `/api/v1/auth/customer/signin` | No | Customer login |
| `GET` | `/api/v1/auth/customer/me` | Yes | Get customer profile |
| `PUT` | `/api/v1/auth/customer/configure` | Yes | Configure entity access |

### MFA Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/mfa/setup` | Yes | Initialize MFA setup |
| `POST` | `/api/v1/auth/mfa/verify` | Yes | Verify & enable MFA |
| `POST` | `/api/v1/auth/mfa/disable` | Yes | Disable MFA |
| `GET` | `/api/v1/auth/mfa/status` | Yes | Get MFA status |
| `POST` | `/api/v1/auth/mfa/backup-codes/regenerate` | Yes | Regenerate backup codes |

### Email Verification Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/email/send-verification` | Yes | Send verification code |
| `POST` | `/api/v1/auth/email/verify` | Yes | Verify email code |

### Password Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/password/validate` | No | Validate password policy |
| `POST` | `/api/v1/auth/password/reset-request` | No | Request password reset |
| `POST` | `/api/v1/auth/password/reset` | No | Reset password with token |
| `POST` | `/api/v1/auth/password/change` | Yes | Change password |

### Security Questions Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/auth/security-questions/list` | No | Get available questions |
| `POST` | `/api/v1/auth/security-questions/setup` | Yes | Setup security questions |
| `GET` | `/api/v1/auth/security-questions/user` | Yes | Get user's questions |
| `POST` | `/api/v1/auth/security-questions/verify` | No | Verify answers (recovery) |

### Account Recovery Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/recovery/options` | No | Get recovery options |
| `POST` | `/api/v1/auth/recovery/backup-code` | No | Recover with backup code |

---

## 5. Auth Service Module

### Location

```
apps/api/src/services/auth.service.ts
```

### Core Functions

#### TOTP MFA Functions

```typescript
// Generate 32-character base32 secret for TOTP
function generateTOTPSecret(): string

// Generate current TOTP code (6 digits)
function generateTOTP(secret: string, time?: number): string

// Verify TOTP code with ±1 window tolerance
function verifyTOTP(secret: string, code: string, window?: number): boolean

// Generate otpauth:// URI for QR code
function generateTOTPUri(secret: string, email: string, issuer?: string): string
```

#### Backup Codes Functions

```typescript
// Generate N backup codes (format: XXXX-XXXX)
function generateBackupCodes(count?: number): string[]

// Hash all backup codes with bcrypt
async function hashBackupCodes(codes: string[]): Promise<string[]>

// Verify backup code and return index if valid
async function verifyBackupCode(code: string, hashedCodes: string[]): Promise<{
  valid: boolean;
  index: number;
}>
```

#### Security Questions Functions

```typescript
// Hash security answer (case-insensitive)
async function hashSecurityAnswer(answer: string): Promise<string>

// Verify answer against hash
async function verifySecurityAnswer(answer: string, hash: string): Promise<boolean>

// Available security questions
const SECURITY_QUESTIONS: string[] = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was your childhood nickname?",
  // ... 10 total questions
]
```

#### Password Policy Functions

```typescript
interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

// Validate password against policy
function validatePasswordPolicy(password: string): PasswordPolicyResult

// Check if password was previously used
async function isPasswordPreviouslyUsed(
  password: string,
  history: string[]
): Promise<boolean>
```

#### Token Generation Functions

```typescript
// Generate secure random token
function generateVerificationToken(length?: number): string

// Generate password reset token with expiry
function generatePasswordResetToken(): { token: string; expiresAt: Date }

// Generate 6-digit email verification code
function generateEmailVerificationCode(): string
```

#### Login History Functions

```typescript
interface LoginHistoryEntry {
  ts: string;
  ip: string;
  userAgent: string;
  success: boolean;
  method: 'password' | 'mfa' | 'sso';
}

function createLoginHistoryEntry(
  ip: string,
  userAgent: string,
  success: boolean,
  method: string
): LoginHistoryEntry
```

---

## 6. Frontend Pages & Components

### Page Structure

```
apps/web/src/pages/auth/
├── index.ts                    # Exports all auth pages
├── SignUpPage.tsx              # Multi-step signup wizard
├── SignInPage.tsx              # Login with MFA support
├── MFASetupPage.tsx            # MFA configuration
├── ForgotPasswordPage.tsx      # Password reset flow
├── AccountRecoveryPage.tsx     # Recovery options
└── SecurityQuestionsPage.tsx   # Security questions setup
```

### Route Configuration

```typescript
// In App.tsx

// Public auth routes (no authentication required)
<Route path="/signin" element={<SignInPage />} />
<Route path="/signup" element={<SignUpPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/account-recovery" element={<AccountRecoveryPage />} />

// Protected auth routes (require authentication)
<Route path="/mfa/setup" element={<ProtectedRoute><MFASetupPage /></ProtectedRoute>} />
<Route path="/security-questions/setup" element={<ProtectedRoute><SecurityQuestionsPage /></ProtectedRoute>} />
```

### Component Features

#### SignUpPage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SIGN UP PAGE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Features:                                                                   │
│  ├── 3-step wizard (Account → Password → Verify)                            │
│  ├── Visual step indicator with progress                                     │
│  ├── Real-time password policy validation                                    │
│  ├── Password strength meter (weak/fair/good/strong)                        │
│  ├── Customer type selection (residential/commercial/municipal/industrial)  │
│  ├── Email verification code input                                          │
│  ├── Skip verification option                                                │
│  └── Terms of service agreement                                              │
│                                                                              │
│  State Management:                                                           │
│  ├── currentStep: 0 | 1 | 2                                                 │
│  ├── accountData: { first_name, last_name, email, cust_type }              │
│  ├── passwordData: { password, confirmPassword }                            │
│  ├── passwordPolicy: { valid, errors, strength }                            │
│  └── tempToken: string (for verification step)                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### SignInPage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SIGN IN PAGE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Features:                                                                   │
│  ├── Email/password authentication                                          │
│  ├── MFA code input (when required)                                         │
│  ├── Backup code fallback option                                            │
│  ├── SSO buttons (Google, Microsoft)                                        │
│  ├── Remember me checkbox                                                    │
│  ├── Forgot password link                                                    │
│  └── Account recovery link                                                   │
│                                                                              │
│  MFA Flow:                                                                   │
│  1. Submit email/password                                                    │
│  2. If requiresMFA=true, show MFA input                                     │
│  3. Submit mfaToken + TOTP code                                             │
│  4. Receive JWT token on success                                            │
│                                                                              │
│  State Management:                                                           │
│  ├── requiresMFA: boolean                                                   │
│  ├── mfaToken: string | null                                                │
│  ├── useBackupCode: boolean                                                 │
│  └── error: string | null                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### MFASetupPage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MFA SETUP PAGE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Features:                                                                   │
│  ├── 4-step setup (Start → Scan QR → Verify → Backup)                       │
│  ├── QR code display for authenticator apps                                 │
│  ├── Manual secret key with copy button                                     │
│  ├── 6-digit TOTP verification                                              │
│  ├── 10 backup codes display                                                │
│  ├── Copy codes / Download as file                                          │
│  └── Confirmation checkbox before completion                                 │
│                                                                              │
│  Dependencies:                                                               │
│  └── qrcode.react (for QR code generation)                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Security Features

### Password Policy

```typescript
const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  historyCount: 5,  // Cannot reuse last 5 passwords
};

// Strength calculation
// weak:   < 30% of requirements
// fair:   30-60% of requirements
// good:   60-90% of requirements
// strong: > 90% of requirements + length >= 12
```

### Account Lockout

```typescript
const LOCKOUT_POLICY = {
  maxFailedAttempts: 5,
  lockoutDuration: 30,  // minutes
  permanentLockAfter: null,  // manual only
};

// Lock triggers:
// - 5 failed login attempts → 30-minute lock
// - Suspicious activity → manual permanent lock
```

### Token Security

| Token Type | Length | Expiry | Format |
|------------|--------|--------|--------|
| JWT Access | Variable | 24 hours | JWT |
| MFA Temp | Variable | 5 minutes | JWT |
| Password Reset | 64 chars | 1 hour | Hex |
| Email Verify | 6 digits | 15 minutes | Numeric |
| Backup Code | 9 chars | Never | XXXX-XXXX |

### Secure Hashing

```typescript
// Password hashing
bcrypt.hash(password, 12)  // 12 salt rounds

// Security answer hashing
bcrypt.hash(answer.toLowerCase().trim(), 10)  // Case-insensitive

// Backup code hashing
bcrypt.hash(code, 10)  // Each code hashed individually
```

---

## 8. Sequence Diagrams

### Complete Login Sequence

```
┌────────┐          ┌────────────┐          ┌────────────┐          ┌──────────┐
│ Client │          │  Frontend  │          │    API     │          │ Database │
└───┬────┘          └─────┬──────┘          └─────┬──────┘          └────┬─────┘
    │                     │                       │                      │
    │  Enter credentials  │                       │                      │
    │────────────────────>│                       │                      │
    │                     │                       │                      │
    │                     │  POST /login/mfa      │                      │
    │                     │──────────────────────>│                      │
    │                     │                       │                      │
    │                     │                       │  SELECT person       │
    │                     │                       │─────────────────────>│
    │                     │                       │                      │
    │                     │                       │  person record       │
    │                     │                       │<─────────────────────│
    │                     │                       │                      │
    │                     │                       │  Check:              │
    │                     │                       │  - permanent_lock    │
    │                     │                       │  - account_locked    │
    │                     │                       │  - password_hash     │
    │                     │                       │                      │
    │                     │                       │                      │
    │                     │     ┌─────────────────┴───────────────┐      │
    │                     │     │ mfa_enabled_flag = true?        │      │
    │                     │     └─────────────────┬───────────────┘      │
    │                     │                       │                      │
    │                     │  { requiresMFA, mfaToken }                   │
    │                     │<──────────────────────│                      │
    │                     │                       │                      │
    │  Show MFA input     │                       │                      │
    │<────────────────────│                       │                      │
    │                     │                       │                      │
    │  Enter TOTP code    │                       │                      │
    │────────────────────>│                       │                      │
    │                     │                       │                      │
    │                     │  POST /login/mfa/verify                      │
    │                     │──────────────────────>│                      │
    │                     │                       │                      │
    │                     │                       │  Verify JWT (mfaToken)
    │                     │                       │  Verify TOTP code    │
    │                     │                       │                      │
    │                     │                       │  SELECT entity       │
    │                     │                       │─────────────────────>│
    │                     │                       │                      │
    │                     │                       │  UPDATE login_history│
    │                     │                       │─────────────────────>│
    │                     │                       │                      │
    │                     │  { token, user }      │                      │
    │                     │<──────────────────────│                      │
    │                     │                       │                      │
    │  Store token        │                       │                      │
    │  Navigate to /welcome                       │                      │
    │<────────────────────│                       │                      │
    │                     │                       │                      │
```

### MFA Setup Sequence

```
┌────────┐          ┌────────────┐          ┌────────────┐          ┌──────────┐
│ Client │          │  Frontend  │          │    API     │          │ Database │
└───┬────┘          └─────┬──────┘          └─────┬──────┘          └────┬─────┘
    │                     │                       │                      │
    │  Click "Setup MFA"  │                       │                      │
    │────────────────────>│                       │                      │
    │                     │                       │                      │
    │                     │  POST /mfa/setup      │                      │
    │                     │──────────────────────>│                      │
    │                     │                       │                      │
    │                     │                       │  Generate:           │
    │                     │                       │  - TOTP secret       │
    │                     │                       │  - QR URI            │
    │                     │                       │  - 10 backup codes   │
    │                     │                       │                      │
    │                     │                       │  UPDATE person       │
    │                     │                       │  SET mfa_secret,     │
    │                     │                       │      mfa_backup_codes│
    │                     │                       │─────────────────────>│
    │                     │                       │                      │
    │                     │  { secret, qrCodeUri, │                      │
    │                     │    backupCodes }      │                      │
    │                     │<──────────────────────│                      │
    │                     │                       │                      │
    │  Display QR code    │                       │                      │
    │<────────────────────│                       │                      │
    │                     │                       │                      │
    │  Scan with app      │                       │                      │
    │  Enter TOTP code    │                       │                      │
    │────────────────────>│                       │                      │
    │                     │                       │                      │
    │                     │  POST /mfa/verify     │                      │
    │                     │──────────────────────>│                      │
    │                     │                       │                      │
    │                     │                       │  Verify TOTP code    │
    │                     │                       │                      │
    │                     │                       │  UPDATE person       │
    │                     │                       │  SET mfa_enabled=true│
    │                     │                       │─────────────────────>│
    │                     │                       │                      │
    │                     │  { success: true }    │                      │
    │                     │<──────────────────────│                      │
    │                     │                       │                      │
    │  Show backup codes  │                       │                      │
    │<────────────────────│                       │                      │
    │                     │                       │                      │
```

---

## 9. UI/UX Design System

### Visual Design Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DESIGN SYSTEM                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  COLOR PALETTE                                                               │
│  ─────────────                                                               │
│  Primary:     slate-600 (#475569)   - Buttons, links                        │
│  Secondary:   slate-800 (#1e293b)   - Headers, emphasis                     │
│  Success:     green-500 (#22c55e)   - Success states, checkmarks            │
│  Warning:     yellow-500 (#eab308)  - Warnings, cautions                    │
│  Error:       red-500 (#ef4444)     - Errors, validations                   │
│  Background:  dark-100 (#f8fafc)    - Page background                       │
│                                                                              │
│  TYPOGRAPHY                                                                  │
│  ──────────                                                                  │
│  Headings:    text-2xl font-bold (24px, 700)                                │
│  Body:        text-sm (14px, 400)                                           │
│  Labels:      text-sm font-medium (14px, 500)                               │
│  Mono:        font-mono tracking-widest (for codes)                         │
│                                                                              │
│  SPACING                                                                     │
│  ────────                                                                    │
│  Container:   max-w-md (448px)                                              │
│  Section:     space-y-6 (24px)                                              │
│  Form fields: space-y-4 (16px)                                              │
│                                                                              │
│  COMPONENTS                                                                  │
│  ──────────                                                                  │
│  Buttons:     rounded-md shadow-sm py-2.5 px-4                              │
│  Inputs:      rounded-md border-dark-300 focus:ring-slate-500               │
│  Cards:       bg-white rounded-lg shadow-sm border                          │
│  Icons:       Lucide React, h-4 w-4 or h-5 w-5                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Page Layout Template

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │                             │  │                                     │   │
│  │        LEFT PANEL           │  │          RIGHT PANEL                │   │
│  │        (Form)               │  │          (Marketing)                │   │
│  │                             │  │                                     │   │
│  │  ┌───────────────────────┐  │  │  ┌─────────────────────────────┐   │   │
│  │  │ ← Back to home        │  │  │  │                             │   │   │
│  │  └───────────────────────┘  │  │  │   Hero Message              │   │   │
│  │                             │  │  │                             │   │   │
│  │  ┌───────────────────────┐  │  │  │   • Feature 1               │   │   │
│  │  │ [Logo] Huron PMO      │  │  │  │   • Feature 2               │   │   │
│  │  └───────────────────────┘  │  │  │   • Feature 3               │   │   │
│  │                             │  │  │                             │   │   │
│  │  ┌───────────────────────┐  │  │  └─────────────────────────────┘   │   │
│  │  │ Page Title            │  │  │                                     │   │
│  │  │ Subtitle / Link       │  │  │  ┌─────────────────────────────┐   │   │
│  │  └───────────────────────┘  │  │  │                             │   │   │
│  │                             │  │  │   Testimonial               │   │   │
│  │  ┌───────────────────────┐  │  │  │   Quote                     │   │   │
│  │  │                       │  │  │  │                             │   │   │
│  │  │   FORM CONTENT        │  │  │  │   - Author Name             │   │   │
│  │  │                       │  │  │  │   - Title                   │   │   │
│  │  │   [Input fields]      │  │  │  │                             │   │   │
│  │  │   [Buttons]           │  │  │  └─────────────────────────────┘   │   │
│  │  │                       │  │  │                                     │   │
│  │  └───────────────────────┘  │  │                                     │   │
│  │                             │  │                                     │   │
│  │  ┌───────────────────────┐  │  │                                     │   │
│  │  │ Terms & Policies      │  │  │                                     │   │
│  │  └───────────────────────┘  │  │                                     │   │
│  │                             │  │                                     │   │
│  └─────────────────────────────┘  └─────────────────────────────────────┘   │
│                                                                              │
│        flex-1 (responsive)              flex-1 (hidden on mobile)           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step Indicator Component

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STEP INDICATOR                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌───┐              ┌───┐              ┌───┐              ┌───┐           │
│    │ ✓ │──────────────│ 2 │──────────────│ 3 │──────────────│ 4 │           │
│    └───┘              └───┘              └───┘              └───┘           │
│   Account           Password            Verify           Complete           │
│                                                                              │
│   States:                                                                    │
│   ├── Completed: bg-green-500, text-white, checkmark icon                   │
│   ├── Current:   bg-slate-600, text-white, step number                      │
│   └── Pending:   bg-dark-200, text-dark-600, step number                    │
│                                                                              │
│   Connector:                                                                 │
│   ├── Completed: bg-green-500                                               │
│   └── Pending:   bg-dark-200                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Password Strength Indicator

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PASSWORD STRENGTH INDICATOR                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Password strength                                        Strong           │
│   ┌────────────────────────────────────────────────────────────────┐        │
│   │████████████████████████████████████████████████████████████████│        │
│   └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│   Strength Levels:                                                           │
│   ├── weak:   w-1/4, bg-red-500,    text-red-600                           │
│   ├── fair:   w-1/2, bg-yellow-500, text-yellow-600                        │
│   ├── good:   w-3/4, bg-blue-500,   text-blue-600                          │
│   └── strong: w-full, bg-green-500, text-green-600                         │
│                                                                              │
│   Error List:                                                                │
│   ├── ✗ Password must be at least 8 characters                             │
│   ├── ✗ Password must contain an uppercase letter                          │
│   └── ✗ Password must contain a number                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Verification Code Input

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VERIFICATION CODE INPUT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │                         0 0 0 0 0 0                         │           │
│   └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
│   Styling:                                                                   │
│   ├── text-center text-2xl tracking-widest                                  │
│   ├── placeholder-dark-400                                                  │
│   ├── maxLength={6}                                                         │
│   └── Numbers only (input filter)                                           │
│                                                                              │
│   For Backup Codes:                                                          │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │                      X X X X - X X X X                      │           │
│   └─────────────────────────────────────────────────────────────┘           │
│   ├── font-mono                                                             │
│   └── maxLength={9}                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SSO Buttons

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SSO BUTTONS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ────────────────── Or continue with ──────────────────                    │
│                                                                              │
│   ┌─────────────────────────┐    ┌─────────────────────────┐                │
│   │   [G logo]  Google      │    │   [M logo]  Microsoft   │                │
│   └─────────────────────────┘    └─────────────────────────┘                │
│                                                                              │
│   Styling:                                                                   │
│   ├── border border-dark-300                                                │
│   ├── bg-white hover:bg-dark-50                                             │
│   ├── py-2.5 px-4                                                           │
│   └── grid grid-cols-2 gap-3                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference

### Environment Variables

```bash
# API Configuration
VITE_API_URL=http://localhost:4000

# JWT Configuration
JWT_SECRET=your-secure-secret
JWT_EXPIRES_IN=24h

# MFA Configuration
MFA_ISSUER=HuronPMO
```

### Common Error Codes

| Code | Message | Resolution |
|------|---------|------------|
| 401 | Invalid credentials | Check email/password |
| 401 | Invalid MFA code | Check TOTP or use backup code |
| 423 | Account temporarily locked | Wait 30 minutes or use recovery |
| 423 | Account permanently locked | Contact administrator |
| 400 | MFA is already enabled | Check `/mfa/status` first |
| 400 | Email is already verified | Skip verification step |
| 400 | Cannot reuse a previous password | Choose different password |

### Testing Credentials

```
Email: james.miller@huronhome.ca
Password: password123
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-07
**Author**: PMO Development Team
