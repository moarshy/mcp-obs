---
date: 2025-01-25T17:00:00+00:00
researcher: Claude Code
git_commit: f3960a5
branch: main
repository: mcp-obs
topic: "MCP Server OAuth Integration Implementation Strategy"
tags: [implementation, strategy, mcp-server, oauth-middleware, server-sdk, token-validation, bearer-auth]
status: complete
last_updated: 2025-01-25
last_updated_by: Claude Code
type: implementation_strategy
---

# MCP Server OAuth Integration Implementation Plan

## Overview

Implement OAuth middleware and SDK utilities that enable MCP servers to validate Bearer tokens from the mcp-obs OAuth authorization server. This provides drop-in authentication for customer MCP servers across all transport types (stdio, HTTP, streamable HTTP) with minimal integration effort.

## Current State Analysis

### Key Discoveries:
- **Token Format**: mcp-obs uses opaque tokens validated via database introspection (`packages/dashboard/src/app/api/mcp-oauth/introspect/route.ts:160-164`)
- **MCP Server Pattern**: Clean Server class usage with `setRequestHandler()` across all transports (`demo-mcp/server/src/index.ts:47`)
- **Existing Infrastructure**: Complete OAuth validation utilities at `packages/dashboard/src/lib/mcp-oauth/token-validation.ts:58-138`
- **Server SDK Structure**: Basic skeleton requiring OAuth middleware capabilities (`packages/server-sdk/index.ts:15-48`)

### What We're NOT Doing

- Not implementing OAuth server (already exists in MCP Auth system)
- Not modifying MCP client OAuth flows (separate Client SDK concern)
- Not changing database schema (using existing mcp-obs OAuth tables)
- Not implementing JWT validation (using introspection pattern)
- Not building persistent token caching (using in-memory with TTL)

## Implementation Approach

Use MCP SDK wrapper pattern to provide transport-agnostic OAuth middleware that integrates with existing mcp-obs OAuth infrastructure. Extend Server SDK with token validation utilities and request handler wrappers.

## Phase 1: Server SDK OAuth Foundation

### Overview
Create core OAuth validation and middleware utilities in the Server SDK package.

### Changes Required:

#### 1. OAuth Token Validator
**File**: `packages/server-sdk/src/oauth-validator.ts`
**Changes**: Create new file with token validation client

**Implementation Requirements:**
- OAuthConfig interface with serverSlug, introspectionEndpoint, audience, cacheConfig
- AuthContext interface with userId, email, scopes, clientId, expiresAt
- OAuthTokenValidator class with validateToken() method calling mcp-obs introspection endpoint
- In-memory LRU cache with configurable TTL (default 5 minutes) and max size (default 1000)
- Bearer token extraction helper extractBearerToken() from Authorization header
- HTTP client using fetch with proper Content-Type and Authorization headers
- Audience validation to ensure tokens match expected MCP server
- Comprehensive error handling with console.error logging for debugging

#### 2. OAuth Middleware Utilities
**File**: `packages/server-sdk/src/oauth-middleware.ts`
**Changes**: Create new file with middleware wrapper functions

**Implementation Requirements:**
- withOAuth() higher-order function that wraps MCP request handlers
- Transport-agnostic token extraction from MCP requests (HTTP headers, metadata, context)
- Integration with OAuthTokenValidator for token validation
- AuthContext injection into wrapped request handlers
- Proper error responses with MCP Error types and OAuth error codes
- Support for required scopes validation per tool
- Graceful error handling that doesn't crash MCP server
- Request correlation IDs for debugging and observability

#### 3. Transport Adapters
**File**: `packages/server-sdk/src/transport-adapters.ts`
**Changes**: Create new file with transport-specific OAuth integration

**Implementation Requirements:**
- Stdio transport adapter for Bearer token extraction from MCP metadata
- HTTP transport adapter for standard Authorization header extraction
- Streamable HTTP adapter with session-aware token validation
- Unified interface for token extraction across all transport types
- Transport-specific error response generation (HTTP 401 vs MCP errors)
- Context propagation patterns for each transport type

#### 4. Extended SDK Configuration
**File**: `packages/server-sdk/index.ts`
**Changes**: Extend existing MCPServerConfig and McpObsSDK class

**Implementation Requirements:**
- Add OAuth configuration fields to MCPServerConfig interface
- Add serverSlug, introspectionEndpoint, audience to config options
- Add cacheConfig with ttlSeconds and maxSize settings
- Extend McpObsSDK class with createOAuthMiddleware() method
- Add validateToken() method for direct token validation
- Add trackAuthenticatedToolUsage() for analytics with user context
- Maintain backward compatibility with existing SDK usage
- Configuration validation and helpful error messages

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] TypeScript compilation passes
- [ ] Unit tests pass for token validation logic
- [ ] HTTP client integration tests pass

**Manual Verification**
- [ ] OAuthTokenValidator successfully calls mcp-obs introspection endpoint
- [ ] Token caching reduces repeated validation requests
- [ ] Bearer token extraction works from Authorization headers
- [ ] Error handling provides clear debugging information
- [ ] Configuration validation catches invalid setups

## Phase 2: Multi-Transport OAuth Integration

### Overview
Implement OAuth protection for all three MCP transport types using the foundation from Phase 1.

### Changes Required:

#### 1. Stdio Transport OAuth Integration
**File**: `demo-mcp/server/src/stdio-server-oauth.ts`
**Changes**: Create OAuth-protected version of stdio server

**Implementation Requirements:**
- Import McpObsSDK and OAuth middleware utilities from Server SDK
- Configure OAuth middleware for "test" server slug pointing to test.mcp-obs.com
- Wrap CallToolRequestSchema handler with withOAuth() middleware
- Extract Bearer tokens from MCP request metadata or custom transport context
- Inject AuthContext (userId, email, scopes) into tool handlers
- Update echo tool to include authenticated user information in response
- Proper error handling for unauthorized requests in stdio context
- Maintain compatibility with existing MCP client patterns

#### 2. HTTP Transport OAuth Integration
**File**: `demo-mcp/server/src/http-server-oauth.ts`
**Changes**: Create OAuth-protected version of SSE HTTP server

**Implementation Requirements:**
- Add Express.js OAuth middleware before existing CORS and JSON middleware
- Configure OAuth validation for "test" server slug
- Extract Bearer tokens from standard HTTP Authorization headers
- Wrap MCP request handlers with OAuth validation
- Return proper HTTP 401 responses with WWW-Authenticate headers
- Update echo tool to show authenticated user context
- Handle CORS preflight requests for OAuth-enabled endpoints
- Session management integration with OAuth user context

#### 3. Streamable HTTP Transport OAuth Integration
**File**: `demo-mcp/server/src/streamable-http-server-oauth.ts`
**Changes**: Create OAuth-protected version of streamable HTTP server

**Implementation Requirements:**
- Integrate OAuth middleware with Express.js application layer
- Handle session-based OAuth context for persistent connections
- Extract Bearer tokens from HTTP headers with session correlation
- Validate tokens on both POST requests and GET SSE connections
- Update session management to include OAuth user context
- Modify echo tool to display authenticated user information
- Proper error handling for OAuth failures in streaming context
- Health check endpoint exemption from OAuth requirements

#### 4. Package.json Scripts Update
**File**: `demo-mcp/package.json`
**Changes**: Add scripts for OAuth-protected demo servers

**Implementation Requirements:**
- Add dev:server:oauth script for stdio OAuth demo
- Add dev:server:http:oauth script for SSE HTTP OAuth demo
- Add dev:server:streamable:oauth script for streamable HTTP OAuth demo
- Add demo:oauth script for complete OAuth demo workflow
- Update TypeScript build configuration to include new OAuth server files
- Ensure OAuth demo scripts use same dependencies as existing demos

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] TypeScript compilation passes for all OAuth server variants
- [ ] All OAuth demo scripts start without errors

**Manual Verification**
- [ ] Stdio OAuth server requires Bearer tokens for echo tool access
- [ ] HTTP OAuth server returns 401 with WWW-Authenticate header for unauthorized requests
- [ ] Streamable HTTP OAuth server validates tokens on both POST and SSE connections
- [ ] All OAuth servers display authenticated user context in echo tool responses
- [ ] Error responses provide actionable debugging information for developers

## Phase 3: Development & Testing Integration

### Overview
Configure OAuth middleware for local development and create comprehensive testing workflow.

### Changes Required:

#### 1. Development Configuration
**File**: `demo-mcp/oauth-config.json`
**Changes**: Create configuration file for local OAuth development

**Implementation Requirements:**
- Development OAuth server URLs pointing to localhost:3000 dashboard
- Test server slug configuration for consistent demo setup
- Cache configuration optimized for development (shorter TTL, smaller cache)
- Debug logging configuration with detailed OAuth validation steps
- Environment variable overrides for different development setups
- Documentation comments explaining each configuration option

#### 2. OAuth Testing Utilities
**File**: `demo-mcp/test-oauth-integration.js`
**Changes**: Create automated testing script for OAuth flows

**Implementation Requirements:**
- Script to test all three transport types with OAuth protection
- Mock Bearer token generation for testing (valid and invalid tokens)
- Automated tool call testing with proper authorization headers
- Error scenario testing (missing token, expired token, invalid audience)
- Performance testing to validate caching effectiveness
- Integration testing with real mcp-obs OAuth server endpoints

#### 3. Development Documentation
**File**: `demo-mcp/README-oauth.md`
**Changes**: Create OAuth integration guide

**Implementation Requirements:**
- Step-by-step setup guide for OAuth-protected MCP servers
- Bearer token acquisition workflow for testing
- Configuration options and environment variables explanation
- Debugging guide for common OAuth integration issues
- Transport-specific integration patterns and examples
- Performance optimization recommendations for production use

#### 4. Integration Examples
**File**: `demo-mcp/examples/oauth-integration-examples.ts`
**Changes**: Create comprehensive integration examples

**Implementation Requirements:**
- Basic OAuth middleware setup example
- Advanced configuration with custom scopes and caching
- Error handling examples with proper user feedback
- Tool-specific scope requirements implementation
- Multi-tenant configuration patterns
- Production deployment configuration templates

### Success Criteria:

**Automated verification**
- [ ] OAuth integration test script passes all scenarios
- [ ] Performance tests validate caching reduces requests by >80%
- [ ] Error scenario tests return proper OAuth error codes

**Manual Verification**
- [ ] Development setup guide allows OAuth integration in under 10 minutes
- [ ] All transport types work with localhost OAuth development setup
- [ ] Documentation provides clear troubleshooting guidance
- [ ] Integration examples demonstrate best practices
- [ ] OAuth middleware adds <10ms overhead to authenticated requests

## Phase 4: Production Readiness & Documentation

### Overview
Finalize production configuration, create comprehensive documentation, and validate enterprise readiness.

### Changes Required:

#### 1. Production Configuration Templates
**File**: `packages/server-sdk/templates/production-oauth-config.ts`
**Changes**: Create production-ready configuration templates

**Implementation Requirements:**
- HTTPS-only OAuth server URLs for production environments
- Optimized cache configuration for production workloads (10-minute TTL, 10K cache size)
- Rate limiting configuration to prevent OAuth server overload
- Retry logic configuration for transient OAuth server failures
- Security-hardened configuration with minimal attack surface
- Environment variable validation with helpful error messages
- Multi-environment support (staging, production, development)

#### 2. Performance Optimization
**File**: `packages/server-sdk/src/oauth-performance.ts`
**Changes**: Create performance monitoring and optimization utilities

**Implementation Requirements:**
- Token validation latency tracking and reporting
- Cache hit ratio monitoring and alerting
- OAuth server dependency health checking
- Request correlation and distributed tracing integration
- Performance metrics integration with existing mcp-obs analytics
- Automatic cache size optimization based on usage patterns
- Circuit breaker pattern for OAuth server outages

#### 3. Security Hardening
**File**: `packages/server-sdk/src/oauth-security.ts`
**Changes**: Create security utilities and validation

**Implementation Requirements:**
- Bearer token sanitization and validation
- Audience binding enforcement with strict validation
- Scope enforcement utilities for fine-grained authorization
- Token leakage prevention (no tokens in logs or errors)
- Secure cache implementation resistant to memory inspection
- Rate limiting integration to prevent brute force attacks
- Security audit logging for OAuth events

#### 4. Complete Documentation
**File**: `packages/server-sdk/README-oauth.md`
**Changes**: Create comprehensive OAuth integration documentation

**Implementation Requirements:**
- Complete API reference for OAuth middleware and utilities
- Integration patterns for different MCP server architectures
- Security best practices and deployment guidelines
- Performance optimization recommendations
- Troubleshooting guide with common issues and solutions
- Migration guide for existing MCP servers
- Enterprise deployment patterns and configurations

### Success Criteria:

**Automated verification**
- [ ] Production configuration templates pass validation
- [ ] Security tests verify token handling and validation
- [ ] Performance benchmarks meet specification requirements (<100ms cached, <500ms fresh)

**Manual Verification**
- [ ] Production deployment guide enables enterprise setup
- [ ] Security hardening prevents common OAuth vulnerabilities
- [ ] Documentation enables customer self-service integration
- [ ] Performance monitoring provides actionable insights
- [ ] Integration works seamlessly with mcp-obs OAuth infrastructure

## Performance Considerations

- Token validation latency: <100ms for cached tokens, <500ms for fresh validation
- Cache efficiency: >80% cache hit ratio for typical usage patterns
- Memory usage: <100MB for cache with 10K token limit
- OAuth server requests: <10% of total MCP requests due to caching
- CPU overhead: <5% additional CPU usage for token validation

## Migration Notes

For existing MCP servers integrating OAuth:
1. Install updated mcp-obs Server SDK with OAuth capabilities
2. Add OAuth configuration to existing server initialization
3. Wrap existing tool handlers with withOAuth() middleware
4. Update client applications to include Bearer tokens in requests
5. Test OAuth integration in development environment before production
6. Configure production OAuth server URLs and security settings

## References

* Original requirement: `specifications/mcp-server-oauth-integration/feature.md`
* Demo MCP server implementation: `/demo-mcp/server/src/index.ts:14-24`
* Existing OAuth validation utilities: `/packages/dashboard/src/lib/mcp-oauth/token-validation.ts:58-138`
* MCP Auth introspection endpoint: `/packages/dashboard/src/app/api/mcp-oauth/introspect/route.ts:160-164`
* Middleware patterns: `/packages/dashboard/middleware.ts:64-196`
* Server SDK structure: `/packages/server-sdk/index.ts:15-48`