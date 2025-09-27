/**
 * OAuth token validation utilities for MCP servers
 * Uses direct database validation (MCPlatform pattern)
 */

export interface TokenValidationResult {
  valid: boolean;
  token?: {
    id: string;
    accessToken: string;
    tokenType: string;
    scope?: string;
    expiresAt: Date;
    clientId: string;
    userId?: string;
    mcpServerId: string;
  };
  user?: {
    id: string;
    email: string;
    name?: string;
    image?: string;
  };
  client?: {
    id: string;
    clientId: string;
    clientName: string;
    clientUri?: string;
  };
  server?: {
    id: string;
    name: string;
    slug: string;
    organizationId: string;
    issuerUrl: string;
  };
  error?: string;
}

export interface OAuthConfig {
  /** MCP server slug (e.g., "test" for test.mcp-obs.com) */
  serverSlug: string;
  /** Platform base URL (e.g., "http://localhost:3000" or "https://my-org.mcp-obs.com") */
  platformUrl?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface AuthContext {
  /** User ID from the OAuth token */
  userId: string;
  /** User email address */
  email: string;
  /** User display name */
  name?: string;
  /** User profile image */
  image?: string;
  /** OAuth scopes granted to the token */
  scopes: string[];
  /** OAuth client ID that requested the token */
  clientId: string;
  /** Token expiration timestamp (milliseconds since epoch) */
  expiresAt: number;
}

export class OAuthTokenValidator {
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Validate a Bearer token using HTTP request to mcp-obs platform
   * @param token The Bearer token to validate
   * @returns AuthContext if valid, null if invalid
   */
  async validateToken(token: string): Promise<AuthContext | null> {
    try {
      const platformUrl = this.config.platformUrl || `https://${this.config.serverSlug}.mcp-obs.com`;

      if (this.config.debug) {
        console.log(`[OAuth] Validating token with platform: ${platformUrl}`);
      }

      // Make HTTP request to introspect token
      const response = await fetch(`${platformUrl}/api/mcp-oauth/introspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token,
          server_slug: this.config.serverSlug
        })
      });

      if (!response.ok) {
        if (this.config.debug) {
          console.error(`[OAuth] HTTP error ${response.status}: ${response.statusText}`);
        }
        return null;
      }

      const introspection = await response.json();

      if (!introspection.active) {
        if (this.config.debug) {
          console.error('[OAuth] Token is not active');
        }
        return null;
      }

      const authContext: AuthContext = {
        userId: introspection.sub || introspection['mcp:user_id'] || 'unknown',
        email: introspection.username || 'unknown',
        name: introspection.name,
        image: introspection.picture,
        scopes: introspection.scope ? introspection.scope.split(' ') : [],
        clientId: introspection.client_id || 'unknown',
        expiresAt: introspection.exp ? introspection.exp * 1000 : Date.now() + 3600000
      };

      if (this.config.debug) {
        console.log(`[OAuth] Token validation successful for user: ${authContext.email}`);
      }

      return authContext;

    } catch (error) {
      console.error('[OAuth] Token validation error:', error);
      return null;
    }
  }

  /**
   * Extract Bearer token from Authorization header
   * @param authHeader The Authorization header value
   * @returns The Bearer token or null if not found
   */
  extractBearerToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }

  /**
   * Check if token has required scopes
   * @param authContext The validated auth context
   * @param requiredScopes Array of required scopes
   * @returns True if all required scopes are present
   */
  hasRequiredScopes(authContext: AuthContext, requiredScopes: string[]): boolean {
    return requiredScopes.every(scope => authContext.scopes.includes(scope));
  }

}