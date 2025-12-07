/**
 * Advanced Authentication Routes
 *
 * Implements next-gen authentication features:
 * - Refresh token rotation with reuse detection
 * - WebAuthn/Passkeys (FIDO2)
 * - OAuth 2.1 with PKCE
 * - Session management
 * - Risk-based authentication
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { config } from '@/lib/config.js';

// Services
import {
  tokenService,
  TOKEN_CONFIG,
  generateJti,
  generateDeviceFingerprint,
  parseUserAgent,
  createSession,
  getUserSessions,
  terminateSession,
  terminateOtherSessions,
  terminateAllSessions,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
  logSecurityEvent,
  registerDevice,
  isDeviceTrusted,
  trustDevice,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  createRefreshToken,
  type DeviceInfo,
} from '@/services/token.service.js';

import {
  webauthnService,
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
  getCredentials,
  removeCredential,
  renameCredential,
} from '@/services/webauthn.service.js';

import {
  oauthService,
  getAuthorizationUrl,
  handleOAuthCallback,
  getLinkedAccounts,
  unlinkAccount,
} from '@/services/oauth.service.js';

import {
  riskService,
  assessLoginRisk,
  checkRateLimit,
  recordRateLimitAttempt,
  resetRateLimit,
} from '@/services/risk.service.js';

import { verifyTOTP, verifyBackupCode } from '@/services/auth.service.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCHEMAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ErrorResponseSchema = Type.Object({
  error: Type.String(),
});

const TokenPairSchema = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
  expiresIn: Type.Number(),
  tokenType: Type.Literal('Bearer'),
});

const SessionSchema = Type.Object({
  id: Type.String(),
  deviceId: Type.String(),
  deviceName: Type.String(),
  deviceType: Type.String(),
  browser: Type.String(),
  os: Type.String(),
  ipAddress: Type.String(),
  location: Type.Optional(Type.Object({
    city: Type.Optional(Type.String()),
    country: Type.Optional(Type.String()),
  })),
  createdAt: Type.String(),
  lastActiveAt: Type.String(),
  isCurrent: Type.Boolean(),
});

const PasskeyCredentialSchema = Type.Object({
  credentialId: Type.String(),
  name: Type.String(),
  createdAt: Type.String(),
  lastUsedAt: Type.Optional(Type.String()),
  deviceType: Type.Optional(Type.String()),
});

const RiskAssessmentSchema = Type.Object({
  score: Type.Number(),
  level: Type.Union([
    Type.Literal('low'),
    Type.Literal('medium'),
    Type.Literal('high'),
    Type.Literal('critical'),
  ]),
  requiresMfa: Type.Boolean(),
  deviceTrusted: Type.Boolean(),
  isNewDevice: Type.Boolean(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getDeviceInfo(request: any): DeviceInfo {
  const userAgent = request.headers['user-agent'] || '';
  const ipAddress = request.ip || request.headers['x-forwarded-for'] || 'unknown';
  const deviceId = generateDeviceFingerprint({
    email: '',
    ipAddress,
    userAgent,
  });
  const parsed = parseUserAgent(userAgent);

  return {
    deviceId,
    deviceName: parsed.deviceName,
    deviceType: parsed.deviceType,
    browser: parsed.browser,
    os: parsed.os,
    ipAddress,
    userAgent,
  };
}

async function generateTokenPair(
  fastify: FastifyInstance,
  personId: string,
  email: string,
  name: string,
  entityCode: string,
  entityId: string,
  deviceInfo: DeviceInfo,
  existingSessionId?: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
}> {
  const jti = generateJti();
  const sessionId = existingSessionId || await createSession(personId, deviceInfo);

  // Create access token
  const accessToken = fastify.jwt.sign(
    {
      sub: personId,
      email,
      name,
      entityCode,
      entityId,
      sessionId,
      jti,
    },
    { expiresIn: `${TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_MINUTES}m` }
  );

  // Create refresh token
  const refreshTokenData = await createRefreshToken(personId, deviceInfo);

  return {
    accessToken,
    refreshToken: refreshTokenData.token,
    expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_MINUTES * 60,
    sessionId,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function advancedAuthRoutes(fastify: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Refresh access token using refresh token
   * Implements refresh token rotation
   */
  fastify.post('/token/refresh', {
    schema: {
      tags: ['auth', 'tokens'],
      summary: 'Refresh access token',
      description: 'Exchange refresh token for new access + refresh token pair (rotation)',
      body: Type.Object({
        refreshToken: Type.String(),
      }),
      response: {
        200: TokenPairSchema,
        401: ErrorResponseSchema,
        429: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    const deviceInfo = getDeviceInfo(request);

    try {
      // Check rate limit
      const rateLimit = await checkRateLimit('token_refresh', deviceInfo.ipAddress || 'unknown');
      if (!rateLimit.allowed) {
        return reply.status(429).send({ error: 'Too many requests' });
      }

      // Rotate refresh token
      const result = await rotateRefreshToken(refreshToken, deviceInfo);

      if (!result) {
        await recordRateLimitAttempt('token_refresh', deviceInfo.ipAddress || 'unknown');
        await logSecurityEvent({
          eventType: 'token_refresh_failure',
          eventCategory: 'session',
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          success: false,
          failureReason: 'Invalid refresh token',
        });
        return reply.status(401).send({ error: 'Invalid or expired refresh token' });
      }

      // Get person details for new access token
      const personResult = await db.execute(sql`
        SELECT p.email, p.entity_code, p.employee_id, p.customer_id,
               COALESCE(e.name, c.name) as name,
               COALESCE(e.id, c.id) as entity_id
        FROM app.person p
        LEFT JOIN app.employee e ON e.id = p.employee_id
        LEFT JOIN app.customer c ON c.id = p.customer_id
        WHERE p.id = ${result.personId}::uuid
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];

      // Generate new access token
      const jti = generateJti();
      const accessToken = fastify.jwt.sign(
        {
          sub: result.personId,
          email: person.email as string,
          name: person.name as string,
          entityCode: person.entity_code as string,
          entityId: person.entity_id as string,
          jti,
        },
        { expiresIn: `${TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_MINUTES}m` }
      );

      await logSecurityEvent({
        eventType: 'token_refresh_success',
        eventCategory: 'session',
        personId: result.personId,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceId: deviceInfo.deviceId,
        success: true,
      });

      return {
        accessToken,
        refreshToken: result.newToken.token,
        expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY_MINUTES * 60,
        tokenType: 'Bearer',
      };
    } catch (error) {
      fastify.log.error('Token refresh error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Revoke refresh token (logout)
   */
  fastify.post('/token/revoke', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'tokens'],
      summary: 'Revoke refresh token',
      description: 'Invalidate a refresh token',
      body: Type.Object({
        refreshToken: Type.String(),
      }),
      response: {
        200: Type.Object({ success: Type.Boolean() }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    const personId = (request.user as any)?.sub;
    const deviceInfo = getDeviceInfo(request);

    try {
      await revokeRefreshToken(refreshToken, 'logout');

      await logSecurityEvent({
        eventType: 'logout',
        eventCategory: 'session',
        personId,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        success: true,
      });

      return { success: true };
    } catch (error) {
      fastify.log.error('Token revoke error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Revoke all refresh tokens (logout everywhere)
   */
  fastify.post('/token/revoke-all', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'tokens'],
      summary: 'Revoke all tokens',
      description: 'Logout from all devices',
      response: {
        200: Type.Object({ revokedCount: Type.Number() }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;
    const deviceInfo = getDeviceInfo(request);

    try {
      const revokedCount = await revokeAllUserRefreshTokens(personId, 'logout_all');
      await terminateAllSessions(personId, 'logout_all');

      await logSecurityEvent({
        eventType: 'logout_all',
        eventCategory: 'session',
        personId,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        eventDetail: { revokedCount },
        success: true,
      });

      return { revokedCount };
    } catch (error) {
      fastify.log.error('Revoke all tokens error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get active sessions
   */
  fastify.get('/sessions', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'sessions'],
      summary: 'Get active sessions',
      description: 'List all active sessions for the current user',
      response: {
        200: Type.Object({
          sessions: Type.Array(SessionSchema),
        }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;
    const sessionId = (request.user as any)?.sessionId;

    try {
      const sessions = await getUserSessions(personId, sessionId);
      return { sessions };
    } catch (error) {
      fastify.log.error('Get sessions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Terminate a specific session
   */
  fastify.delete('/sessions/:sessionId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'sessions'],
      summary: 'Terminate session',
      description: 'Terminate a specific session',
      params: Type.Object({
        sessionId: Type.String(),
      }),
      response: {
        200: Type.Object({ success: Type.Boolean() }),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;
    const { sessionId } = request.params as { sessionId: string };
    const deviceInfo = getDeviceInfo(request);

    try {
      const success = await terminateSession(sessionId, 'user_revoked');

      if (success) {
        await logSecurityEvent({
          eventType: 'session_revoke',
          eventCategory: 'session',
          personId,
          ipAddress: deviceInfo.ipAddress,
          eventDetail: { sessionId },
          success: true,
        });
      }

      return { success };
    } catch (error) {
      fastify.log.error('Terminate session error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Terminate all other sessions
   */
  fastify.post('/sessions/terminate-others', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'sessions'],
      summary: 'Terminate other sessions',
      description: 'Terminate all sessions except current',
      response: {
        200: Type.Object({ terminatedCount: Type.Number() }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;
    const sessionId = (request.user as any)?.sessionId;
    const deviceInfo = getDeviceInfo(request);

    try {
      const terminatedCount = await terminateOtherSessions(personId, sessionId, 'user_revoked');

      await logSecurityEvent({
        eventType: 'session_revoke_all',
        eventCategory: 'session',
        personId,
        ipAddress: deviceInfo.ipAddress,
        eventDetail: { terminatedCount, excludedSession: sessionId },
        success: true,
      });

      return { terminatedCount };
    } catch (error) {
      fastify.log.error('Terminate other sessions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBAUTHN / PASSKEYS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get passkey registration options
   */
  fastify.post('/passkey/register/options', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'passkeys'],
      summary: 'Get passkey registration options',
      description: 'Generate WebAuthn credential creation options',
      response: {
        200: Type.Object({
          challenge: Type.String(),
          rp: Type.Object({
            name: Type.String(),
            id: Type.String(),
          }),
          user: Type.Object({
            id: Type.String(),
            name: Type.String(),
            displayName: Type.String(),
          }),
          pubKeyCredParams: Type.Array(Type.Object({
            type: Type.Literal('public-key'),
            alg: Type.Number(),
          })),
          timeout: Type.Number(),
          attestation: Type.String(),
          authenticatorSelection: Type.Object({
            authenticatorAttachment: Type.Optional(Type.String()),
            userVerification: Type.String(),
            residentKey: Type.String(),
          }),
          excludeCredentials: Type.Optional(Type.Array(Type.Object({
            id: Type.String(),
            type: Type.Literal('public-key'),
            transports: Type.Optional(Type.Array(Type.String())),
          }))),
        }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;
    const email = (request.user as any)?.email;
    const name = (request.user as any)?.name;

    try {
      const options = await generateRegistrationOptions(personId, email, name);
      return options;
    } catch (error) {
      fastify.log.error('Passkey registration options error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Verify passkey registration
   */
  fastify.post('/passkey/register/verify', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'passkeys'],
      summary: 'Verify passkey registration',
      description: 'Complete WebAuthn credential creation',
      body: Type.Object({
        credential: Type.Object({
          id: Type.String(),
          rawId: Type.String(),
          type: Type.Literal('public-key'),
          response: Type.Object({
            clientDataJSON: Type.String(),
            attestationObject: Type.String(),
            transports: Type.Optional(Type.Array(Type.String())),
          }),
        }),
        challenge: Type.String(),
        name: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({ success: Type.Boolean() }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;
    const { credential, challenge, name = 'My Passkey' } = request.body as any;
    const deviceInfo = getDeviceInfo(request);

    try {
      const result = await verifyRegistration(personId, credential, challenge, name);

      if (!result.success) {
        return reply.status(400).send({ error: result.error || 'Registration failed' });
      }

      await logSecurityEvent({
        eventType: 'passkey_register',
        eventCategory: 'account',
        personId,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        eventDetail: { credentialName: name },
        success: true,
      });

      return { success: true };
    } catch (error) {
      fastify.log.error('Passkey registration verify error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Get passkey authentication options
   */
  fastify.post('/passkey/login/options', {
    schema: {
      tags: ['auth', 'passkeys'],
      summary: 'Get passkey login options',
      description: 'Generate WebAuthn authentication options',
      body: Type.Object({
        email: Type.Optional(Type.String({ format: 'email' })),
      }),
      response: {
        200: Type.Object({
          challenge: Type.String(),
          timeout: Type.Number(),
          rpId: Type.String(),
          userVerification: Type.String(),
          allowCredentials: Type.Optional(Type.Array(Type.Object({
            id: Type.String(),
            type: Type.Literal('public-key'),
            transports: Type.Optional(Type.Array(Type.String())),
          }))),
        }),
        400: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { email } = request.body as { email?: string };

    try {
      const options = await generateAuthenticationOptions(email);
      return options;
    } catch (error) {
      fastify.log.error('Passkey login options error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Verify passkey authentication
   */
  fastify.post('/passkey/login/verify', {
    schema: {
      tags: ['auth', 'passkeys'],
      summary: 'Verify passkey login',
      description: 'Complete WebAuthn authentication and get tokens',
      body: Type.Object({
        credential: Type.Object({
          id: Type.String(),
          rawId: Type.String(),
          type: Type.Literal('public-key'),
          response: Type.Object({
            clientDataJSON: Type.String(),
            authenticatorData: Type.String(),
            signature: Type.String(),
            userHandle: Type.Optional(Type.String()),
          }),
        }),
        challenge: Type.String(),
      }),
      response: {
        200: Type.Object({
          accessToken: Type.String(),
          refreshToken: Type.String(),
          expiresIn: Type.Number(),
          tokenType: Type.Literal('Bearer'),
          user: Type.Object({
            id: Type.String(),
            personId: Type.String(),
            name: Type.String(),
            email: Type.String(),
            entityCode: Type.String(),
          }),
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { credential, challenge } = request.body as any;
    const deviceInfo = getDeviceInfo(request);

    try {
      const result = await verifyAuthentication(credential, challenge);

      if (!result.success || !result.personId) {
        await logSecurityEvent({
          eventType: 'passkey_auth_failure',
          eventCategory: 'authentication',
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          success: false,
          failureReason: result.error,
        });
        return reply.status(401).send({ error: result.error || 'Authentication failed' });
      }

      // Get person details
      const personResult = await db.execute(sql`
        SELECT p.email, p.entity_code, p.employee_id, p.customer_id,
               COALESCE(e.name, c.name) as name,
               COALESCE(e.id, c.id) as entity_id
        FROM app.person p
        LEFT JOIN app.employee e ON e.id = p.employee_id
        LEFT JOIN app.customer c ON c.id = p.customer_id
        WHERE p.id = ${result.personId}::uuid AND p.active_flag = true
      `);

      if (personResult.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const person = personResult[0];

      // Generate tokens
      const tokens = await generateTokenPair(
        fastify,
        result.personId,
        person.email as string,
        person.name as string,
        person.entity_code as string,
        person.entity_id as string,
        deviceInfo
      );

      // Register device
      await registerDevice(result.personId, deviceInfo);

      await logSecurityEvent({
        eventType: 'passkey_auth_success',
        eventCategory: 'authentication',
        personId: result.personId,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceId: deviceInfo.deviceId,
        success: true,
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer' as const,
        user: {
          id: person.entity_id as string,
          personId: result.personId,
          name: person.name as string,
          email: person.email as string,
          entityCode: person.entity_code as string,
        },
      };
    } catch (error) {
      fastify.log.error('Passkey login verify error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * List passkey credentials
   */
  fastify.get('/passkeys', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'passkeys'],
      summary: 'List passkeys',
      description: 'Get all registered passkeys for the user',
      response: {
        200: Type.Object({
          passkeys: Type.Array(PasskeyCredentialSchema),
        }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;

    try {
      const credentials = await getCredentials(personId);
      const passkeys = credentials.map((c) => ({
        credentialId: c.credentialId,
        name: c.name,
        createdAt: c.createdAt,
        lastUsedAt: c.lastUsedAt,
        deviceType: c.deviceType,
      }));
      return { passkeys };
    } catch (error) {
      fastify.log.error('List passkeys error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Remove a passkey
   */
  fastify.delete('/passkeys/:credentialId', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'passkeys'],
      summary: 'Remove passkey',
      description: 'Delete a registered passkey',
      params: Type.Object({
        credentialId: Type.String(),
      }),
      response: {
        200: Type.Object({ success: Type.Boolean() }),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;
    const { credentialId } = request.params as { credentialId: string };
    const deviceInfo = getDeviceInfo(request);

    try {
      const success = await removeCredential(personId, credentialId);

      if (success) {
        await logSecurityEvent({
          eventType: 'passkey_remove',
          eventCategory: 'account',
          personId,
          ipAddress: deviceInfo.ipAddress,
          eventDetail: { credentialId },
          success: true,
        });
      }

      return { success };
    } catch (error) {
      fastify.log.error('Remove passkey error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OAUTH 2.1 / SSO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initiate OAuth flow
   */
  fastify.get('/sso/:provider/authorize', {
    schema: {
      tags: ['auth', 'sso'],
      summary: 'Start OAuth flow',
      description: 'Redirect to OAuth provider for authentication',
      params: Type.Object({
        provider: Type.String(),
      }),
      querystring: Type.Object({
        redirect_uri: Type.String(),
        action: Type.Optional(Type.Union([
          Type.Literal('login'),
          Type.Literal('signup'),
          Type.Literal('link'),
        ])),
      }),
      response: {
        302: Type.Null(),
        400: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const { redirect_uri, action = 'login' } = request.query as {
      redirect_uri: string;
      action?: 'login' | 'signup' | 'link';
    };

    // For linking, require authentication
    let personId: string | undefined;
    if (action === 'link') {
      try {
        await request.jwtVerify();
        personId = (request.user as any)?.sub;
      } catch {
        return reply.status(401).send({ error: 'Authentication required for linking' });
      }
    }

    try {
      const result = await getAuthorizationUrl(provider, redirect_uri, action, personId);

      if ('error' in result) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.redirect(302, result.url);
    } catch (error) {
      fastify.log.error('OAuth authorize error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * OAuth callback handler
   */
  fastify.get('/sso/:provider/callback', {
    schema: {
      tags: ['auth', 'sso'],
      summary: 'OAuth callback',
      description: 'Handle OAuth provider callback',
      params: Type.Object({
        provider: Type.String(),
      }),
      querystring: Type.Object({
        code: Type.String(),
        state: Type.String(),
        error: Type.Optional(Type.String()),
        error_description: Type.Optional(Type.String()),
      }),
    },
  }, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const { code, state, error, error_description } = request.query as {
      code: string;
      state: string;
      error?: string;
      error_description?: string;
    };
    const deviceInfo = getDeviceInfo(request);

    // Handle OAuth error
    if (error) {
      return reply.status(400).send({
        error: error_description || error,
      });
    }

    try {
      const result = await handleOAuthCallback(state, code);

      if (!result.success) {
        await logSecurityEvent({
          eventType: 'oauth_failure',
          eventCategory: 'authentication',
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          eventDetail: { provider },
          success: false,
          failureReason: result.error,
        });
        return reply.status(400).send({ error: result.error });
      }

      // Handle linking
      if (result.action === 'link') {
        await logSecurityEvent({
          eventType: 'oauth_link',
          eventCategory: 'account',
          personId: result.personId,
          ipAddress: deviceInfo.ipAddress,
          eventDetail: { provider },
          success: true,
        });
        return { success: true, action: 'link', provider };
      }

      // Handle login/signup
      let personId = result.personId;

      // If no person exists, create one (signup)
      if (!personId && result.userInfo) {
        const perCode = `PER-SSO-${Date.now()}`;
        const personResult = await db.execute(sql`
          INSERT INTO app.person (
            code,
            entity_code,
            email,
            email_verified_flag,
            metadata
          ) VALUES (
            ${perCode},
            'customer',
            ${result.userInfo.email},
            ${result.userInfo.emailVerified || false},
            ${JSON.stringify({
              oauth_accounts: [{
                provider,
                providerId: result.userInfo.id,
                email: result.userInfo.email,
                name: result.userInfo.name,
                linkedAt: new Date().toISOString(),
              }],
            })}::jsonb
          )
          RETURNING id
        `);
        personId = personResult[0].id as string;
      }

      if (!personId) {
        return reply.status(400).send({ error: 'Unable to create user' });
      }

      // Get person details
      const personResult = await db.execute(sql`
        SELECT p.email, p.entity_code, p.employee_id, p.customer_id,
               COALESCE(e.name, c.name, ${result.userInfo?.name || 'User'}) as name,
               COALESCE(e.id, c.id, p.id) as entity_id
        FROM app.person p
        LEFT JOIN app.employee e ON e.id = p.employee_id
        LEFT JOIN app.customer c ON c.id = p.customer_id
        WHERE p.id = ${personId}::uuid
      `);

      const person = personResult[0];

      // Generate tokens
      const tokens = await generateTokenPair(
        fastify,
        personId,
        person.email as string,
        person.name as string,
        person.entity_code as string,
        person.entity_id as string,
        deviceInfo
      );

      await registerDevice(personId, deviceInfo);

      await logSecurityEvent({
        eventType: result.action === 'signup' ? 'oauth_signup' : 'oauth_login',
        eventCategory: 'authentication',
        personId,
        email: person.email as string,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceId: deviceInfo.deviceId,
        eventDetail: { provider },
        success: true,
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer',
        user: {
          id: person.entity_id as string,
          personId,
          name: person.name as string,
          email: person.email as string,
          entityCode: person.entity_code as string,
        },
      };
    } catch (error) {
      fastify.log.error('OAuth callback error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * List linked OAuth accounts
   */
  fastify.get('/sso/accounts', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'sso'],
      summary: 'List linked accounts',
      description: 'Get all linked OAuth accounts',
      response: {
        200: Type.Object({
          accounts: Type.Array(Type.Object({
            provider: Type.String(),
            providerId: Type.String(),
            email: Type.String(),
            name: Type.Optional(Type.String()),
            linkedAt: Type.String(),
          })),
        }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;

    try {
      const accounts = await getLinkedAccounts(personId);
      return { accounts };
    } catch (error) {
      fastify.log.error('List linked accounts error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Unlink OAuth account
   */
  fastify.delete('/sso/:provider', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'sso'],
      summary: 'Unlink OAuth account',
      description: 'Remove linked OAuth provider',
      params: Type.Object({
        provider: Type.String(),
      }),
      response: {
        200: Type.Object({ success: Type.Boolean() }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;
    const { provider } = request.params as { provider: string };
    const deviceInfo = getDeviceInfo(request);

    try {
      const result = await unlinkAccount(personId, provider);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      await logSecurityEvent({
        eventType: 'oauth_unlink',
        eventCategory: 'account',
        personId,
        ipAddress: deviceInfo.ipAddress,
        eventDetail: { provider },
        success: true,
      });

      return { success: true };
    } catch (error) {
      fastify.log.error('Unlink OAuth account error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RISK-BASED AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Assess login risk (pre-auth check)
   */
  fastify.post('/risk/assess', {
    schema: {
      tags: ['auth', 'risk'],
      summary: 'Assess login risk',
      description: 'Check risk level before authentication',
      body: Type.Object({
        email: Type.String({ format: 'email' }),
      }),
      response: {
        200: RiskAssessmentSchema,
        429: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { email } = request.body as { email: string };
    const deviceInfo = getDeviceInfo(request);

    try {
      // Check rate limit
      const rateLimit = await checkRateLimit('login', deviceInfo.ipAddress || 'unknown');
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          error: `Too many attempts. Try again in ${Math.ceil((rateLimit.blockedUntil!.getTime() - Date.now()) / 60000)} minutes.`,
        });
      }

      // Get person if exists
      const personResult = await db.execute(sql`
        SELECT id FROM app.person WHERE email = ${email} AND active_flag = true
      `);

      const personId = personResult.length > 0 ? personResult[0].id as string : undefined;

      // Assess risk
      const assessment = await assessLoginRisk({
        personId,
        email,
        ipAddress: deviceInfo.ipAddress || 'unknown',
        userAgent: deviceInfo.userAgent || '',
        deviceId: deviceInfo.deviceId,
      });

      return {
        score: assessment.score,
        level: assessment.level,
        requiresMfa: assessment.requiresMfa,
        deviceTrusted: assessment.deviceTrusted,
        isNewDevice: assessment.isNewDevice,
      };
    } catch (error) {
      fastify.log.error('Risk assessment error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * Trust current device
   */
  fastify.post('/devices/trust', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['auth', 'devices'],
      summary: 'Trust current device',
      description: 'Mark current device as trusted (skip MFA)',
      response: {
        200: Type.Object({ success: Type.Boolean(), expiresAt: Type.String() }),
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const personId = (request.user as any)?.sub;
    const deviceInfo = getDeviceInfo(request);

    try {
      await registerDevice(personId, deviceInfo);
      await trustDevice(personId, deviceInfo.deviceId);

      const expiresAt = new Date(Date.now() + TOKEN_CONFIG.DEVICE_TRUST_DAYS * 24 * 60 * 60 * 1000);

      await logSecurityEvent({
        eventType: 'device_trust',
        eventCategory: 'account',
        personId,
        ipAddress: deviceInfo.ipAddress,
        deviceId: deviceInfo.deviceId,
        success: true,
      });

      return { success: true, expiresAt: expiresAt.toISOString() };
    } catch (error) {
      fastify.log.error('Trust device error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
