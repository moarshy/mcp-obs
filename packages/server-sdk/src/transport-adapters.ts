/**
 * Transport-specific OAuth adapters for different MCP transport types
 * Handles Bearer token extraction and error responses for each transport
 */

import type { Request as MCPRequest } from "@modelcontextprotocol/sdk/types.js";
import { type AuthContext, type OAuthConfig } from "./oauth-validator.js";
import { type AuthenticatedHandler, type RequestHandler, withOAuth, configureOAuthValidator, createOAuthChallengeHeaders } from "./oauth-middleware.js";

export interface TransportAdapterConfig extends OAuthConfig {
  /** Required scopes for all protected endpoints */
  requiredScopes?: string[];
  /** Skip OAuth validation for specific tools */
  skipValidationFor?: string[];
}

/**
 * Stdio Transport OAuth Adapter
 * Handles Bearer token extraction from MCP request metadata for stdio transport
 */
export class StdioOAuthAdapter {
  private config: TransportAdapterConfig;

  constructor(config: TransportAdapterConfig) {
    this.config = config;
    configureOAuthValidator(config);
  }

  /**
   * Wrap a request handler with OAuth authentication for stdio transport
   */
  withOAuth<T extends MCPRequest>(
    handler: AuthenticatedHandler<T>
  ): RequestHandler<T> {
    return async (request: T): Promise<any> => {
      if (this.config.debug) {
        console.error(`[OAuth Stdio] Processing request: ${(request as any).method}`);
      }

      try {
        return await withOAuth(handler, {
          requiredScopes: this.config.requiredScopes,
          skipValidationFor: this.config.skipValidationFor
        })(request);
      } catch (error) {
        if (this.config.debug) {
          console.error(`[OAuth Stdio] Authentication failed:`, error);
        }
        throw error;
      }
    };
  }

  /**
   * Extract Bearer token from stdio request metadata
   * Stdio transport typically passes auth in request metadata
   */
  static extractToken(request: MCPRequest): string | null {
    // Check various metadata locations for stdio transport
    const metadata = (request as any).metadata;
    if (metadata) {
      // Standard Authorization header in metadata
      if (metadata.authorization && metadata.authorization.startsWith('Bearer ')) {
        return metadata.authorization.slice(7);
      }
      if (metadata.Authorization && metadata.Authorization.startsWith('Bearer ')) {
        return metadata.Authorization.slice(7);
      }

      // MCP-specific auth field
      if (metadata.auth && typeof metadata.auth === 'string' && metadata.auth.startsWith('Bearer ')) {
        return metadata.auth.slice(7);
      }
    }

    // Check if token is passed directly in request
    if ((request as any).authorization && (request as any).authorization.startsWith('Bearer ')) {
      return (request as any).authorization.slice(7);
    }

    return null;
  }
}

/**
 * HTTP Transport OAuth Adapter
 * Handles Bearer token extraction from HTTP Authorization headers
 */
export class HTTPOAuthAdapter {
  private config: TransportAdapterConfig;

  constructor(config: TransportAdapterConfig) {
    this.config = config;
    configureOAuthValidator(config);
  }

  /**
   * Wrap a request handler with OAuth authentication for HTTP transport
   */
  withOAuth<T extends MCPRequest>(
    handler: AuthenticatedHandler<T>
  ): RequestHandler<T> {
    return async (request: T): Promise<any> => {
      if (this.config.debug) {
        console.error(`[OAuth HTTP] Processing request: ${(request as any).method}`);
      }

      try {
        return await withOAuth(handler, {
          requiredScopes: this.config.requiredScopes,
          skipValidationFor: this.config.skipValidationFor
        })(request);
      } catch (error) {
        if (this.config.debug) {
          console.error(`[OAuth HTTP] Authentication failed:`, error);
        }

        // For HTTP transport, we can enhance the error with proper HTTP headers
        const enhancedError = error as any;
        const challengeHeaders = await createOAuthChallengeHeaders(
          this.config.serverSlug,
          this.config.serverId,
          this.config.generateWWWAuthenticateHeaderFn
        );
        enhancedError.headers = {
          ...enhancedError.headers,
          ...challengeHeaders
        };

        throw enhancedError;
      }
    };
  }

  /**
   * Extract Bearer token from HTTP request headers
   */
  static extractToken(request: MCPRequest): string | null {
    const headers = (request as any).headers;
    if (headers) {
      // Standard Authorization header
      if (headers.authorization && headers.authorization.startsWith('Bearer ')) {
        return headers.authorization.slice(7);
      }
      if (headers.Authorization && headers.Authorization.startsWith('Bearer ')) {
        return headers.Authorization.slice(7);
      }
    }

    return null;
  }

  /**
   * Create HTTP 401 response with proper OAuth challenge headers
   */
  static async createUnauthorizedResponse(
    serverSlug: string,
    serverId?: string,
    error: string = 'Unauthorized',
    generateWWWAuthenticateHeaderFn?: (serverId: string, realm?: string, error?: string, errorDescription?: string) => Promise<string>
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: any;
  }> {
    const challengeHeaders = await createOAuthChallengeHeaders(serverSlug, serverId, generateWWWAuthenticateHeaderFn);

    return {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...challengeHeaders
      },
      body: {
        error: 'unauthorized',
        error_description: error,
        resource_metadata: `https://${serverSlug}.mcp-obs.com/.well-known/oauth-protected-resource`
      }
    };
  }
}

/**
 * Streamable HTTP Transport OAuth Adapter
 * Handles Bearer token extraction for both HTTP requests and SSE connections
 */
export class StreamableHTTPOAuthAdapter {
  private config: TransportAdapterConfig;

  constructor(config: TransportAdapterConfig) {
    this.config = config;
    configureOAuthValidator(config);
  }

  /**
   * Wrap a request handler with OAuth authentication for streamable HTTP transport
   */
  withOAuth<T extends MCPRequest>(
    handler: AuthenticatedHandler<T>
  ): RequestHandler<T> {
    return async (request: T): Promise<any> => {
      if (this.config.debug) {
        console.error(`[OAuth Streamable] Processing request: ${(request as any).method}`);
      }

      try {
        return await withOAuth(handler, {
          requiredScopes: this.config.requiredScopes,
          skipValidationFor: this.config.skipValidationFor
        })(request);
      } catch (error) {
        if (this.config.debug) {
          console.error(`[OAuth Streamable] Authentication failed:`, error);
        }
        throw error;
      }
    };
  }

  /**
   * Extract Bearer token from streamable HTTP request
   * Can handle both regular HTTP requests and SSE connection metadata
   */
  static extractToken(request: MCPRequest): string | null {
    // Try HTTP headers first
    const token = HTTPOAuthAdapter.extractToken(request);
    if (token) {
      return token;
    }

    // Check session context for SSE connections
    const session = (request as any).session;
    if (session && session.authorization && session.authorization.startsWith('Bearer ')) {
      return session.authorization.slice(7);
    }

    // Check connection metadata for streaming
    const connection = (request as any).connection;
    if (connection && connection.headers) {
      if (connection.headers.authorization && connection.headers.authorization.startsWith('Bearer ')) {
        return connection.headers.authorization.slice(7);
      }
      if (connection.headers.Authorization && connection.headers.Authorization.startsWith('Bearer ')) {
        return connection.headers.Authorization.slice(7);
      }
    }

    return null;
  }

  /**
   * Express.js middleware for OAuth protection
   * Use this with Express apps for HTTP/streamable transport
   */
  expressMiddleware() {
    const self = this;
    return async (req: any, res: any, next: any) => {
      // Skip OAuth for health checks and public endpoints
      if (self.isPublicEndpoint(req.path)) {
        if (self.config.debug) {
          console.log(`[OAuth Express] Skipping OAuth for public endpoint: ${req.path}`);
        }
        return next();
      }

      // Handle body buffering for POST requests (MCP session initialization)
      // This preserves streams while enabling session logic - ALL COMPLEXITY IN SDK!
      // Only buffer body for MCP endpoints (not public OAuth proxy endpoints)
      if (req.method === 'POST') {
        console.log('[OAuth Express] Buffering body for MCP session logic');

        try {
          // Buffer the entire request body
          const chunks: Buffer[] = [];
          let totalLength = 0;

          // Create a promise to buffer the body
          const bodyPromise = new Promise<Buffer>((resolve, reject) => {
            req.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
              totalLength += chunk.length;
            });

            req.on('end', () => {
              resolve(Buffer.concat(chunks, totalLength));
            });

            req.on('error', reject);

            // Set a timeout to prevent hanging
            setTimeout(() => reject(new Error('Body buffering timeout')), 10000);
          });

          const bodyBuffer = await bodyPromise;

          // Parse JSON body for session logic
          if (bodyBuffer.length > 0) {
            const bodyText = bodyBuffer.toString('utf8');
            req.body = JSON.parse(bodyText);
            console.log('[OAuth Express] Parsed body for session logic');
          } else {
            req.body = {};
            console.log('[OAuth Express] Empty body, using empty object');
          }

          // Store the buffered body for the server to recreate streams as needed
          // This approach doesn't modify Express request properties
          (req as any)._mcpOAuthBufferedBody = bodyBuffer;
          (req as any)._mcpOAuthBodyParsed = true;

          console.log('[OAuth Express] Body buffered successfully, size:', bodyBuffer.length);

        } catch (bufferError) {
          console.error('[OAuth Express] Body buffering error:', bufferError);
          req.body = {};
          return res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32700,
              message: 'Parse error: Invalid JSON in request body'
            },
            id: null
          });
        }
      }

      const token = self.extractTokenFromExpress(req);
      if (!token) {
        if (self.config.debug) {
          console.error('[OAuth Express] No Bearer token found in request');
        }
        return self.sendUnauthorizedResponse(res, req, 'Authentication required');
      }

      try {
        // Use HTTP-based validation (standalone SDK pattern)
        const { OAuthTokenValidator } = await import('./oauth-validator.js');
        const validator = new OAuthTokenValidator(self.config);
        const authContext = await validator.validateToken(token);

        if (!authContext) {
          return self.sendUnauthorizedResponse(res, req, 'Invalid or expired token');
        }

        if (self.config.debug) {
          console.log(`[OAuth Express] Successfully authenticated user: ${authContext.email}`);
        }

        // Attach auth context to request
        req.authContext = authContext;
        next();
      } catch (error) {
        if (self.config.debug) {
          console.error('[OAuth Express] Middleware error:', error);
        }
        return self.sendUnauthorizedResponse(res, req, 'Token validation failed');
      }
    };
  }

  /**
   * Send OAuth challenge response with proper resource_metadata for discovery
   */
  private sendUnauthorizedResponse(res: any, req: any, message: string) {
    const host = req.headers.host || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    // Construct proper OAuth server URL with subdomain for server slug
    let authServerUrl: string;
    if (this.config.platformUrl && this.config.serverSlug) {
      // For localhost development, use serverSlug.localhost pattern
      if (this.config.platformUrl.includes('localhost')) {
        const port = this.config.platformUrl.match(/:(\d+)/)?.[1] || '3000';
        authServerUrl = `${protocol}://${this.config.serverSlug}.localhost:${port}`;
      } else {
        // For production, use serverSlug.mcp-obs.com pattern
        authServerUrl = `https://${this.config.serverSlug}.mcp-obs.com`;
      }
    } else if (this.config.serverSlug) {
      authServerUrl = `https://${this.config.serverSlug}.mcp-obs.com`;
    } else if (this.config.platformUrl) {
      authServerUrl = this.config.platformUrl;
    } else {
      authServerUrl = `${protocol}://${host}`;
    }

    const wwwAuthenticateValue = `Bearer resource_metadata=${authServerUrl}/.well-known/oauth-authorization-server`;

    // Set headers before sending JSON response
    if (this.config.debug) {
      console.log(`[OAuth] Setting WWW-Authenticate header: ${wwwAuthenticateValue}`);
    }
    res.set('WWW-Authenticate', wwwAuthenticateValue);

    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: `Unauthorized: ${message}`,
        'www-authenticate': wwwAuthenticateValue
      },
      id: null
    });
  }

  /**
   * Extract Bearer token from Express request
   */
  private extractTokenFromExpress(req: any): string | null {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }

  /**
   * Check if endpoint should be public (no OAuth required)
   */
  private isPublicEndpoint(path: string): boolean {
    const publicPaths = [
      '/health',
      '/status',
      '/.well-known/',
      '/favicon.ico',
      '/register',    // OAuth proxy endpoints
      '/token',
      '/authorize'
    ];

    return publicPaths.some(publicPath => path.startsWith(publicPath));
  }

  /**
   * Create OAuth proxy endpoints for MCP clients that don't follow discovery URLs properly
   * Call this to add /register, /token, and /authorize endpoints to your Express app
   */
  createOAuthProxyEndpoints(app: any) {
    console.log('🚀 [OAuth Proxy] createOAuthProxyEndpoints called');
    console.log('🔧 [OAuth Proxy] Config:', { platformUrl: this.config.platformUrl, serverSlug: this.config.serverSlug });
    // Construct proper OAuth server URL with subdomain for server slug
    let platformUrl: string;
    if (this.config.platformUrl && this.config.serverSlug) {
      // For localhost development, use serverSlug.localhost pattern
      if (this.config.platformUrl.includes('localhost')) {
        const port = this.config.platformUrl.match(/:(\d+)/)?.[1] || '3000';
        const protocol = this.config.platformUrl.startsWith('https') ? 'https' : 'http';
        platformUrl = `${protocol}://${this.config.serverSlug}.localhost:${port}`;
      } else {
        // For production, use serverSlug.mcp-obs.com pattern
        platformUrl = `https://${this.config.serverSlug}.mcp-obs.com`;
      }
    } else if (this.config.serverSlug) {
      platformUrl = `https://${this.config.serverSlug}.mcp-obs.com`;
    } else if (this.config.platformUrl) {
      platformUrl = this.config.platformUrl;
    } else {
      platformUrl = 'https://mcp-obs.com';
    }

    // OAuth client registration endpoint
    console.log('🔧 [OAuth Proxy] Setting up /register endpoint');
    app.post('/register', (req: any, res: any) => {
      console.log('📥 [OAuth Proxy] /register endpoint called');

      // Handle JSON body parsing internally (like /token endpoint)
      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          // Parse JSON body
          let parsedBody: any = {};
          if (body.trim()) {
            parsedBody = JSON.parse(body);
          }

          if (this.config.debug) {
            console.log('🔧 [OAuth Proxy] Registration request body:', parsedBody);
          }

          const response = await fetch(`${platformUrl}/mcp-auth/oauth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedBody)
          });
          const data = await response.json();

          if (this.config.debug) {
            console.log('✅ [OAuth Proxy] Registration response:', response.status, data);
          }

          res.status(response.status).json(data);
        } catch (error) {
          if (this.config.debug) {
            console.error('[OAuth Proxy] Registration error:', error);
          }
          res.status(500).json({ error: 'oauth_proxy_error', error_description: 'Registration failed' });
        }
      });
    });

    // OAuth token exchange endpoint with built-in form parsing
    console.log('🔧 [OAuth Proxy] Setting up /token endpoint');
    app.post('/token', (req: any, res: any, next: any) => {
      console.log('📥 [OAuth Proxy] /token endpoint called');
      // Handle form parsing internally without requiring server middleware
      if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            // Parse form data internally
            const parsedBody: any = {};
            const urlParams = new URLSearchParams(body);
            for (const [key, value] of urlParams) {
              parsedBody[key] = value;
            }
            req.body = parsedBody;

            await this.handleTokenRequest(req, res);
          } catch (error) {
            if (this.config.debug) {
              console.error('🔄 [OAuth Proxy] Form parsing error:', error);
            }
            res.status(500).json({ error: 'form_parsing_error' });
          }
        });
      } else {
        // Handle JSON body (already parsed by server)
        this.handleTokenRequest(req, res);
      }
    });

    console.log('🔧 [OAuth Proxy] About to set up /authorize endpoint...');

    // OAuth authorization endpoint (redirect)
    console.log('🔧 [OAuth Proxy] Setting up /authorize endpoint');
    app.get('/authorize', (req: any, res: any) => {
      console.log('📥 [OAuth Proxy] /authorize endpoint called');
      try {
        const queryString = new URLSearchParams(req.query || {}).toString();
        const redirectUrl = `${platformUrl}/mcp-auth/oauth/authorize?${queryString}`;
        res.redirect(redirectUrl);
      } catch (error) {
        if (this.config.debug) {
          console.error('[OAuth Proxy] Authorization redirect error:', error);
        }
        res.status(500).json({ error: 'oauth_proxy_error', error_description: 'Authorization failed' });
      }
    });

    if (this.config.debug) {
      console.log(`[OAuth Proxy] Added OAuth endpoints: /register, /token, /authorize → ${platformUrl}`);
    }
  }

  private async handleTokenRequest(req: any, res: any) {
    try {
      if (this.config.debug) {
        console.log('🔄 [OAuth Proxy] Content-Type:', req.headers['content-type']);
        console.log('🔄 [OAuth Proxy] Proxying token request:', req.body);
      }

      // Construct platform URL (same logic as in createOAuthProxyEndpoints)
      let platformUrl: string;
      if (this.config.platformUrl && this.config.serverSlug) {
        if (this.config.platformUrl.includes('localhost')) {
          const port = this.config.platformUrl.match(/:(\d+)/)?.[1] || '3000';
          const protocol = this.config.platformUrl.startsWith('https') ? 'https' : 'http';
          platformUrl = `${protocol}://${this.config.serverSlug}.localhost:${port}`;
        } else {
          platformUrl = `https://${this.config.serverSlug}.mcp-obs.com`;
        }
      } else if (this.config.serverSlug) {
        platformUrl = `https://${this.config.serverSlug}.mcp-obs.com`;
      } else if (this.config.platformUrl) {
        platformUrl = this.config.platformUrl;
      } else {
        platformUrl = 'https://mcp-obs.com';
      }

      const formData = new URLSearchParams();
      Object.entries(req.body || {}).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      // Ensure grant_type is present for authorization_code flow
      if (!formData.has('grant_type')) {
        formData.append('grant_type', 'authorization_code');
      }

      if (this.config.debug) {
        console.log('🔄 [OAuth Proxy] Token request body:', formData.toString());
      }

      const response = await fetch(`${platformUrl}/mcp-auth/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      const data = await response.json();

      if (this.config.debug) {
        console.log('✅ [OAuth Proxy] Token response:', response.status, data);
      }

      res.status(response.status).json(data);
    } catch (error) {
      if (this.config.debug) {
        console.error('[OAuth Proxy] Token error:', error);
      }
      res.status(500).json({ error: 'oauth_proxy_error', error_description: 'Token exchange failed' });
    }
  }
}

/**
 * Factory function to create appropriate OAuth adapter based on transport type
 */
export function createOAuthAdapter(
  transportType: 'stdio' | 'http' | 'streamable-http',
  config: TransportAdapterConfig
): StdioOAuthAdapter | HTTPOAuthAdapter | StreamableHTTPOAuthAdapter {
  switch (transportType) {
    case 'stdio':
      return new StdioOAuthAdapter(config);
    case 'http':
      return new HTTPOAuthAdapter(config);
    case 'streamable-http':
      return new StreamableHTTPOAuthAdapter(config);
    default:
      throw new Error(`Unsupported transport type: ${transportType}`);
  }
}

/**
 * Unified OAuth configuration helper
 * Creates appropriate adapter configuration for mcp-obs OAuth server
 */
export function createOAuthConfig(
  serverSlug: string,
  options?: {
    requiredScopes?: string[];
    skipValidationFor?: string[];
    debug?: boolean;
    platformUrl?: string;
  }
): TransportAdapterConfig {
  return {
    serverSlug,
    platformUrl: options?.platformUrl,
    requiredScopes: options?.requiredScopes || [],
    skipValidationFor: options?.skipValidationFor || [],
    debug: options?.debug || false
  };
}