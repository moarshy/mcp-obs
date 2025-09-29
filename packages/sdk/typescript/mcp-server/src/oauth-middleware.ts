/**
 * OAuth middleware utilities for MCP servers
 * Provides wrapper functions to add OAuth authentication to MCP request handlers
 */

import type { Request as MCPRequest, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { OAuthTokenValidator, type AuthContext, type OAuthConfig } from "./oauth-validator.js";

export interface MCPError extends Error {
  code: ErrorCode;
}

// Create MCP Error constructor
function createMCPError(code: ErrorCode, message: string): MCPError {
  const error = new Error(message) as MCPError;
  error.code = code;
  return error;
}

export interface OAuthMiddlewareConfig extends OAuthConfig {
  /** Required scopes for all protected endpoints */
  requiredScopes?: string[];
  /** Skip OAuth validation for specific tools */
  skipValidationFor?: string[];
  /** Support tool configuration */
  supportTool?: {
    enabled?: boolean;
    title?: string;
    description?: string;
    categories?: string[];
  };
}

export type AuthenticatedHandler<T extends MCPRequest> = (
  request: T,
  authContext: AuthContext
) => Promise<any>;

export type RequestHandler<T extends MCPRequest> = (request: T) => Promise<any>;

let globalValidator: OAuthTokenValidator | null = null;

/**
 * Configure global OAuth validator instance
 */
export function configureOAuthValidator(config: OAuthMiddlewareConfig): void {
  globalValidator = new OAuthTokenValidator(config);
}

/**
 * Get the configured OAuth validator instance
 */
export function getOAuthValidator(): OAuthTokenValidator {
  if (!globalValidator) {
    throw new Error('OAuth validator not configured. Call configureOAuthValidator() first.');
  }
  return globalValidator;
}

/**
 * Higher-order function that wraps MCP request handlers with OAuth authentication
 * @param handler The original request handler that expects auth context
 * @param options Optional configuration for this specific handler
 */
export function withOAuth<T extends MCPRequest>(
  handler: AuthenticatedHandler<T>,
  options?: {
    requiredScopes?: string[];
    skipValidationFor?: string[];
  }
): RequestHandler<T> {
  return async (request: T): Promise<any> => {
    const validator = getOAuthValidator();

    // Check if we should skip validation for this specific tool
    if (options?.skipValidationFor?.includes((request.params as any)?.name)) {
      // Call handler without auth context for skipped tools
      return handler(request, {
        userId: 'anonymous',
        email: 'anonymous@mcp-obs.com',
        scopes: [],
        clientId: 'anonymous',
        expiresAt: Date.now() + 3600000 // 1 hour from now
      });
    }

    // Extract Bearer token from request
    const token = extractTokenFromRequest(request);

    if (!token) {
      throw createMCPError(
        -32602, // Invalid params error code
        'Authorization required. Include Bearer token in Authorization header.'
      );
    }

    // Validate token
    const authContext = await validator.validateToken(token);

    if (!authContext) {
      throw createMCPError(
        -32602, // Invalid params error code
        'Invalid or expired OAuth token'
      );
    }

    // Check required scopes
    const requiredScopes = options?.requiredScopes || [];
    if (requiredScopes.length > 0 && !validator.hasRequiredScopes(authContext, requiredScopes)) {
      throw createMCPError(
        -32603, // Internal error code (closest to 403 Forbidden)
        `Insufficient scopes. Required: ${requiredScopes.join(', ')}, Got: ${authContext.scopes.join(', ')}`
      );
    }

    // Call original handler with auth context
    return handler(request, authContext);
  };
}

/**
 * Wrapper for stdio transport OAuth middleware
 * Handles Bearer token extraction from MCP request metadata
 */
export function withOAuthStdio<T extends MCPRequest>(
  config: OAuthMiddlewareConfig
): (handler: AuthenticatedHandler<T>) => RequestHandler<T> {
  // Configure validator if not already done
  if (!globalValidator) {
    configureOAuthValidator(config);
  }

  return (handler: AuthenticatedHandler<T>) => {
    return withOAuth(handler, {
      requiredScopes: config.requiredScopes,
      skipValidationFor: config.skipValidationFor
    });
  };
}

/**
 * Wrapper for HTTP transport OAuth middleware
 * Handles Bearer token extraction from HTTP Authorization headers
 */
export function withOAuthHTTP<T extends MCPRequest>(
  config: OAuthMiddlewareConfig
): (handler: AuthenticatedHandler<T>) => RequestHandler<T> {
  // Configure validator if not already done
  if (!globalValidator) {
    configureOAuthValidator(config);
  }

  return (handler: AuthenticatedHandler<T>) => {
    return withOAuth(handler, {
      requiredScopes: config.requiredScopes,
      skipValidationFor: config.skipValidationFor
    });
  };
}

/**
 * Extract Bearer token from MCP request
 * This is a transport-agnostic extraction that tries multiple methods
 */
function extractTokenFromRequest(request: MCPRequest): string | null {
  // Try to extract from different possible locations

  // Method 1: Check if request has an Authorization header (HTTP transports)
  const headers = (request as any).headers;
  if (headers && headers.authorization) {
    return getOAuthValidator().extractBearerToken(headers.authorization);
  }
  if (headers && headers.Authorization) {
    return getOAuthValidator().extractBearerToken(headers.Authorization);
  }

  // Method 2: Check MCP metadata (stdio transport)
  const metadata = (request as any).metadata;
  if (metadata && metadata.authorization) {
    return getOAuthValidator().extractBearerToken(metadata.authorization);
  }
  if (metadata && metadata.Authorization) {
    return getOAuthValidator().extractBearerToken(metadata.Authorization);
  }

  // Method 3: Check request params for authorization (fallback)
  const params = (request as any).params;
  if (params && params.authorization) {
    return getOAuthValidator().extractBearerToken(params.authorization);
  }

  // Method 4: Check top-level authorization field (custom transport)
  if ((request as any).authorization) {
    return getOAuthValidator().extractBearerToken((request as any).authorization);
  }

  return null;
}

/**
 * Utility function to create OAuth challenge response headers using injected function
 * For HTTP transports that need WWW-Authenticate header
 */
export async function createOAuthChallengeHeaders(
  serverSlug: string,
  serverId?: string,
  generateWWWAuthenticateHeaderFn?: (serverId: string, realm?: string, error?: string, errorDescription?: string) => Promise<string>
): Promise<Record<string, string>> {
  try {
    if (serverId && generateWWWAuthenticateHeaderFn) {
      // Use injected WWW-Authenticate header generation function
      const wwwAuth = await generateWWWAuthenticateHeaderFn(
        serverId,
        'MCP Server',
        'invalid_token',
        'Bearer token required'
      );
      return {
        'WWW-Authenticate': wwwAuth
      };
    }
  } catch (error) {
    console.error('[OAuth] Error generating WWW-Authenticate header:', error);
  }

  // Fallback to simple challenge header
  const protocol = serverSlug.includes('localhost') ? 'http' : 'https';
  const baseUrl = serverSlug.includes('localhost') ? serverSlug : `${serverSlug}.mcp-obs.com`;

  return {
    'WWW-Authenticate': `Bearer resource_metadata="${protocol}://${baseUrl}/.well-known/oauth-protected-resource"`
  };
}

/**
 * Utility to check if request is authenticated
 * Useful for conditional logic in handlers
 */
export function isAuthenticated(request: MCPRequest): boolean {
  try {
    const token = extractTokenFromRequest(request);
    return token !== null;
  } catch {
    return false;
  }
}

/**
 * Utility to get correlation ID for request tracking
 * Generates a unique ID for each request for logging/debugging
 */
export function getRequestCorrelationId(request: MCPRequest): string {
  // Try to get existing correlation ID
  const existing = (request as any).correlationId || (request as any).id;
  if (existing) {
    return existing.toString();
  }

  // Generate new correlation ID
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Configure MCP server with OAuth middleware and optional support tool
 * This is the main integration function that sets up both authentication and support
 */
export async function configureOAuthMCPServer(
  server: any, // MCP Server instance
  config: OAuthMiddlewareConfig
): Promise<void> {
  // Configure OAuth validator
  configureOAuthValidator(config);

  // Register support tool if enabled
  if (config.supportTool?.enabled) {
    const { registerSupportTool } = await import('./support-tool.js');

    await registerSupportTool(server, {
      enabled: true,
      title: config.supportTool.title,
      description: config.supportTool.description,
      categories: config.supportTool.categories,
      serverSlug: config.serverSlug,
      serverId: config.serverId
    });

    // Add support tool to skip validation list if not already there
    if (!config.skipValidationFor?.includes('get_support_tool')) {
      config.skipValidationFor = [...(config.skipValidationFor || []), 'get_support_tool'];
    }
  }

  console.log('✅ MCP Server configured with OAuth middleware' +
    (config.supportTool?.enabled ? ' and support tool' : ''));
}