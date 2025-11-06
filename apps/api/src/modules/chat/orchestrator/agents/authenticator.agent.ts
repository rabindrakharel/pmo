/**
 * Authenticator Agent
 * Validates authentication and sets up session context
 * @module orchestrator/agents/authenticator
 */

import type { AgentActionResult } from '../types/intent-graph.types.js';
import { stateManager } from '../state/state-manager.service.js';
import { client } from '../../../../db/index.js';

export interface AuthContext {
  user_id?: string;
  tenant_id?: string;
  email?: string;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Authenticator Agent
 * Validates auth tokens and checks permissions
 */
export class AuthenticatorAgent {
  /**
   * Authenticate and validate session
   */
  async authenticate(args: {
    sessionId: string;
    authToken?: string;
    requiredPermissions?: string[];
  }): Promise<AgentActionResult> {
    const startTime = Date.now();

    try {
      // If no auth token provided, return anonymous context
      if (!args.authToken) {
        await stateManager.logAgentAction({
          session_id: args.sessionId,
          agent_role: 'authenticator',
          agent_action: 'authenticate',
          success: true,
          natural_response: 'Anonymous session - limited access',
          duration_ms: Date.now() - startTime
        });

        return {
          success: true,
          agentRole: 'authenticator',
          action: 'authenticate',
          naturalResponse: 'Welcome! You are accessing as a guest.',
          stateUpdates: {
            is_authenticated: false,
            is_anonymous: true
          }
        };
      }

      // Extract user info from JWT token
      const authContext = await this.validateToken(args.authToken);

      if (!authContext) {
        await stateManager.logAgentAction({
          session_id: args.sessionId,
          agent_role: 'authenticator',
          agent_action: 'authenticate',
          success: false,
          error_message: 'Invalid or expired token',
          duration_ms: Date.now() - startTime
        });

        return {
          success: false,
          agentRole: 'authenticator',
          action: 'authenticate',
          error: 'Invalid or expired authentication token',
          naturalResponse: 'I\'m sorry, your session has expired. Please log in again.'
        };
      }

      // Check required permissions
      if (args.requiredPermissions && args.requiredPermissions.length > 0) {
        const hasPermissions = await this.checkPermissions(
          authContext,
          args.requiredPermissions
        );

        if (!hasPermissions) {
          await stateManager.logAgentAction({
            session_id: args.sessionId,
            agent_role: 'authenticator',
            agent_action: 'authenticate',
            success: false,
            error_message: 'Insufficient permissions',
            duration_ms: Date.now() - startTime
          });

          return {
            success: false,
            agentRole: 'authenticator',
            action: 'authenticate',
            error: 'Insufficient permissions',
            naturalResponse: 'I\'m sorry, you don\'t have permission to perform this action.'
          };
        }
      }

      // Update session with auth context
      await stateManager.updateSession(args.sessionId, {
        user_id: authContext.user_id,
        tenant_id: authContext.tenant_id,
        auth_metadata: authContext as any
      });

      // Store auth context in state
      await stateManager.setState(args.sessionId, 'auth_context', authContext, {
        source: 'authenticator',
        validated: true
      });

      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'authenticator',
        agent_action: 'authenticate',
        output_data: { user_id: authContext.user_id },
        success: true,
        natural_response: `Authenticated as ${authContext.name}`,
        duration_ms: Date.now() - startTime
      });

      return {
        success: true,
        agentRole: 'authenticator',
        action: 'authenticate',
        naturalResponse: `Welcome back, ${authContext.name}!`,
        stateUpdates: {
          is_authenticated: true,
          is_anonymous: false,
          user_id: authContext.user_id,
          user_name: authContext.name,
          user_email: authContext.email
        }
      };
    } catch (error: any) {
      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'authenticator',
        agent_action: 'authenticate',
        success: false,
        error_message: error.message,
        duration_ms: Date.now() - startTime
      });

      return {
        success: false,
        agentRole: 'authenticator',
        action: 'authenticate',
        error: error.message,
        naturalResponse: 'I\'m having trouble verifying your authentication. Please try again.'
      };
    }
  }

  /**
   * Validate JWT token and extract user info
   * This is a simplified version - in production, use proper JWT verification
   */
  private async validateToken(token: string): Promise<AuthContext | null> {
    try {
      // Decode JWT token (simplified - in production use jsonwebtoken library)
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return null;
      }

      // Extract user ID from payload
      const userId = payload.sub || payload.user_id;
      if (!userId) return null;

      // Fetch user details from database
      const userResult = await client`
        SELECT
          id,
          email,
          name
        FROM app.d_employee
        WHERE id = ${userId}::uuid
        LIMIT 1
      `;

      if (userResult.length === 0) return null;

      const user = userResult[0];

      // TODO: Fetch user roles and permissions
      // For now, return basic context
      return {
        user_id: user.id,
        tenant_id: null, // d_employee table doesn't have tenant_id
        email: user.email,
        name: user.name,
        roles: ['user'], // TODO: Fetch from RBAC tables
        permissions: ['customer:read', 'customer:write', 'booking:write', 'employee:read', 'task:write', 'calendar:write']
      };
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  /**
   * Check if user has required permissions
   */
  private async checkPermissions(
    authContext: AuthContext,
    requiredPermissions: string[]
  ): Promise<boolean> {
    if (!authContext.permissions) return false;

    // Check if user has all required permissions
    return requiredPermissions.every(required =>
      authContext.permissions!.includes(required)
    );
  }
}

// Export singleton instance
export const authenticatorAgent = new AuthenticatorAgent();
