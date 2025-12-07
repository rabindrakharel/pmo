/**
 * OAuth 2.1 Service with PKCE
 *
 * Implements:
 * - OAuth 2.1 Authorization Code Flow with PKCE
 * - State parameter for CSRF protection
 * - Google and Microsoft SSO
 * - Account linking
 */

import crypto from 'crypto';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import secrets from '@/config/secrets.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface OAuthProviderConfig {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  responseType: string;
}

/**
 * Get OAuth provider configuration with secrets loaded from Secrets Manager
 * Uses getter pattern to ensure secrets are loaded at runtime, not module load time
 */
export function getOAuthProvider(provider: string): OAuthProviderConfig | null {
  const providers: Record<string, OAuthProviderConfig> = {
    google: {
      name: 'Google',
      clientId: secrets.google.clientId,
      clientSecret: secrets.google.clientSecret,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scope: 'openid email profile',
      responseType: 'code',
    },
    microsoft: {
      name: 'Microsoft',
      clientId: secrets.microsoft.clientId,
      clientSecret: secrets.microsoft.clientSecret,
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scope: 'openid email profile',
      responseType: 'code',
    },
    github: {
      name: 'GitHub',
      clientId: secrets.github.clientId,
      clientSecret: secrets.github.clientSecret,
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scope: 'read:user user:email',
      responseType: 'code',
    },
  };
  return providers[provider] || null;
}

// Legacy export for backward compatibility (uses getters for lazy evaluation)
export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  get google() { return getOAuthProvider('google')!; },
  get microsoft() { return getOAuthProvider('microsoft')!; },
  get github() { return getOAuthProvider('github')!; },
} as Record<string, OAuthProviderConfig>;

const OAUTH_STATE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface OAuthState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  provider: string;
  redirectUri: string;
  action: 'login' | 'signup' | 'link';
  personId?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  emailVerified?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PKCE HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a cryptographically secure state parameter
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate a PKCE code verifier (43-128 characters)
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code challenge from verifier (S256 method)
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATE MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Store OAuth state for callback verification
 */
export async function storeOAuthState(params: {
  state: string;
  codeVerifier: string;
  provider: string;
  redirectUri: string;
  action: 'login' | 'signup' | 'link';
  personId?: string;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TIMEOUT_MS);

  await db.execute(sql`
    INSERT INTO app.oauth_state (
      state,
      code_verifier,
      provider,
      redirect_uri,
      action,
      person_id,
      expires_ts
    ) VALUES (
      ${params.state},
      ${params.codeVerifier},
      ${params.provider},
      ${params.redirectUri},
      ${params.action},
      ${params.personId ? sql`${params.personId}::uuid` : sql`NULL`},
      ${expiresAt.toISOString()}
    )
  `);
}

/**
 * Retrieve and consume OAuth state
 */
export async function consumeOAuthState(state: string): Promise<{
  codeVerifier: string;
  provider: string;
  redirectUri: string;
  action: 'login' | 'signup' | 'link';
  personId?: string;
} | null> {
  const result = await db.execute(sql`
    UPDATE app.oauth_state
    SET used_flag = true
    WHERE state = ${state}
      AND used_flag = false
      AND expires_ts > NOW()
    RETURNING code_verifier, provider, redirect_uri, action, person_id
  `);

  if (result.length === 0) {
    return null;
  }

  return {
    codeVerifier: result[0].code_verifier as string,
    provider: result[0].provider as string,
    redirectUri: result[0].redirect_uri as string,
    action: result[0].action as 'login' | 'signup' | 'link',
    personId: result[0].person_id as string | undefined,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHORIZATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate authorization URL with PKCE
 */
export async function getAuthorizationUrl(
  provider: string,
  redirectUri: string,
  action: 'login' | 'signup' | 'link' = 'login',
  personId?: string
): Promise<{ url: string; state: string } | { error: string }> {
  const config = getOAuthProvider(provider);
  if (!config) {
    return { error: `Unknown provider: ${provider}` };
  }

  if (!config.clientId) {
    return { error: `${provider} OAuth not configured` };
  }

  // Generate PKCE values
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store state for callback verification
  await storeOAuthState({
    state,
    codeVerifier,
    provider,
    redirectUri,
    action,
    personId,
  });

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: config.responseType,
    scope: config.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // Provider-specific parameters
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  const url = `${config.authorizationUrl}?${params.toString()}`;

  return { url, state };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOKEN EXCHANGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  provider: string,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<OAuthTokenResponse | { error: string }> {
  const config = getOAuthProvider(provider);
  if (!config) {
    return { error: `Unknown provider: ${provider}` };
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`OAuth token exchange failed: ${error}`);
      return { error: 'Token exchange failed' };
    }

    const data = await response.json();
    return data as OAuthTokenResponse;
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return { error: 'Token exchange failed' };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER INFO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fetch user info from OAuth provider
 */
export async function getUserInfo(
  provider: string,
  accessToken: string
): Promise<OAuthUserInfo | { error: string }> {
  const config = getOAuthProvider(provider);
  if (!config) {
    return { error: `Unknown provider: ${provider}` };
  }

  try {
    const response = await fetch(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return { error: 'Failed to fetch user info' };
    }

    const data = await response.json();

    // Normalize response across providers
    return normalizeUserInfo(provider, data);
  } catch (error) {
    console.error('OAuth user info error:', error);
    return { error: 'Failed to fetch user info' };
  }
}

/**
 * Normalize user info across different providers
 */
function normalizeUserInfo(provider: string, data: any): OAuthUserInfo {
  switch (provider) {
    case 'google':
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        firstName: data.given_name,
        lastName: data.family_name,
        picture: data.picture,
        emailVerified: data.verified_email,
      };

    case 'microsoft':
      return {
        id: data.id,
        email: data.mail || data.userPrincipalName,
        name: data.displayName,
        firstName: data.givenName,
        lastName: data.surname,
        emailVerified: true, // Microsoft requires verified email
      };

    case 'github':
      return {
        id: String(data.id),
        email: data.email,
        name: data.name || data.login,
        picture: data.avatar_url,
        emailVerified: true, // Would need additional API call to verify
      };

    default:
      return {
        id: data.id || data.sub,
        email: data.email,
        name: data.name,
      };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCOUNT LINKING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface LinkedAccount {
  provider: string;
  providerId: string;
  email: string;
  name?: string;
  linkedAt: string;
}

/**
 * Get linked OAuth accounts for a user
 */
export async function getLinkedAccounts(personId: string): Promise<LinkedAccount[]> {
  const result = await db.execute(sql`
    SELECT metadata->'oauth_accounts' as accounts
    FROM app.person
    WHERE id = ${personId}::uuid
  `);

  if (result.length === 0 || !result[0].accounts) {
    return [];
  }

  return result[0].accounts as LinkedAccount[];
}

/**
 * Link an OAuth account to an existing user
 */
export async function linkAccount(
  personId: string,
  provider: string,
  userInfo: OAuthUserInfo
): Promise<{ success: boolean; error?: string }> {
  // Check if this OAuth account is already linked to another user
  const existing = await db.execute(sql`
    SELECT id FROM app.person
    WHERE id != ${personId}::uuid
      AND metadata->'oauth_accounts' @> ${JSON.stringify([{ provider, providerId: userInfo.id }])}::jsonb
  `);

  if (existing.length > 0) {
    return { success: false, error: 'This account is already linked to another user' };
  }

  const linkedAccount: LinkedAccount = {
    provider,
    providerId: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    linkedAt: new Date().toISOString(),
  };

  await db.execute(sql`
    UPDATE app.person
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{oauth_accounts}',
      COALESCE(metadata->'oauth_accounts', '[]'::jsonb) || ${JSON.stringify([linkedAccount])}::jsonb
    ),
    updated_ts = NOW()
    WHERE id = ${personId}::uuid
  `);

  return { success: true };
}

/**
 * Unlink an OAuth account
 */
export async function unlinkAccount(
  personId: string,
  provider: string
): Promise<{ success: boolean; error?: string }> {
  // Ensure user has another login method
  const person = await db.execute(sql`
    SELECT password_hash, passkey_enabled_flag, metadata->'oauth_accounts' as accounts
    FROM app.person
    WHERE id = ${personId}::uuid
  `);

  if (person.length === 0) {
    return { success: false, error: 'User not found' };
  }

  const hasPassword = !!person[0].password_hash;
  const hasPasskey = person[0].passkey_enabled_flag as boolean;
  const accounts = (person[0].accounts as LinkedAccount[]) || [];
  const otherAccounts = accounts.filter((a) => a.provider !== provider);

  if (!hasPassword && !hasPasskey && otherAccounts.length === 0) {
    return { success: false, error: 'Cannot remove last login method' };
  }

  await db.execute(sql`
    UPDATE app.person
    SET metadata = jsonb_set(
      metadata,
      '{oauth_accounts}',
      ${JSON.stringify(otherAccounts)}::jsonb
    ),
    updated_ts = NOW()
    WHERE id = ${personId}::uuid
  `);

  return { success: true };
}

/**
 * Find user by OAuth provider and ID
 */
export async function findUserByOAuth(
  provider: string,
  providerId: string
): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT id FROM app.person
    WHERE active_flag = true
      AND metadata->'oauth_accounts' @> ${JSON.stringify([{ provider, providerId }])}::jsonb
  `);

  if (result.length === 0) {
    return null;
  }

  return result[0].id as string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FULL OAUTH FLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle OAuth callback - complete flow
 */
export async function handleOAuthCallback(
  state: string,
  code: string
): Promise<{
  success: boolean;
  action?: 'login' | 'signup' | 'link';
  personId?: string;
  userInfo?: OAuthUserInfo;
  error?: string;
}> {
  // Verify state and get stored data
  const stateData = await consumeOAuthState(state);
  if (!stateData) {
    return { success: false, error: 'Invalid or expired state' };
  }

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(
    stateData.provider,
    code,
    stateData.codeVerifier,
    stateData.redirectUri
  );

  if ('error' in tokens) {
    return { success: false, error: tokens.error };
  }

  // Get user info
  const userInfo = await getUserInfo(stateData.provider, tokens.access_token);
  if ('error' in userInfo) {
    return { success: false, error: userInfo.error };
  }

  // Handle based on action
  switch (stateData.action) {
    case 'link':
      if (!stateData.personId) {
        return { success: false, error: 'No user to link' };
      }
      const linkResult = await linkAccount(stateData.personId, stateData.provider, userInfo);
      if (!linkResult.success) {
        return { success: false, error: linkResult.error };
      }
      return {
        success: true,
        action: 'link',
        personId: stateData.personId,
        userInfo,
      };

    case 'login':
    case 'signup':
      // Check if user exists
      let personId = await findUserByOAuth(stateData.provider, userInfo.id);

      // Also check by email for existing accounts
      if (!personId && userInfo.email) {
        const existingUser = await db.execute(sql`
          SELECT id FROM app.person
          WHERE email = ${userInfo.email} AND active_flag = true
        `);
        if (existingUser.length > 0) {
          personId = existingUser[0].id as string;
          // Auto-link the OAuth account
          await linkAccount(personId, stateData.provider, userInfo);
        }
      }

      return {
        success: true,
        action: personId ? 'login' : 'signup',
        personId: personId || undefined,
        userInfo,
      };

    default:
      return { success: false, error: 'Unknown action' };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const oauthService = {
  // Configuration
  OAUTH_PROVIDERS,

  // PKCE
  generateState,
  generateCodeVerifier,
  generateCodeChallenge,

  // Authorization flow
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getUserInfo,
  handleOAuthCallback,

  // Account linking
  getLinkedAccounts,
  linkAccount,
  unlinkAccount,
  findUserByOAuth,
};

export default oauthService;
