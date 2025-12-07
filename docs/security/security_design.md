# Security Design: Secrets Management Architecture

## Overview

This document describes how the PMO platform manages secrets, the request flows for different authentication scenarios, and how backend services interact with AWS Secrets Manager.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser/Mobile)                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  FASTIFY API                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         SERVER STARTUP (server.ts)                          ││
│  │  1. await loadSecrets()     ← Fetches ALL secrets from Secrets Manager      ││
│  │  2. secrets cached in memory (secretsCache)                                 ││
│  │  3. Register JWT plugin with secrets.jwtSecret                              ││
│  │  4. Start Fastify server                                                    ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                        │                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Auth Routes  │  │ OAuth Routes │  │ Chat Routes  │  │ Voice Routes         │ │
│  │              │  │              │  │              │  │                      │ │
│  │ Uses:        │  │ Uses:        │  │ Uses:        │  │ Uses:                │ │
│  │ • jwtSecret  │  │ • google.*   │  │ • openaiKey  │  │ • deepgramApiKey     │ │
│  │ • database   │  │ • microsoft.*│  │              │  │ • elevenLabsApiKey   │ │
│  │              │  │ • github.*   │  │              │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
          │                  │                  │                  │
          ▼                  ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │ Google/MS/GH    │ │    OpenAI API   │ │ Deepgram/11Labs │
│   (database)    │ │ OAuth APIs      │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Secrets Manager Structure (6 Secrets)

| Secret Name | Monthly Cost | Contents |
|-------------|--------------|----------|
| `cohuron/prod/database` | $0.40 | host, port, database, username, password, url |
| `cohuron/prod/auth` | $0.40 | jwt_secret, jwt_expires_in |
| `cohuron/prod/oauth` | $0.40 | google.{client_id, client_secret}, microsoft.*, github.* |
| `cohuron/prod/api-keys` | $0.40 | openai.api_key, deepgram.api_key, eleven_labs.api_key |
| `cohuron/prod/redis` | $0.40 | host, port, password, url |
| `cohuron/prod/rabbitmq` | $0.40 | url |
| **Total** | **~$2.40/month** | |

---

## Request Flows

### 1. Application Startup Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            SERVER STARTUP FLOW                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  server.ts                                                                   │
│  ─────────                                                                   │
│  import { loadSecrets } from '@/config/secrets.js';                         │
│  import secrets from '@/config/secrets.js';                                 │
│                                                                              │
│  // Step 1: Load all secrets at startup (ONCE)                              │
│  await loadSecrets();                                                        │
│       │                                                                      │
│       ▼                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  loadSecrets() in secrets.ts                                           │ │
│  │  ────────────────────────────                                          │ │
│  │  if (config.features.useSecretsManager) {                              │ │
│  │    // PRODUCTION: Fetch from AWS Secrets Manager                       │ │
│  │    for each secretName in ['database', 'auth', 'oauth', ...]:          │ │
│  │      const value = await secretsClient.send(                           │ │
│  │        new GetSecretValueCommand({ SecretId: secretName })             │ │
│  │      );                                                                 │ │
│  │      secretsCache[secretName] = JSON.parse(value.SecretString);        │ │
│  │  } else {                                                              │ │
│  │    // DEVELOPMENT: Load from process.env                               │ │
│  │    secretsCache = buildSecretsFromEnv();                               │ │
│  │  }                                                                      │ │
│  │  secretsLoaded = true;                                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│       │                                                                      │
│       ▼                                                                      │
│  // Step 2: Register JWT with secret from cache                             │
│  await fastify.register(jwt, {                                              │
│    secret: secrets.jwtSecret  ← getter reads from secretsCache              │
│  });                                                                         │
│       │                                                                      │
│       ▼                                                                      │
│  // Step 3: Start listening                                                  │
│  await fastify.listen({ port: 4000 });                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2. User Login Flow (Password-Based)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         USER LOGIN FLOW (Password)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Client                          API                         Database        │
│  ──────                          ───                         ────────        │
│    │                              │                              │           │
│    │  POST /api/v1/auth/login     │                              │           │
│    │  { email, password }         │                              │           │
│    │─────────────────────────────►│                              │           │
│    │                              │                              │           │
│    │                              │  SELECT password_hash        │           │
│    │                              │  FROM app.person             │           │
│    │                              │  WHERE email = $1            │           │
│    │                              │─────────────────────────────►│           │
│    │                              │                              │           │
│    │                              │◄─────────────────────────────│           │
│    │                              │  { password_hash: "$2b$..." }│           │
│    │                              │                              │           │
│    │                              │                              │           │
│    │                   ┌──────────┴──────────┐                   │           │
│    │                   │ bcrypt.compare(     │                   │           │
│    │                   │   password,         │                   │           │
│    │                   │   password_hash     │                   │           │
│    │                   │ )                   │                   │           │
│    │                   └──────────┬──────────┘                   │           │
│    │                              │                              │           │
│    │                   ┌──────────┴──────────┐                   │           │
│    │                   │ jwt.sign(           │                   │           │
│    │                   │   { sub: personId },│                   │           │
│    │                   │   secrets.jwtSecret │ ← From cache      │           │
│    │                   │ )                   │   (NOT Secrets    │           │
│    │                   └──────────┬──────────┘    Manager call)  │           │
│    │                              │                              │           │
│    │◄─────────────────────────────│                              │           │
│    │  { token: "eyJhbG..." }      │                              │           │
│    │                              │                              │           │
│                                                                              │
│  NOTE: Password is stored in DATABASE (hashed), NOT Secrets Manager          │
│  NOTE: JWT secret is from CACHE (loaded at startup), no network call        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3. OAuth SSO Flow (Google/Microsoft/GitHub)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            OAuth SSO FLOW                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Client          API              Secrets Cache         OAuth Provider       │
│  ──────          ───              ─────────────         ──────────────       │
│    │              │                     │                     │              │
│    │  GET /auth/google/authorize        │                     │              │
│    │─────────────►│                     │                     │              │
│    │              │                     │                     │              │
│    │              │  getOAuthProvider('google')               │              │
│    │              │─────────────────────►                     │              │
│    │              │                     │                     │              │
│    │              │◄─────────────────────                     │              │
│    │              │  { clientId, clientSecret }               │              │
│    │              │  (from memory cache)                      │              │
│    │              │                     │                     │              │
│    │◄─────────────│                     │                     │              │
│    │  redirect to:                      │                     │              │
│    │  https://accounts.google.com/oauth │                     │              │
│    │    ?client_id=<from_cache>         │                     │              │
│    │    &redirect_uri=...               │                     │              │
│    │              │                     │                     │              │
│    │─────────────────────────────────────────────────────────►│              │
│    │  User authenticates with Google                          │              │
│    │◄─────────────────────────────────────────────────────────│              │
│    │  redirect with ?code=AUTH_CODE                           │              │
│    │              │                     │                     │              │
│    │  GET /auth/callback?code=...       │                     │              │
│    │─────────────►│                     │                     │              │
│    │              │                     │                     │              │
│    │              │  POST /oauth/token                        │              │
│    │              │  { client_id, client_secret, code }      │              │
│    │              │  (credentials from cache)                │              │
│    │              │─────────────────────────────────────────►│              │
│    │              │                     │                     │              │
│    │              │◄─────────────────────────────────────────│              │
│    │              │  { access_token, id_token }               │              │
│    │              │                     │                     │              │
│    │              │  GET /userinfo (with access_token)        │              │
│    │              │─────────────────────────────────────────►│              │
│    │              │                     │                     │              │
│    │              │◄─────────────────────────────────────────│              │
│    │              │  { email, name, id }                      │              │
│    │              │                     │                     │              │
│    │              │                     │                     │              │
│    │◄─────────────│  { token: "eyJhbG..." }                   │              │
│    │              │  (JWT signed with jwtSecret from cache)   │              │
│                                                                              │
│  SECRETS USED:                                                               │
│  • oauth.google.client_id      → Read from cache (loaded at startup)         │
│  • oauth.google.client_secret  → Read from cache (loaded at startup)         │
│  • auth.jwt_secret             → Read from cache (loaded at startup)         │
│                                                                              │
│  NOT SECRETS (runtime data):                                                 │
│  • Google's access_token       → Temporary, exchanged at runtime             │
│  • User's JWT token            → Generated at runtime, sent to client        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4. AI Chat Flow (OpenAI)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            AI CHAT FLOW                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Client          API              Secrets Cache         OpenAI API           │
│  ──────          ───              ─────────────         ──────────           │
│    │              │                     │                     │              │
│    │  POST /api/v1/chat                 │                     │              │
│    │  { message: "Hello" }              │                     │              │
│    │  Authorization: Bearer <JWT>       │                     │              │
│    │─────────────►│                     │                     │              │
│    │              │                     │                     │              │
│    │              │  Verify JWT with secrets.jwtSecret        │              │
│    │              │  (from cache)       │                     │              │
│    │              │                     │                     │              │
│    │              │  getOpenAIApiKey()  │                     │              │
│    │              │─────────────────────►                     │              │
│    │              │                     │                     │              │
│    │              │◄─────────────────────                     │              │
│    │              │  "sk-proj-xxx..."   │                     │              │
│    │              │  (from memory cache)│                     │              │
│    │              │                     │                     │              │
│    │              │  POST /v1/chat/completions                │              │
│    │              │  Authorization: Bearer sk-proj-xxx        │              │
│    │              │─────────────────────────────────────────►│              │
│    │              │                     │                     │              │
│    │              │◄─────────────────────────────────────────│              │
│    │              │  { choices: [...] }                       │              │
│    │              │                     │                     │              │
│    │◄─────────────│                     │                     │              │
│    │  { response: "Hi! How can I..." }  │                     │              │
│                                                                              │
│  SECRETS USED:                                                               │
│  • api-keys.openai.api_key → Read from cache (loaded at startup)             │
│  • auth.jwt_secret         → Read from cache for JWT verification            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5. Voice Chat Flow (Deepgram + ElevenLabs)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         VOICE CHAT FLOW                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Client       API           Cache         Deepgram      ElevenLabs          │
│  ──────       ───           ─────         ────────      ──────────          │
│    │           │              │              │              │                │
│    │  WebSocket connect       │              │              │                │
│    │  (with JWT in query)     │              │              │                │
│    │──────────►│              │              │              │                │
│    │           │              │              │              │                │
│    │  Binary audio data       │              │              │                │
│    │──────────►│              │              │              │                │
│    │           │              │              │              │                │
│    │           │  getDeepgramApiKey()        │              │                │
│    │           │──────────────►              │              │                │
│    │           │◄──────────────              │              │                │
│    │           │  "dg-xxx..."                │              │                │
│    │           │              │              │              │                │
│    │           │  POST /listen/prerecorded   │              │                │
│    │           │  (audio + API key)          │              │                │
│    │           │─────────────────────────────►              │                │
│    │           │              │              │              │                │
│    │           │◄─────────────────────────────              │                │
│    │           │  { transcript: "Hello..." } │              │                │
│    │           │              │              │              │                │
│    │           │  [Process with OpenAI - see above]         │                │
│    │           │              │              │              │                │
│    │           │  getElevenLabsApiKey()      │              │                │
│    │           │──────────────►              │              │                │
│    │           │◄──────────────              │              │                │
│    │           │  "el-xxx..."                │              │                │
│    │           │              │              │              │                │
│    │           │  POST /text-to-speech       │              │                │
│    │           │  (text + API key)           │              │                │
│    │           │─────────────────────────────────────────────►               │
│    │           │              │              │              │                │
│    │           │◄─────────────────────────────────────────────               │
│    │           │  audio/mpeg stream          │              │                │
│    │           │              │              │              │                │
│    │◄──────────│              │              │              │                │
│    │  Binary audio response   │              │              │                │
│                                                                              │
│  SECRETS USED:                                                               │
│  • api-keys.deepgram.api_key     → STT transcription                         │
│  • api-keys.openai.api_key       → AI response generation                    │
│  • api-keys.eleven_labs.api_key  → TTS synthesis                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Integration Patterns

### Pattern: Lazy Getter with Cache

All services use lazy getters that read from the in-memory cache:

```typescript
// secrets.ts - Loaded ONCE at startup
let secretsCache: Partial<AllSecrets> = {};

export const secrets = {
  get jwtSecret(): string {
    return getSecret('auth', 'jwt_secret') || process.env.JWT_SECRET || '';
  },
  get openaiApiKey(): string {
    return getSecret('api-keys', 'openai')?.api_key || process.env.OPENAI_API_KEY || '';
  },
  google: {
    get clientId(): string {
      return getSecret('oauth', 'google')?.client_id || process.env.GOOGLE_CLIENT_ID || '';
    },
    get clientSecret(): string {
      return getSecret('oauth', 'google')?.client_secret || process.env.GOOGLE_CLIENT_SECRET || '';
    },
  },
  // ... more getters
};
```

### Pattern: Service Initialization

Services initialize clients lazily with secrets from cache:

```typescript
// voice-orchestrator.service.ts
let deepgramClient: DeepgramClient | null = null;

function getDeepgramClient(): DeepgramClient | null {
  const apiKey = secrets.deepgramApiKey;  // ← From cache, not network call
  if (!apiKey) return null;
  if (!deepgramClient) {
    deepgramClient = createClient(apiKey);  // ← Initialize once
  }
  return deepgramClient;
}
```

---

## What Goes Where

### In Secrets Manager (Backend Infrastructure)

| Category | Secret | Purpose |
|----------|--------|---------|
| **Database** | PostgreSQL credentials | API → Database connection |
| **Auth** | JWT signing key | Sign/verify user tokens |
| **OAuth** | Google client_id/secret | API → Google OAuth |
| **OAuth** | Microsoft client_id/secret | API → Microsoft OAuth |
| **OAuth** | GitHub client_id/secret | API → GitHub OAuth |
| **AI** | OpenAI API key | API → OpenAI |
| **AI** | Deepgram API key | API → Deepgram STT |
| **AI** | ElevenLabs API key | API → ElevenLabs TTS |
| **Cache** | Redis password | API → Redis |
| **Queue** | RabbitMQ URL | API → RabbitMQ |

### In Database (User Data)

| Table | Data | Purpose |
|-------|------|---------|
| `app.person` | `password_hash` | Bcrypt-hashed user passwords |
| `app.person` | `email`, `name` | User profile |
| `app.person_passkey` | WebAuthn credentials | Passkey authentication |
| `app.oauth_state` | OAuth PKCE state | Temporary OAuth flow data |
| `app.entity_rbac` | Permissions | User access control |

### Generated at Runtime (Not Stored)

| Data | Lifecycle | Purpose |
|------|-----------|---------|
| JWT tokens | Per-login, expires in 24h | User session |
| OAuth access tokens | Per-OAuth-flow, temporary | Call OAuth provider APIs |
| PKCE code verifier | Per-OAuth-flow, one-time | OAuth security |

---

## Environment Detection

```typescript
// config/index.ts
export const featureFlags = {
  // Use Secrets Manager in production, .env in development
  useSecretsManager: process.env.USE_SECRETS_MANAGER === 'true'
                     || serverConfig.isProduction,
};
```

| Environment | `NODE_ENV` | Secrets Source |
|-------------|------------|----------------|
| Development | `development` | `.env` file |
| Production | `production` | AWS Secrets Manager |
| Test (explicit) | any | `USE_SECRETS_MANAGER=true` |

---

## Performance Characteristics

| Operation | Frequency | Latency |
|-----------|-----------|---------|
| Load secrets from Secrets Manager | Once at startup | ~200-500ms |
| Read secret from cache | Every request | ~0.001ms (memory access) |
| JWT sign/verify | Every authenticated request | ~1-2ms |
| OAuth token exchange | Per SSO login | ~100-300ms (network) |

**Key Insight**: Secrets Manager is called **once** at application startup. All subsequent reads are from in-memory cache with zero network latency.

---

## Security Considerations

1. **Secrets never logged**: Secrets are loaded into memory but never logged or exposed in error messages
2. **IAM-based access**: EC2 instances have IAM role attached with policy to read only their secrets
3. **Encryption at rest**: Secrets Manager encrypts all secrets with KMS
4. **Rotation support**: Secrets can be rotated without app restart (requires cache invalidation)
5. **Fallback to .env**: Development works without Secrets Manager access

---

## Terraform Infrastructure

```hcl
# infra-tf/modules/secrets-manager/main.tf

resource "aws_secretsmanager_secret" "database" {
  name = "${var.project_name}/${var.environment}/database"
}

resource "aws_iam_policy" "secrets_read_policy" {
  name = "${var.project_name}-${var.environment}-secrets-read"
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.database.arn,
        aws_secretsmanager_secret.auth.arn,
        aws_secretsmanager_secret.oauth.arn,
        aws_secretsmanager_secret.api_keys.arn,
        aws_secretsmanager_secret.redis.arn,
        aws_secretsmanager_secret.rabbitmq.arn,
      ]
    }]
  })
}

# Attached to EC2 role
resource "aws_iam_role_policy_attachment" "ec2_secrets_policy" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = var.secrets_read_policy_arn
}
```

---

## Summary

| Layer | Secrets Manager | Database | Runtime |
|-------|-----------------|----------|---------|
| **Purpose** | Backend infra credentials | User data | Session tokens |
| **Examples** | API keys, DB password, JWT key | Password hashes, profiles | JWT, OAuth tokens |
| **Access** | EC2 IAM role | Postgres connection | Generated in memory |
| **Lifecycle** | Long-lived, rotatable | User-managed | Per-session |
| **Cost** | $0.40/secret/month | DB storage | None |
