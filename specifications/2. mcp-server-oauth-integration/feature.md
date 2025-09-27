---
date: 2025-01-25T16:30:00+00:00
researcher: Claude Code
git_commit: f3960a5
branch: main
repository: mcp-obs
topic: "MCP Server OAuth Integration Feature Specification"
tags: [feature, requirements, specification, mcp-server, oauth-middleware, server-sdk, token-validation, bearer-auth]
status: complete
last_updated: 2025-01-25
last_updated_by: Claude Code
type: feature
---

# MCP Server OAuth Integration Feature

## Overview
Enable MCP servers to easily integrate OAuth authentication by validating Bearer tokens from the mcp-obs OAuth authorization server. This feature provides middleware patterns, SDK utilities, and request interception mechanisms that allow MCP servers to protect their tools and resources with minimal integration effort.

## Business Value

### For mcp-obs Customers
- **Drop-in Authentication**: Add OAuth protection to existing MCP servers with minimal code changes
- **Enterprise-Ready Security**: Industry-standard Bearer token validation with proper audience and scope checking
- **Seamless Integration**: Works with existing MCP server implementations across all transport types (stdio, HTTP, streamable HTTP)
- **Centralized User Management**: Leverage mcp-obs OAuth system for user authentication and session management

### For End-Users
- **Transparent Security**: OAuth authentication happens before MCP tool access, ensuring secure interactions
- **Consistent Experience**: Same OAuth flow across all protected MCP servers in the organization
- **Token-Based Access**: Standard Bearer token authentication that works with any MCP client
- **Proper Session Management**: Secure token refresh and validation without disrupting MCP workflows

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions:
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
We have a comprehensive MCP Auth OAuth system (specifications/1. dual-auth-system/2. mcp-auth/feature.md) that provides:
- Subdomain-based OAuth authorization servers for each MCP server
- Dynamic client registration and RFC 8414 compliant discovery endpoints
- JWT token generation with audience and scope validation
- Better Auth integration for end-user authentication

Our demo MCP server (/demo-mcp) currently implements three transport types but has no authentication.

### Composition Pattern
- **Server Middleware**: OAuth validation middleware that wraps existing MCP servers
- **Token Validation**: Server-side utilities for Bearer token validation against mcp-obs OAuth endpoints
- **Request Interception**: Middleware that intercepts MCP requests before tool execution
- **Server SDK Integration**: Easy-to-use patterns for integrating OAuth into existing MCP server code

### Data Model
Token validation relies on the existing MCP Auth database schema with mcpOauthToken, mcpServer, and mcpEndUser tables for token introspection and audience validation.

## User Stories
(in given/when/then format)

### MCP Server Integration
1. **Developer Integration**: **Given** I have an existing MCP server, **when** I add the mcp-obs Server SDK OAuth middleware with my server's subdomain, **then** all MCP tool requests should require valid Bearer tokens from the mcp-obs OAuth system - *Add OAuth protection in under 5 lines of code*

2. **Token Validation**: **Given** an MCP client sends a request with `Authorization: Bearer <token>`, **when** the middleware validates the token, **then** it should verify the token is valid, not expired, has the correct audience (MCP server), and includes proper scope claims - *Comprehensive token security validation*

### Request Flow Protection
3. **Unauthorized Access**: **Given** an MCP client sends a request without Authorization header, **when** the middleware processes the request, **then** it should return HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="https://test.mcp-obs.com/.well-known/oauth-protected-resource"` - *Proper OAuth challenge response*

4. **Invalid Token Handling**: **Given** an MCP client sends a request with an invalid or expired token, **when** the middleware validates the token, **then** it should return HTTP 401 with error details and the client should be able to refresh or re-authenticate - *Clear error handling for token issues*

### Multi-Transport Support
5. **Stdio Transport**: **Given** an MCP server using stdio transport with OAuth middleware, **when** MCP clients connect and send tool requests, **then** the middleware should extract Bearer tokens from request metadata and validate them before executing tools - *OAuth protection for stdio MCP servers*

6. **HTTP Transport**: **Given** an MCP server using HTTP/streamable HTTP transport, **when** MCP clients send HTTP requests with Authorization headers, **then** the middleware should validate Bearer tokens using standard HTTP authentication patterns - *Standard HTTP Bearer authentication*

### Development & Testing
7. **Demo Server Integration**: **Given** our demo MCP server in /demo-mcp, **when** I enable OAuth middleware pointing to the "test" server slug, **then** the echo tool should require valid OAuth tokens from test.mcp-obs.com before responding - *Working demo with OAuth protection*

8. **Local Development**: **Given** I'm developing with localhost OAuth setup, **when** I configure the middleware for development mode, **then** it should work with localhost URLs and development certificates while maintaining security validation - *Seamless local development experience*

## Core Functionality

### OAuth Middleware Layer
- **Request Interception**: Middleware that intercepts all MCP requests before tool execution
- **Bearer Token Extraction**: Parse Authorization header and extract Bearer tokens from requests
- **Token Validation**: Validate tokens against mcp-obs OAuth introspection endpoint with caching
- **User Context Injection**: Attach validated user information to MCP request context

### Multi-Transport Authentication
- **Stdio Transport Auth**: Handle Bearer token validation for stdio-based MCP servers
- **HTTP Transport Auth**: Standard HTTP Bearer authentication for HTTP and streamable HTTP transports
- **Metadata Handling**: Properly extract tokens from different transport metadata formats
- **Error Response Generation**: Transport-appropriate error responses for authentication failures

### Server SDK Integration Patterns
- **Wrapper Functions**: High-level functions that wrap existing MCP servers with OAuth
- **Decorator Patterns**: Method decorators for protecting individual MCP tools
- **Configuration Management**: Simple configuration for OAuth endpoint URLs and validation settings
- **Error Handling**: Comprehensive error handling with proper OAuth error codes

### Token Validation & Caching
- **Introspection Client**: HTTP client for validating tokens against mcp-obs OAuth server
- **Response Caching**: Cache valid tokens for performance with proper expiration handling
- **Audience Validation**: Ensure tokens are issued for the specific MCP server
- **Scope Enforcement**: Validate token scopes against required permissions for tools

## Requirements

### Functional Requirements
- **Bearer Token Support**: Extract and validate Bearer tokens from Authorization headers
- **Transport Compatibility**: Work with stdio, HTTP, and streamable HTTP MCP transports
- **Token Introspection**: Validate tokens against mcp-obs OAuth introspection endpoint
- **Audience Validation**: Ensure tokens are issued for the specific MCP server (proper subdomain)
- **Scope Checking**: Validate token scopes against tool requirements (read, write, admin)
- **Error Handling**: Return proper OAuth error responses (401, 403) with WWW-Authenticate headers
- **User Context**: Provide validated user information to MCP tool handlers

### Non-Functional Requirements

#### Performance
- **Token Caching**: Cache validated tokens for 5-10 minutes to avoid repeated validation requests
- **Validation Latency**: Token validation should complete within 100ms for cached tokens, 500ms for fresh validation
- **Minimal Overhead**: OAuth middleware should add less than 10ms latency to non-cached requests

#### Security & Permissions
- **Secure Token Transmission**: Tokens must be transmitted in Authorization header, never in query parameters
- **Audience Binding**: Tokens validated only if issued for the specific MCP server audience
- **Scope Enforcement**: Tools can specify required scopes (read, write, admin) for access control
- **Token Expiration**: Respect token expiration times and reject expired tokens immediately
- **Secure Caching**: Cache tokens securely in memory without persistent storage

#### User Experience
- **Clear Error Messages**: Authentication failures provide clear, actionable error messages for debugging
- **Development Support**: Easy configuration for local development with development OAuth servers
- **Minimal Integration**: Existing MCP servers can add OAuth with minimal code changes

## Design Considerations

### Middleware Architecture
- **Pluggable Design**: OAuth middleware as optional plugin that can be enabled/disabled
- **Configuration-Driven**: Simple configuration object with OAuth server URL, audience, and caching settings
- **Transport Agnostic**: Same middleware interface works across all MCP transport types
- **Error Boundary**: Proper error isolation so authentication failures don't crash MCP server

### Token Validation Flow
- **Request Pipeline**: Intercept → Extract Token → Validate → Cache → Inject Context → Continue
- **Fallback Handling**: Graceful degradation when OAuth server is unavailable (configurable)
- **Retry Logic**: Smart retry for transient token validation failures
- **Logging Integration**: Detailed logging for authentication events and failures

### State Management
- **Stateless Validation**: No server-side session storage, rely entirely on token validation
- **Memory Caching**: In-memory LRU cache for validated tokens with configurable size limits
- **Context Propagation**: User context available throughout MCP tool execution
- **Request Correlation**: Track requests with correlation IDs for debugging and observability

## Implementation Considerations

### Technical Architecture
- **Server SDK Extension**: Extend existing Server SDK with OAuth middleware capabilities
- **HTTP Client**: Robust HTTP client for OAuth server communication with retries and timeouts
- **Transport Adapters**: Specific adapters for different MCP transport types
- **Configuration Schema**: TypeScript interfaces for OAuth middleware configuration

### Dependencies
- **HTTP Client Library**: For OAuth server communication (built-in fetch or dedicated HTTP library)
- **JWT Validation**: JWT parsing and validation capabilities (if using JWT tokens)
- **LRU Cache**: In-memory caching for token validation results
- **MCP SDK**: Integration with @modelcontextprotocol/sdk for proper MCP request handling

## Success Criteria

### Core Functionality
- OAuth middleware successfully validates Bearer tokens from mcp-obs OAuth server
- All three MCP transport types (stdio, HTTP, streamable HTTP) work with OAuth protection
- Token validation includes proper audience and scope checking
- Authentication failures return correct HTTP 401 responses with WWW-Authenticate headers
- Demo MCP server successfully protected with OAuth for "test" server slug

### Technical Implementation
- Token validation latency under performance requirements (100ms cached, 500ms fresh)
- Token caching reduces validation requests by >80% for repeated access
- Middleware adds minimal overhead to MCP request processing
- Error handling provides clear debugging information for integration issues
- Configuration supports both production and development environments

### Integration Success
- **Developer Experience**: Existing MCP servers can add OAuth protection in under 10 lines of code
- **Error Clarity**: Authentication failures provide actionable error messages for MCP client developers
- **Transport Compatibility**: Same middleware code works across all MCP transport types
- **Performance Impact**: OAuth validation adds <10ms overhead to authenticated requests

### Business Impact
- **Customer Adoption**: Customers can secure their MCP servers with minimal development effort
- **Security Compliance**: Enterprise customers can meet security requirements with proper OAuth validation
- **Developer Productivity**: Clear integration patterns reduce OAuth implementation time from days to hours
- **Platform Value**: Demonstrates clear value of mcp-obs OAuth infrastructure

## Scope Boundaries

### Definitely In Scope
- **Bearer Token Validation**: Complete OAuth Bearer token validation against mcp-obs OAuth server
- **Multi-Transport Support**: OAuth middleware for stdio, HTTP, and streamable HTTP transports
- **Server SDK Integration**: Easy-to-use patterns and utilities in the Server SDK
- **Token Caching**: Performance optimization with secure in-memory token caching
- **Demo Integration**: Working demo of OAuth-protected MCP server using "test" slug
- **Development Support**: Configuration and tooling for local OAuth development
- **Error Handling**: Comprehensive OAuth error responses and debugging information

### Definitely Out of Scope
- **OAuth Server Implementation**: OAuth server itself is already specified in MCP Auth feature
- **Client-Side OAuth**: OAuth flow handling in MCP clients (separate Client SDK feature)
- **Advanced Caching**: Persistent token storage or distributed caching
- **Custom Token Formats**: Support for non-standard or proprietary token formats
- **Authorization Policies**: Complex role-based access control beyond basic scope checking
- **Audit Logging**: Detailed audit trails for authentication events (compliance feature)

### Future Considerations
- **Advanced Scope Mapping**: Map OAuth scopes to specific MCP tools or resource permissions
- **Token Renewal**: Automatic token refresh handling within the middleware
- **Policy Engine**: Configurable authorization policies beyond scope checking
- **Metrics Integration**: Authentication metrics and analytics integration
- **Multi-Tenant Tokens**: Support for tokens that grant access to multiple MCP servers

## Open Questions & Risks

### Questions Needing Resolution
- **Token Format**: Are mcp-obs OAuth tokens JWT or opaque? This affects local validation vs introspection
- **Transport Metadata**: How do we pass Bearer tokens in stdio transport? MCP metadata or custom header?
- **Development URLs**: What OAuth server URL pattern for local development? localhost:3000/oauth?
- **Cache Invalidation**: How do we handle token revocation? Periodic cache clearing or push invalidation?
- **Tool-Level Scopes**: Do we need per-tool scope requirements or server-level is sufficient?

### Identified Risks
- **OAuth Server Dependency**: MCP servers become dependent on OAuth server availability for all requests
- **Performance Impact**: Token validation latency could impact MCP responsiveness
- **Token Caching Security**: In-memory token storage could be vulnerable to memory inspection
- **Transport Compatibility**: stdio transport may not have standard authentication header support
- **Configuration Complexity**: OAuth middleware configuration could be complex for developers

### Mitigation Strategies
- **Graceful Degradation**: Configurable fallback modes when OAuth server is unavailable
- **Caching Strategy**: Smart caching with short TTL to balance performance and security
- **Security Patterns**: Clear guidelines for secure token handling in different deployment scenarios
- **Transport Adaptation**: Custom metadata patterns for transports that don't support standard headers
- **Configuration Helpers**: Pre-built configuration templates for common deployment scenarios

## Next Steps
- Implement Bearer token validation client for mcp-obs OAuth server
- Create OAuth middleware for each MCP transport type (stdio, HTTP, streamable HTTP)
- Extend Server SDK with OAuth middleware utilities and configuration helpers
- Integrate OAuth protection into demo MCP server using "test" server slug
- Create comprehensive examples and documentation for OAuth integration patterns
- Test OAuth middleware with real MCP clients and validate performance requirements
- Ready for customers to add OAuth protection to their MCP servers with minimal effort

## Implementation Examples

### Basic Server SDK OAuth Integration

#### Express/HTTP Server Integration
```typescript
// demo-mcp/server/src/streamable-http-server-oauth.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpObsSDK, withOAuth } from "@mcp-obs/server-sdk";

const mcpObs = new McpObsSDK({
  serverName: "demo-mcp-server",
  version: "1.0.0",
  oauthConfig: {
    serverSlug: "test", // Maps to test.mcp-obs.com
    introspectionEndpoint: "https://test.mcp-obs.com/oauth/introspect",
    audience: "https://test.mcp-obs.com",
    cacheConfig: {
      ttlSeconds: 300, // 5 minute cache
      maxSize: 1000
    }
  }
});

const server = new Server(
  {
    name: "demo-mcp-server-oauth",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Protect all tools with OAuth
server.setRequestHandler(CallToolRequestSchema, withOAuth(async (request, authContext) => {
  // authContext contains validated user info from OAuth token
  const { userId, scopes, email } = authContext;

  if (request.params.name === "echo") {
    const args = request.params.arguments as EchoArgs;
    const message = args?.message || "Hello World!";

    return {
      content: [
        {
          type: "text",
          text: `hello from mcp-obs (OAuth protected): ${message} (user: ${email})`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
}));
```

#### Stdio Transport OAuth Integration
```typescript
// demo-mcp/server/src/stdio-server-oauth.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpObsSDK, withOAuthStdio } from "@mcp-obs/server-sdk";

const server = new Server(
  {
    name: "demo-mcp-stdio-oauth",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// OAuth middleware for stdio transport
const oauthMiddleware = withOAuthStdio({
  serverSlug: "test",
  introspectionEndpoint: "https://test.mcp-obs.com/oauth/introspect",
  audience: "https://test.mcp-obs.com"
});

server.setRequestHandler(CallToolRequestSchema, oauthMiddleware(async (request, authContext) => {
  // Same protected tool logic as HTTP version
  if (request.params.name === "echo") {
    const args = request.params.arguments as EchoArgs;
    const message = args?.message || "Hello World!";

    return {
      content: [
        {
          type: "text",
          text: `hello from mcp-obs (OAuth stdio): ${message} (user: ${authContext.email})`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
}));
```

### Server SDK OAuth Utilities

#### Token Validation Client
```typescript
// packages/server-sdk/src/oauth-validator.ts
export interface OAuthConfig {
  serverSlug: string;
  introspectionEndpoint: string;
  audience: string;
  cacheConfig?: {
    ttlSeconds: number;
    maxSize: number;
  };
}

export interface AuthContext {
  userId: string;
  email: string;
  scopes: string[];
  clientId: string;
  expiresAt: number;
}

export class OAuthTokenValidator {
  private config: OAuthConfig;
  private cache: Map<string, { context: AuthContext; expiresAt: number }> = new Map();

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  async validateToken(token: string): Promise<AuthContext | null> {
    // Check cache first
    const cached = this.cache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }

    try {
      // Call OAuth introspection endpoint
      const response = await fetch(this.config.introspectionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          token: token
        })
      });

      if (!response.ok) {
        return null;
      }

      const introspection = await response.json();

      if (!introspection.active) {
        return null;
      }

      // Validate audience
      if (introspection.aud !== this.config.audience) {
        throw new Error(`Token audience ${introspection.aud} does not match expected ${this.config.audience}`);
      }

      const authContext: AuthContext = {
        userId: introspection.user_id,
        email: introspection.email,
        scopes: introspection.scope?.split(' ') || [],
        clientId: introspection.client_id,
        expiresAt: introspection.exp * 1000 // Convert to milliseconds
      };

      // Cache the result
      const cacheExpiry = Math.min(
        authContext.expiresAt,
        Date.now() + (this.config.cacheConfig?.ttlSeconds || 300) * 1000
      );

      this.cache.set(token, {
        context: authContext,
        expiresAt: cacheExpiry
      });

      return authContext;

    } catch (error) {
      console.error('OAuth token validation failed:', error);
      return null;
    }
  }

  extractBearerToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }
}
```

#### OAuth Middleware Wrapper
```typescript
// packages/server-sdk/src/oauth-middleware.ts
import type { Request as MCPRequest } from "@modelcontextprotocol/sdk/types.js";

export function withOAuth<T extends MCPRequest>(
  handler: (request: T, authContext: AuthContext) => Promise<any>
) {
  return async (request: T): Promise<any> => {
    const validator = getOAuthValidator(); // Get configured validator

    // Extract Bearer token (implementation depends on transport)
    const token = extractTokenFromRequest(request);

    if (!token) {
      throw new MCPError(
        ErrorCode.InvalidRequest,
        'Authorization required. Include Bearer token in Authorization header.'
      );
    }

    const authContext = await validator.validateToken(token);

    if (!authContext) {
      throw new MCPError(
        ErrorCode.InvalidRequest,
        'Invalid or expired OAuth token'
      );
    }

    // Call original handler with auth context
    return handler(request, authContext);
  };
}
```

This comprehensive MCP Server OAuth Integration feature provides the middleware, utilities, and patterns needed to easily add OAuth protection to any MCP server using the mcp-obs OAuth authorization system.