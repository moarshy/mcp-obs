---
date: 2025-09-30T11:16:16+08:00
researcher: Claude Code
git_commit: 52d99d1
branch: main
repository: mcp-obs
topic: "OpenTelemetry Integration Implementation Strategy"
tags: [implementation, strategy, opentelemetry, telemetry, observability, mcp-server-sdk, otel, instrumentation]
status: complete
last_updated: 2025-09-30
last_updated_by: Claude Code
type: implementation_strategy
---

# OpenTelemetry Integration Implementation Plan

## Overview

Implement comprehensive OpenTelemetry integration for mcp-obs, providing enterprise-grade observability for MCP servers through auto-instrumentation, secure API key-based authentication, and real-time telemetry collection. This enables MCP server developers to get complete observability with minimal code changes while maintaining the established patterns of the mcp-obs ecosystem.

## Current State Analysis

### Key Discoveries:
- **Established SDK Pattern**: Both TypeScript and Python SDKs follow identical patterns with transport-agnostic design (`packages/sdk/typescript/mcp-server/src/oauth-middleware.ts:267-295`)
- **Organization Scoping**: All business operations use organization isolation via `organizationId` foreign keys (`packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:149-152`)
- **Feature Integration Pattern**: Support tools auto-register alongside OAuth using conditional configuration (`packages/sdk/typescript/mcp-server/src/oauth-middleware.ts:274-291`)
- **Transport Adapter Factory**: Existing pattern for stdio/HTTP/streamable-HTTP support (`packages/sdk/typescript/mcp-server/src/transport-adapters.ts:624-638`)
- **Database Schema Organization**: Multi-file schema approach with clear separation (`packages/database/src/schema.ts`, `packages/database/src/auth-schema.ts`)

**Key Constraints:**
- Must maintain feature parity between TypeScript and Python SDKs
- All telemetry operations must be organization-scoped for multi-tenancy
- No existing API key management patterns - need to establish new pattern
- Transport-agnostic design requirement for MCP compatibility

## What We're NOT Doing

- MCP client-side instrumentation (reserved for future Phase 2)
- Custom observability platform integrations (export forwarding is future scope)
- Real-time streaming dashboard updates (basic analytics dashboard only)
- Custom metrics beyond standard OpenTelemetry semantic conventions
- Breaking changes to existing OAuth/support tool patterns

## Implementation Approach

**Strategy**: Implement OpenTelemetry as a standalone feature that follows established mcp-obs patterns, with future-ready design for unified configuration. Use API key-based security model with opt-in telemetry during MCP server creation, following the same organization isolation patterns used throughout the platform.

## Phase 1: Database Schema & API Key Management

### Overview
Establish the foundational data model for telemetry collection, API key security, and organization-scoped access control.

### Changes Required:

#### 1. Database Schema Extensions
**File**: `packages/database/src/schema.ts`
**Changes**: Add telemetry-related tables to existing schema

**Implementation Requirements:**
- Add `mcpServerApiKeys` table with bcrypt hashing and organization scoping
- Add `telemetryTraces` table with OpenTelemetry standard fields and MCP semantic conventions
- Add `telemetryMetrics` table for aggregated metrics storage
- Include proper foreign key relationships and indexes for performance
- Follow existing naming conventions and organization isolation patterns
- Add `telemetryEnabled` boolean field to existing `mcpServer` table
- Ensure all telemetry tables include organization scoping via `organizationId`

#### 2. API Key Management oRPC Actions
**File**: `packages/dashboard/src/lib/orpc/actions/telemetry-api-keys.ts`
**Changes**: Create new oRPC action file for API key management

**Implementation Requirements:**
- Implement `generateApiKey` action with organization validation and bcrypt hashing
- Implement `revokeApiKey` action with proper authorization checks
- Implement `listApiKeys` action showing usage statistics without exposing keys
- Follow existing session validation and organization membership patterns
- Include proper error handling and rate limiting considerations
- Generate API keys with format `mcpobs_{env}_{random}` for easy identification
- Update `last_used_at` timestamp during telemetry validation

#### 3. MCP Server Creation Enhancement
**File**: `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts`
**Changes**: Extend existing `createMcpServer` action

**Implementation Requirements:**
- Add optional `telemetryEnabled` parameter to creation flow
- Auto-generate API key when telemetry is enabled during creation
- Return API key in creation response (show once only for security)
- Maintain backward compatibility for existing MCP server creation
- Follow existing pattern for conditional feature enablement
- Include proper error handling for API key generation failures

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] database migration runs successfully via `bun sst shell -- bun run db:migrate`
- [ ] TypeScript compilation passes

**Manual Verification**
- [ ] API key generation works through dashboard UI
- [ ] Organization isolation is enforced for all telemetry operations
- [ ] API key revocation/regeneration functions correctly
- [ ] Database schema changes don't break existing functionality

## Phase 2: SDK Telemetry Integration

### Overview
Implement OpenTelemetry auto-instrumentation in both TypeScript and Python SDKs with transport-agnostic design and unified configuration patterns.

### Changes Required:

#### 1. TypeScript SDK Telemetry Module
**File**: `packages/sdk/typescript/mcp-server/src/telemetry/index.ts`
**Changes**: Create new telemetry module with OpenTelemetry integration

**Implementation Requirements:**
- Implement `configureMCPTelemetry()` function that can work standalone or alongside OAuth
- Create auto-instrumentation that patches MCP SDK methods at runtime
- Add MCP semantic conventions for tool calls, resource reads, and prompt gets
- Configure OTLP exporter with API key authentication headers
- Implement sampling configuration with sensible defaults
- Include circuit breaker pattern for resilient export behavior
- Create transport-specific telemetry adapters following existing adapter pattern
- Extract user context from OAuth middleware when available for span attribution

#### 2. TypeScript SDK Transport Adapters Extension
**File**: `packages/sdk/typescript/mcp-server/src/transport-adapters.ts`
**Changes**: Extend existing transport adapters with telemetry support

**Implementation Requirements:**
- Modify `createOAuthAdapter` factory to optionally include telemetry instrumentation
- Create parallel `createTelemetryAdapter` factory for standalone telemetry use
- Ensure telemetry works across stdio, HTTP, and streamable-HTTP transports
- Maintain backward compatibility with existing OAuth-only configurations
- Follow existing pattern for transport-specific implementation details

#### 3. Python SDK Telemetry Module
**File**: `packages/sdk/python/mcp-server/src/mcp_obs_server/telemetry/__init__.py`
**Changes**: Create equivalent Python telemetry implementation

**Implementation Requirements:**
- Mirror TypeScript implementation with identical API surface
- Use Python OpenTelemetry SDK with same semantic conventions
- Implement identical sampling and circuit breaker behavior
- Ensure FastAPI and Flask integration compatibility
- Follow existing Python SDK patterns and naming conventions
- Maintain feature parity with TypeScript implementation

#### 4. Unified SDK Configuration (Future-Ready)
**File**: `packages/sdk/typescript/mcp-server/src/index.ts`
**Changes**: Design for future unified configuration

**Implementation Requirements:**
- Update `MCPServerConfig` interface to include optional telemetry configuration
- Create `configureAllMCPFeatures()` function that combines OAuth, support tools, and telemetry
- Maintain individual feature functions for standalone use
- Ensure configuration options don't conflict between features
- Plan for graceful feature interdependencies (telemetry + OAuth user attribution)

### Success Criteria:

**Automated verification**
- [ ] no linter errors in both TypeScript and Python SDKs
- [ ] package builds succeed for both languages
- [ ] SDK exports include new telemetry functions

**Manual Verification**
- [ ] Auto-instrumentation captures MCP tool calls with proper span attributes
- [ ] Telemetry exports work across all transport types (stdio, HTTP, streamable-HTTP)
- [ ] User attribution works when combined with OAuth middleware
- [ ] Circuit breaker prevents telemetry failures from impacting MCP server operation
- [ ] Feature parity verified between TypeScript and Python implementations

## Phase 3: Telemetry Collection Infrastructure

### Overview
Build the server-side infrastructure to receive, validate, and store telemetry data from MCP servers.

### Changes Required:

#### 1. OTLP Ingestion oRPC Actions
**File**: `packages/dashboard/src/lib/orpc/actions/telemetry-ingestion.ts`
**Changes**: Create telemetry data ingestion actions

**Implementation Requirements:**
- Implement `ingestTraces` action that accepts OTLP protobuf data
- Implement API key validation using bcrypt against `mcpServerApiKeys` table
- Extract organization and MCP server context from validated API key
- Store trace data in `telemetryTraces` table with proper organization scoping
- Generate aggregated metrics and store in `telemetryMetrics` table
- Include error handling for malformed telemetry data
- Update API key `last_used_at` timestamp during successful ingestion
- Follow existing organization isolation and session validation patterns

#### 2. HTTP API Routes for OTLP
**File**: `packages/dashboard/src/app/api/otel/traces/route.ts`
**Changes**: Create HTTP endpoints for OpenTelemetry data

**Implementation Requirements:**
- Implement POST endpoint that accepts OTLP HTTP protocol data
- Extract API key from Authorization header (Bearer token format)
- Convert HTTP request to oRPC action call for consistency
- Handle protobuf and JSON OTLP payload formats
- Include proper CORS headers for cross-origin telemetry export
- Follow existing API route patterns and error handling
- Return appropriate HTTP status codes for different error scenarios

#### 3. Telemetry Analytics Dashboard Components
**File**: `packages/dashboard/src/components/telemetry/telemetry-analytics.tsx`
**Changes**: Create analytics components for telemetry visualization

**Implementation Requirements:**
- Display real-time tool usage statistics with time-range filtering (24h, 7d, 30d)
- Show per-user tool performance metrics when OAuth is enabled
- Create charts for request volume, latency percentiles, and error rates
- Include top tools, most active users, and performance trends
- Follow existing component patterns and shadcn/ui design system
- Implement proper loading states and error boundaries
- Use organization-scoped data queries via oRPC actions

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] API routes respond correctly to OTLP HTTP requests
- [ ] oRPC actions handle telemetry data without errors

**Manual Verification**
- [ ] Telemetry data from SDK successfully ingests through API endpoints
- [ ] API key validation correctly rejects invalid keys and accepts valid ones
- [ ] Organization isolation prevents cross-tenant data access
- [ ] Analytics dashboard displays telemetry data with proper filtering
- [ ] Dashboard shows user attribution when OAuth is configured
- [ ] Real-time updates work when new telemetry data arrives

## Phase 4: Dashboard Integration & UI

### Overview
Integrate telemetry features into the existing dashboard experience with API key management, MCP server configuration, and analytics visualization.

### Changes Required:

#### 1. MCP Server Settings Enhancement
**File**: `packages/dashboard/src/components/mcp-servers/mcp-server-settings.tsx`
**Changes**: Add telemetry configuration to existing settings

**Implementation Requirements:**
- Add "OpenTelemetry" section with enable/disable toggle
- Display current API key status (active, revoked, last used)
- Include "Generate New API Key" button with security confirmation
- Show API key only once during generation with copy-to-clipboard functionality
- Add "Revoke API Key" functionality with proper confirmation dialogs
- Display integration guide with SDK code examples for TypeScript and Python
- Include sampling rate configuration with slider/input controls
- Follow existing settings component patterns and form validation

#### 2. MCP Server Creation Flow Update
**File**: `packages/dashboard/src/components/mcp-servers/create-mcp-server-dialog.tsx`
**Changes**: Add telemetry option to creation workflow

**Implementation Requirements:**
- Add "Enable OpenTelemetry" checkbox to creation form
- Include brief explanation of telemetry benefits and data collected
- Auto-generate API key when telemetry is enabled
- Display integration instructions immediately after creation
- Maintain existing form validation and error handling patterns
- Show telemetry setup as optional enhancement alongside OAuth setup

#### 3. Telemetry Analytics Page
**File**: `packages/dashboard/src/app/(dashboard)/mcp-servers/[id]/analytics/page.tsx`
**Changes**: Create dedicated analytics page for MCP servers

**Implementation Requirements:**
- Create comprehensive analytics dashboard with multiple chart types
- Include time-range selector (24h, 7d, 30d, 90d) following existing patterns
- Display tool usage trends, performance metrics, and user analytics
- Show error rates and latency percentiles with drill-down capabilities
- Include export functionality for telemetry data
- Implement real-time updates using server actions and revalidation
- Follow existing page layout patterns and navigation structure

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] TypeScript compilation passes
- [ ] component renders without errors

**Manual Verification**
- [ ] Telemetry can be enabled/disabled during MCP server creation
- [ ] API key generation works properly with security best practices
- [ ] Settings page allows API key management without exposing sensitive data
- [ ] Analytics dashboard displays comprehensive telemetry insights
- [ ] Time-range filtering works correctly across all charts
- [ ] Integration guide provides accurate SDK setup instructions

## Performance Considerations

**Telemetry Export Performance:**
- Implement batching for OTLP exports to reduce HTTP request overhead
- Use async processing for all telemetry operations to prevent MCP server blocking
- Configure circuit breakers with exponential backoff for resilient error handling
- Target <5% performance overhead on instrumented MCP operations

**Database Performance:**
- Add indexes on frequently queried fields (`organization_id`, `mcp_server_id`, `created_at`)
- Consider partitioning strategy for `telemetry_traces` table as data grows
- Implement data retention policies for old telemetry data
- Use connection pooling for high-throughput telemetry ingestion

## Migration Notes

**Backward Compatibility:**
- All existing OAuth and support tool functionality remains unchanged
- MCP servers without telemetry continue working normally
- API key management is opt-in and doesn't affect existing servers
- Database migrations are additive only, no breaking schema changes

**Rollout Strategy:**
- Deploy database schema changes first with feature flags disabled
- Enable telemetry infrastructure endpoints gradually
- SDK updates are backward compatible, customers opt-in via configuration
- Dashboard features are organization-scoped and don't affect other tenants

## References

* Original ticket: `specifications/4. otel-feature/mcp_obs_otel_plan.md`
* Sequence diagrams: `specifications/4. otel-feature/mcp_obs_otel_seq_diagram.md`
* OAuth middleware pattern: `packages/sdk/typescript/mcp-server/src/oauth-middleware.ts:267-295`
* Transport adapter factory: `packages/sdk/typescript/mcp-server/src/transport-adapters.ts:624-638`
* Organization scoping pattern: `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:149-152`
* Database schema structure: `packages/database/src/schema.ts:4-44`