# mcp-obs OpenTelemetry Integration Plan

## Overview

This document outlines the design and implementation plan for OpenTelemetry integration in mcp-obs, providing comprehensive observability for MCP servers. This is the third core feature alongside OAuth authentication and support tools.

**Current Scope**: This plan focuses exclusively on **MCP server-side observability**. MCP client instrumentation (e.g., Claude Desktop) is addressed in the future considerations section.

## Goal

Enable MCP server developers to get complete observability with a single line of code:

**TypeScript**:
```typescript
import { configureMCPTelemetry } from '@mcp-obs/server-sdk'
configureMCPTelemetry({
  serverSlug: 'docuapi',
  apiKey: process.env.MCP_OBS_API_KEY,
  endpoint: 'https://api.mcp-obs.com/otel'
})
```

**Python**:
```python
from mcp_obs_server import configure_mcp_telemetry

configure_mcp_telemetry(
    server_slug="docuapi",
    api_key=os.environ["MCP_OBS_API_KEY"],
    endpoint="https://api.mcp-obs.com/otel"
)
```

## Architecture Components

### 1. MCP Auto-Instrumentation Library

**Purpose**: Automatically capture all MCP operations without code changes

**Location**: `packages/sdk/typescript/mcp-server/src/telemetry/`

**How it works**:
- **Patches MCP SDK methods** at runtime (monkey patching)
- **Creates spans** for every `tools/call`, `resources/read`, `prompts/get`
- **Follows OpenTelemetry auto-instrumentation patterns**

**What gets instrumented**:
```
mcp.tool.call (span)
├── mcp.tool.validation (span)
├── mcp.tool.execution (span)
└── mcp.tool.response (span)

mcp.resource.read (span)
├── mcp.resource.fetch (span)
└── mcp.resource.serialize (span)

mcp.prompt.get (span)
├── mcp.prompt.template (span)
└── mcp.prompt.render (span)
```

**Files to implement**:

**TypeScript SDK**:
```
packages/sdk/typescript/mcp-server/src/telemetry/
├── auto-instrumentation.ts    # Core instrumentation logic
├── mcp-semantic-conventions.ts # MCP-specific span attributes
├── otlp-exporter.ts          # Export configuration
└── index.ts                  # Public API
```

**Python SDK**:
```
packages/sdk/python/mcp-server/src/mcp_obs_server/telemetry/
├── auto_instrumentation.py    # Core instrumentation logic
├── mcp_semantic_conventions.py # MCP-specific span attributes
├── otlp_exporter.py          # Export configuration
└── __init__.py               # Public API
```

### 2. MCP Semantic Conventions

**Purpose**: Standardized attribute names for MCP operations (following OTel semantic conventions)

**MCP-specific attributes**:
```typescript
const MCPAttributes = {
  // Operation identification
  MCP_OPERATION_TYPE: 'mcp.operation.type', // "tool_call" | "resource_read" | "prompt_get"
  MCP_TOOL_NAME: 'mcp.tool.name',
  MCP_TOOL_INPUT_SIZE: 'mcp.tool.input.size',
  MCP_TOOL_OUTPUT_SIZE: 'mcp.tool.output.size',

  // Server context
  MCP_SERVER_ID: 'mcp.server.id',
  MCP_SERVER_SLUG: 'mcp.server.slug',

  // User context (from OAuth)
  MCP_USER_ID: 'mcp.user.id',
  MCP_SESSION_ID: 'mcp.session.id',

  // Business context
  MCP_BUSINESS_CONTEXT: 'mcp.business.context', // JSON object
}
```

**Standard OTel attributes**:
```typescript
{
  'service.name': 'docuapi-mcp-server',
  'service.version': '1.2.3',
  'operation.name': 'mcp.tool.call',
  'span.kind': 'server'
}
```

### 3. Security Model

**API Key Authentication**:

**TypeScript**:
```typescript
configureMCPTelemetry({
  serverSlug: 'docuapi',
  apiKey: process.env.MCP_OBS_API_KEY, // Required for auth
  endpoint: 'https://api.mcp-obs.com/otel'
})
```

**Python**:
```python
configure_mcp_telemetry(
    server_slug="docuapi",
    api_key=os.environ["MCP_OBS_API_KEY"],  # Required for auth
    endpoint="https://api.mcp-obs.com/otel"
)
```

**Security flow**:
1. Customer gets API key from mcp-obs dashboard (per MCP server)
2. API key validates against their organization + MCP server
3. All OTLP exports include `Authorization: Bearer <api-key>` header
4. mcp-obs validates API key before accepting telemetry data

**New database table**:
```sql
-- Add to packages/database/src/schema.ts
CREATE TABLE mcp_server_api_keys (
  id UUID PRIMARY KEY,
  mcp_server_id UUID REFERENCES mcp_server(id),
  organization_id TEXT NOT NULL,
  api_key_hash TEXT NOT NULL, -- bcrypt hashed
  name TEXT, -- "Production Server", "Dev Environment"
  last_used_at TIMESTAMP,
  created_at TIMESTAMP,
  revoked_at TIMESTAMP
);
```

### 4. mcp-obs as OpenTelemetry Collector

**Purpose**: Central telemetry hub that receives, processes, and forwards data

#### oRPC Telemetry Endpoints

**Location**: `packages/dashboard/src/lib/orpc/actions/telemetry.ts`

```typescript
import { router } from '../router'
import { z } from 'zod'

const telemetryRouter = router({
  // OTLP endpoint (industry standard)
  ingestTraces: procedure
    .input(z.object({
      resourceSpans: z.array(z.any()), // OTLP protobuf schema
      apiKey: z.string()
    }))
    .mutation(async ({ input }) => {
      // 1. Validate API key → get organization + MCP server
      // 2. Process spans and store in PostgreSQL
      // 3. Forward to customer's observability platform
      return { success: true }
    }),

  ingestMetrics: procedure
    .input(z.object({
      resourceMetrics: z.array(z.any()),
      apiKey: z.string()
    }))
    .mutation(async ({ input }) => {
      // Similar to traces but for metrics
      return { success: true }
    })
})
```

#### API Routes

**Location**: `packages/dashboard/src/app/api/otel/`

```typescript
// packages/dashboard/src/app/api/otel/traces/route.ts
import { telemetryRouter } from '@/lib/orpc/actions/telemetry'

export async function POST(request: Request) {
  // Convert HTTP OTLP request → oRPC call
  const otlpData = await request.json()
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '')

  return telemetryRouter.ingestTraces({
    resourceSpans: otlpData.resourceSpans,
    apiKey: apiKey!
  })
}
```

### 5. PostgreSQL Telemetry Schema

**New tables to add to `packages/database/src/schema.ts`**:

```sql
-- Traces storage (for analytics + forwarding)
CREATE TABLE telemetry_traces (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  mcp_server_id UUID REFERENCES mcp_server(id),

  -- OpenTelemetry standard fields
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  operation_name TEXT NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  duration_ns BIGINT NOT NULL,

  -- MCP semantic conventions
  mcp_operation_type TEXT, -- "tool_call", "resource_read"
  mcp_tool_name TEXT,
  mcp_user_id TEXT,
  mcp_session_id TEXT,

  -- Raw span data (for forwarding)
  span_data JSONB NOT NULL,

  -- Export tracking
  exported_to_customer BOOLEAN DEFAULT FALSE,
  export_error TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Metrics aggregation (for dashboard)
CREATE TABLE telemetry_metrics (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  mcp_server_id UUID REFERENCES mcp_server(id),

  metric_name TEXT NOT NULL, -- "mcp.tool.calls.count"
  metric_type TEXT NOT NULL, -- "counter", "histogram", "gauge"
  value DOUBLE PRECISION NOT NULL,
  labels JSONB, -- {"tool_name": "get_docs", "status": "success"}

  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

```

### 6. Unified SDK Integration

**Combined SDK usage** (all three features):

**TypeScript**:
```typescript
import { configureOAuthMCPServer } from '@mcp-obs/server-sdk'

// One-line setup for all three features
await configureOAuthMCPServer(server, {
  serverSlug: 'docuapi',
  apiKey: process.env.MCP_OBS_API_KEY,

  // OAuth config
  authProviders: ['google', 'github'],

  // Support tool config
  supportTool: { enabled: true },

  // Telemetry config
  telemetry: {
    enabled: true,
    sampling: { rate: 1.0 },
    skipInstrumentation: ['internal_health_check']
  }
})
```

**Python**:
```python
from mcp_obs_server import configure_oauth_mcp_server

# One-line setup for all three features
await configure_oauth_mcp_server(server, {
    "server_slug": "docuapi",
    "api_key": os.environ["MCP_OBS_API_KEY"],

    # OAuth config
    "auth_providers": ["google", "github"],

    # Support tool config
    "support_tool": {"enabled": True},

    # Telemetry config
    "telemetry": {
        "enabled": True,
        "sampling": {"rate": 1.0},
        "skip_instrumentation": ["internal_health_check"]
    }
})
```

**SDK structure**:

**TypeScript**:
```
packages/sdk/typescript/mcp-server/
├── src/
│   ├── oauth-middleware.ts ✅ (existing)
│   ├── support-tool.ts ✅ (existing)
│   ├── telemetry/
│   │   ├── auto-instrumentation.ts 🚧 (new)
│   │   ├── mcp-semantic-conventions.ts 🚧 (new)
│   │   ├── otlp-exporter.ts 🚧 (new)
│   │   └── index.ts 🚧 (new)
│   └── index.ts (exports all three features)
```

**Python**:
```
packages/sdk/python/mcp-server/
├── src/mcp_obs_server/
│   ├── oauth_middleware.py ✅ (existing)
│   ├── support_tool.py ✅ (existing)
│   ├── telemetry/
│   │   ├── auto_instrumentation.py 🚧 (new)
│   │   ├── mcp_semantic_conventions.py 🚧 (new)
│   │   ├── otlp_exporter.py 🚧 (new)
│   │   └── __init__.py 🚧 (new)
│   └── __init__.py (exports all three features)
```

## Data Flow Architecture

```
Customer MCP Server
└── @mcp-obs/server-sdk (auto-instrumentation)
    ├── Patches MCP SDK methods
    ├── Creates OpenTelemetry spans with MCP attributes
    ├── Adds user context from OAuth middleware
    └── OTLP HTTP export with API key auth
        └── POST /api/otel/traces
            └── oRPC telemetryRouter.ingestTraces
                ├── Validate API key & get organization
                ├── Store in PostgreSQL (analytics)
                ├── Process & enrich spans
                └── Forward to customer platform (real-time)
```

## OpenTelemetry Ethos Compliance

### Standards-Based
- Uses official OpenTelemetry SDKs and protocols
- OTLP (OpenTelemetry Protocol) for data transport
- Standard semantic conventions where possible
- Vendor-neutral export to any observability platform

### Auto-Instrumentation First
- Zero code changes required for basic telemetry
- Follows OTel auto-instrumentation patterns
- Minimal performance overhead
- Graceful degradation if telemetry fails

### Composable & Extensible
- Customers can add custom attributes and metrics
- Works with existing OTel instrumentation
- Can be combined with other observability tools
- Supports custom processors and exporters

### Production-Ready
- Proper sampling to control data volume
- Async export to avoid blocking MCP operations
- Circuit breakers and retry logic
- Resource management and memory controls

## Business Value

### Unified Analytics
Query telemetry + user data together:
```sql
-- "Show me DocuAPI's most active users and their tool usage"
SELECT
  meu.email,
  COUNT(tt.id) as tool_calls,
  AVG(tt.duration_ns / 1000000) as avg_latency_ms,
  tt.mcp_tool_name
FROM telemetry_traces tt
JOIN mcp_end_user meu ON tt.mcp_user_id = meu.id
WHERE tt.organization_id = 'docuapi-org'
  AND tt.created_at > NOW() - INTERVAL '7 days'
GROUP BY meu.email, tt.mcp_tool_name
ORDER BY tool_calls DESC;
```

### Customer Insights
- **Complete Observability**: End-to-end traces from client to server
- **Business Intelligence**: User attribution and behavior analytics
- **Performance Insights**: Identify bottlenecks and optimization opportunities
- **Standards Compliance**: Works with existing enterprise observability stacks

### Value Transformation
```
Before: "Someone used our MCP server"
After: "Alex from Company X called get_api_documentation for /users endpoint,
       took 150ms, successful, part of a 3-tool workflow session"
```

## Implementation Priority

### Phase 1: Core Telemetry
1. **MCP Auto-Instrumentation Library** - SDK telemetry module
2. **API Key Security** - Database schema + validation
3. **oRPC Telemetry Endpoints** - Ingestion pipeline
4. **PostgreSQL Schema** - Telemetry data storage

### Phase 2: Dashboard & Analytics
1. **Dashboard Analytics** - Real-time telemetry visualization
2. **Performance Optimization** - Sampling, batching, async processing

### Phase 3: Advanced Features
1. **Custom Metrics** - Customer-defined business metrics
2. **Alerting Integration** - Proactive issue detection

## Future Considerations

### MCP Client-Side Instrumentation

**Purpose**: Complete end-to-end observability including user experience on MCP clients

**Scope**: Extend telemetry to MCP clients (Claude Desktop, custom clients, etc.)

#### Client-Side Auto-Instrumentation

```typescript
// Future: MCP Client SDK
import { configureMCPClientTelemetry } from '@mcp-obs/client-sdk'

configureMCPClientTelemetry({
  endpoint: 'https://api.mcp-obs.com/otel',
  apiKey: process.env.MCP_OBS_CLIENT_API_KEY,
  userConsent: true // GDPR compliance
})
```

**What gets instrumented**:
```
mcp.client.session (root span)
├── mcp.client.connect (span)
├── mcp.client.auth (span)
├── mcp.client.tool_call (span)
│   └── Links to server-side mcp.tool.call span
└── mcp.client.response_render (span)
```

#### Distributed Tracing Pipeline

**Complete end-to-end trace flow**:

```
MCP Client (Claude Desktop)
├── mcp.client.request (root span)
│   ├── trace_id: abc123
│   ├── span_id: def456
│   └── user.id: user123
│
↓ (HTTP/stdio with trace context propagation)
│
MCP Server (with mcp-obs SDK)
├── mcp.server.request (child span)
│   ├── parent_span_id: def456
│   ├── trace_id: abc123 (same)
│   ├── mcp.tool.call (child span)
│   └── mcp.business.logic (child span)
│
↓ (Both client & server export to mcp-obs)
│
mcp-obs OTEL Collector
├── Receives spans from both sides
├── Correlates by trace_id
├── Links client UX to server performance
└── Provides complete user journey analytics
```

#### Privacy & Consent Considerations

**Client-side telemetry challenges**:
- **User consent**: GDPR/privacy compliance for client telemetry
- **PII handling**: Avoid capturing sensitive user data
- **Opt-in model**: Users must explicitly consent to telemetry
- **Data minimization**: Only capture essential performance metrics

**Proposed solution**:
```typescript
// Client-side configuration with privacy controls
configureMCPClientTelemetry({
  endpoint: 'https://api.mcp-obs.com/otel',
  userConsent: await requestUserConsent(),
  dataPolicy: {
    captureUserInputs: false, // Never capture tool inputs
    captureResponses: false,  // Never capture tool outputs
    capturePerformance: true, // Only timing data
    captureErrors: true       // Only error types, not content
  }
})
```

#### Implementation Approach

**Phase 1: Optional Client SDK**
- Separate `@mcp-obs/client-sdk` package
- Opt-in integration for custom MCP clients
- Focus on performance metrics only

**Phase 2: Popular Client Integration**
- Work with Claude Desktop team for integration
- Provide reference implementation for other clients
- Standard client telemetry conventions

**Phase 3: Ecosystem Adoption**
- MCP client framework integrations
- Developer tools and debugging support
- Complete observability ecosystem

#### Business Value of Client-Side Telemetry

**Enhanced analytics**:
```sql
-- "Complete user journey from client action to server response"
SELECT
  ct.user_id,
  ct.client_type, -- "claude-desktop", "custom-client"
  ct.operation_name as client_operation,
  st.mcp_tool_name as server_tool,
  ct.duration_ns as client_latency,
  st.duration_ns as server_latency,
  (ct.duration_ns + st.duration_ns) as total_latency
FROM telemetry_traces ct
JOIN telemetry_traces st ON ct.trace_id = st.trace_id
WHERE ct.mcp_operation_type = 'client_request'
  AND st.mcp_operation_type = 'tool_call'
  AND ct.organization_id = 'docuapi-org'
```

**User experience insights**:
- **Client performance**: How fast does Claude Desktop render responses?
- **Network latency**: What's the actual end-to-end user experience?
- **Error attribution**: Are failures client-side or server-side?
- **Usage patterns**: How do users interact with MCP tools in practice?

### Multi-Protocol Support

**Future expansion beyond MCP**:
- **AI Gateway protocols**: OpenAI API, Anthropic API observability
- **Custom protocols**: Company-specific AI service protocols
- **Standards evolution**: Adapt to new AI protocol standards

### Telemetry Export & Forwarding

**Purpose**: Forward telemetry data to customer's existing observability platforms

**Customer export configuration**:
```sql
-- Future: Customer export configuration table
CREATE TABLE telemetry_exports (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  mcp_server_id UUID REFERENCES mcp_server(id),

  export_type TEXT NOT NULL, -- "datadog", "grafana", "prometheus"
  endpoint TEXT NOT NULL,
  headers JSONB, -- {"DD-API-KEY": "encrypted_key"}
  enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Data flow architecture**:
```
DocuAPI MCP Server
└── Telemetry data → mcp-obs collector
    ├── Store in PostgreSQL (for mcp-obs analytics)
    └── Forward to Datadog (via telemetry_exports config)
        └── DocuAPI sees data in their existing dashboards
```

**Business value**:
- Customers get **both**: mcp-obs insights + data in their familiar tools
- Reduces switching costs for enterprise customers
- Maintains existing alerting, SLA monitoring, and team workflows
- Follows OpenTelemetry principle of vendor neutrality

### Self-Hosted Deployment

**Enterprise requirements**:
- **On-premises collector**: Deploy mcp-obs collector in customer infrastructure
- **Air-gapped environments**: Telemetry without external dependencies
- **Compliance**: Meet strict data residency requirements

## Success Metrics

- **Integration Simplicity**: Single line setup maintains sub-5 minute onboarding
- **Performance Impact**: <5% overhead on MCP operations
- **Data Volume**: Configurable sampling to control costs
- **Standards Compliance**: Full OTLP compatibility for any observability platform