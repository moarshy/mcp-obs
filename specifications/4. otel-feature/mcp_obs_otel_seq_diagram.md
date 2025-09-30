# mcp-obs OpenTelemetry Sequence Diagram

## Overview

This document provides detailed sequence diagrams for OpenTelemetry data flow in mcp-obs, showing the complete telemetry pipeline from MCP server instrumentation to customer observability platforms.

**Current Implementation Scope**: MCP Server-side telemetry only
**Future Scope**: End-to-end telemetry including MCP clients

---

## Current Implementation: Server-Side Telemetry

### Sequence 1: Customer Onboarding & MCP Server Setup

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Browser as Browser
    participant Dashboard as mcp-obs Dashboard
    participant DB as PostgreSQL
    participant API as oRPC API
    participant MCP as Customer's MCP Server
    participant SDK as mcp-obs SDK

    Note over Dev, SDK: Complete customer onboarding flow

    Dev->>Browser: 1. Visit mcp-obs.com
    Browser->>Dashboard: 2. Sign up with GitHub/Google
    Dashboard->>DB: 3. Create user account

    Dev->>Dashboard: 4. Access MCP Servers page
    Dashboard->>API: 5. Check user organizations

    alt No organization exists
        API->>DB: 6a. Auto-create organization
        API->>DB: 7a. Add user as admin member
        Note right of DB: Organization: "DevCorp"<br/>Member: role="admin"
    else Organization exists
        Note over API: 6b. Use existing organization
    end

    Dev->>Dashboard: 8. Click "Create MCP Server"
    Dashboard->>Dashboard: 9. Open creation dialog

    Dev->>Dashboard: 10. Enter server details
    Note right of Dashboard: Name: "DocuAPI Assistant"<br/>Slug: "docuapi"<br/>Enable OAuth providers

    Dashboard->>API: 11. Validate slug availability
    API->>DB: 12. CHECK slug uniqueness
    DB-->>API: 13. Slug available
    API-->>Dashboard: 14. Validation success

    Dev->>Dashboard: 15. Submit creation form
    Dashboard->>API: 16. createMcpServer mutation

    API->>DB: 17. INSERT mcp_server record
    Note right of DB: slug: "docuapi"<br/>organizationId: "org_123"<br/>issuerUrl: "https://docuapi.mcp-obs.com"<br/>OAuth endpoints auto-generated

    DB-->>API: 18. Server created
    API-->>Dashboard: 19. Return server config

    Dashboard->>Dashboard: 20. Generate API key for telemetry
    Note right of Dashboard: API Key: "mcpobs_live_abc123..."<br/>Scoped to: docuapi + org_123

    Dashboard-->>Dev: 21. Display integration guide
    Note right of Dev: Shows:<br/>• Server URL: docuapi.mcp-obs.com<br/>• API key for telemetry<br/>• SDK integration code
```

### Sequence 2: API Key Management & Telemetry Setup

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Dashboard as mcp-obs Dashboard
    participant DB as PostgreSQL
    participant MCP as Customer's MCP Server
    participant SDK as mcp-obs SDK
    participant OTel as OpenTelemetry

    Note over Dev, OTel: API key generation and telemetry configuration

    Dev->>Dashboard: 1. Navigate to server settings
    Dashboard->>Dashboard: 2. Click "Generate API Key"

    Dashboard->>DB: 3. INSERT mcp_server_api_keys
    Note right of DB: api_key_hash: bcrypt(key)<br/>mcp_server_id: server_uuid<br/>organization_id: org_123<br/>name: "Telemetry Key"

    Dashboard->>Dashboard: 4. Show API key once
    Note right of Dashboard: "mcpobs_live_abc123..."<br/>⚠️ Copy now - won't show again

    Dev->>MCP: 5. Add environment variable
    Note right of MCP: export MCP_OBS_API_KEY=mcpobs_live_abc123...

    Dev->>MCP: 6. Install mcp-obs SDK
    Note right of MCP: npm install @mcp-obs/server-sdk

    Dev->>MCP: 7. Add telemetry configuration
    Note right of MCP: configureMCPTelemetry({<br/>  serverSlug: 'docuapi',<br/>  apiKey: process.env.MCP_OBS_API_KEY<br/>})

    MCP->>SDK: 8. Initialize telemetry config
    SDK->>SDK: 9. Validate API key format
    SDK->>OTel: 10. Initialize OpenTelemetry SDK
    SDK->>OTel: 11. Register MCP auto-instrumentation
    SDK->>OTel: 12. Configure OTLP exporter

    Note right of OTel: Exporter config:<br/>url: https://api.mcp-obs.com/otel/traces<br/>headers: Authorization: Bearer mcpobs_live_...

    OTel-->>SDK: 13. Telemetry ready
    SDK-->>MCP: 14. Server instrumented

    Note over MCP: MCP Server now auto-captures all tool calls with user attribution
```

### Sequence 3: API Key Validation During Telemetry Export

```mermaid
sequenceDiagram
    participant MCP as Customer's MCP Server
    participant OTel as OpenTelemetry SDK
    participant Collector as mcp-obs Collector
    participant Auth as API Key Validator
    participant DB as PostgreSQL

    Note over MCP, DB: Runtime API key validation for telemetry

    MCP->>MCP: 1. Tool call execution
    Note over MCP: Auto-instrumentation captures<br/>span with MCP attributes

    OTel->>Collector: 2. OTLP HTTP export
    Note right of Collector: POST /api/otel/traces<br/>Authorization: Bearer mcpobs_live_abc123...<br/>Content-Type: application/x-protobuf

    Collector->>Auth: 3. Extract & validate API key
    Auth->>Auth: 4. Parse key format
    Note right of Auth: Expected format:<br/>mcpobs_{env}_{random}

    Auth->>DB: 5. Query API key record
    Note right of DB: SELECT * FROM mcp_server_api_keys<br/>WHERE api_key_hash = bcrypt_hash<br/>AND revoked_at IS NULL

    alt Valid API key
        DB-->>Auth: 6a. Return key record
        Auth->>Auth: 7a. Extract organization + server context
        Note right of Auth: organization_id: "org_123"<br/>mcp_server_id: "server_uuid"<br/>mcp_server_slug: "docuapi"

        Auth->>DB: 8a. Update last_used_at
        Auth-->>Collector: 9a. Validation success + context

        Collector->>Collector: 10a. Enrich spans with organization context
        Collector->>DB: 11a. Store telemetry with proper scoping
        Note right of DB: INSERT telemetry_traces<br/>organization_id = "org_123"<br/>mcp_server_id = "server_uuid"

        Collector-->>OTel: 12a. Export success (200 OK)

    else Invalid/expired API key
        DB-->>Auth: 6b. No matching record
        Auth-->>Collector: 7b. Authentication failed

        Collector-->>OTel: 8b. Export rejected (401 Unauthorized)
        Note right of OTel: Circuit breaker opens<br/>Future exports suppressed<br/>MCP server continues normally
    end

    Note over MCP: Telemetry failure never impacts MCP server functionality
```

### Sequence 2: Runtime Telemetry Capture & Export

```mermaid
sequenceDiagram
    participant Client as MCP Client<br/>(Claude Desktop)
    participant MCP as MCP Server<br/>(with mcp-obs SDK)
    participant Instr as Auto-Instrumentation
    participant OTel as OpenTelemetry SDK
    participant Collector as mcp-obs Collector
    participant DB as PostgreSQL
    participant Customer as Customer Platform<br/>(Datadog/Grafana)

    Note over Client, Customer: Runtime telemetry flow

    Client->>MCP: 1. tools/call request

    Note over MCP, OTel: Automatic instrumentation kicks in
    MCP->>Instr: 2. Intercept tool call
    Instr->>OTel: 3. Start span "mcp.tool.call"

    Note over Instr: Add MCP semantic conventions
    Instr->>OTel: 4. Set span attributes
    Note right of OTel: mcp.tool.name="get_docs"<br/>mcp.server.slug="docuapi"<br/>mcp.user.id="user123"

    MCP->>MCP: 5. Execute actual tool logic

    Note over MCP: Tool execution with sub-spans
    MCP->>Instr: 6. Tool validation
    Instr->>OTel: 7. Create child span "mcp.tool.validation"
    OTel-->>Instr: 8. Validation span complete

    MCP->>Instr: 9. Tool execution
    Instr->>OTel: 10. Create child span "mcp.tool.execution"
    OTel-->>Instr: 11. Execution span complete

    MCP-->>Client: 12. Return tool result

    Instr->>OTel: 13. End main span with result
    Note right of OTel: mcp.tool.success=true<br/>mcp.tool.duration=150ms<br/>mcp.tool.output.size=1024

    Note over OTel, Collector: Async export (non-blocking)
    OTel->>Collector: 14. OTLP HTTP export
    Note right of Collector: POST /api/otel/traces<br/>Authorization: Bearer <api-key>

    Collector->>Collector: 15. Validate API key
    Collector->>Collector: 16. Extract organization context

    par Store for analytics
        Collector->>DB: 17a. Insert telemetry_traces
        Collector->>DB: 18a. Update telemetry_metrics
    and Forward to customer (Future)
        Note over Collector, Customer: Future: Export forwarding
        Collector-->>Customer: 17b. Forward OTLP data
    end

    Collector-->>OTel: 19. Export ACK
```

### Sequence 3: Authentication Context Integration

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant OAuth as OAuth Middleware
    participant MCP as MCP Server
    participant Instr as Telemetry Instrumentation
    participant OTel as OpenTelemetry SDK
    participant Collector as mcp-obs Collector

    Note over Client, Collector: Authenticated telemetry with user attribution

    Client->>OAuth: 1. tools/call with Bearer token
    OAuth->>OAuth: 2. Validate token
    OAuth->>OAuth: 3. Extract user context

    Note right of OAuth: AuthContext:<br/>userId="user123"<br/>email="alex@company.com"<br/>sessionId="sess_abc"

    OAuth->>MCP: 4. Call handler with auth context

    Note over MCP, OTel: Telemetry captures user context
    MCP->>Instr: 5. Tool execution begins
    Instr->>OTel: 6. Start span with user attributes

    Note right of OTel: Span attributes include:<br/>mcp.user.id="user123"<br/>mcp.user.email="alex@company.com"<br/>mcp.session.id="sess_abc"<br/>mcp.tool.name="get_docs"

    MCP->>MCP: 7. Execute business logic
    MCP-->>OAuth: 8. Return result
    OAuth-->>Client: 9. Return authenticated result

    Instr->>OTel: 10. End span with success
    OTel->>Collector: 11. Export with full user context

    Note over Collector: Now has complete attribution:<br/>• Which user called which tool<br/>• Performance per user<br/>• Business context per session
```

### Sequence 4: Error Handling & Circuit Breaking

```mermaid
sequenceDiagram
    participant MCP as MCP Server
    participant Instr as Auto-Instrumentation
    participant OTel as OpenTelemetry SDK
    participant Circuit as Circuit Breaker
    participant Collector as mcp-obs Collector

    Note over MCP, Collector: Error scenarios and resilience

    MCP->>Instr: 1. Tool call execution
    Instr->>OTel: 2. Start span

    MCP->>MCP: 3. Tool execution fails
    Note right of MCP: Business logic error

    MCP-->>Instr: 4. Return error result
    Instr->>OTel: 5. Mark span with error
    Note right of OTel: span.status = ERROR<br/>mcp.tool.success = false<br/>mcp.error.type = "validation_error"

    Note over OTel, Collector: Export attempt with circuit breaker
    OTel->>Circuit: 6. Check circuit state

    alt Circuit Open (mcp-obs unavailable)
        Circuit-->>OTel: 7a. Circuit OPEN - drop telemetry
        Note over OTel: Graceful degradation:<br/>• MCP server continues working<br/>• Telemetry silently dropped<br/>• No performance impact
    else Circuit Closed (mcp-obs available)
        Circuit->>Collector: 7b. Export telemetry
        Collector-->>Circuit: 8b. Export success
        Circuit-->>OTel: 9b. Export ACK
    else Circuit Half-Open (testing)
        Circuit->>Collector: 7c. Test export
        alt Export succeeds
            Collector-->>Circuit: 8c. Success
            Circuit->>Circuit: 9c. Close circuit
        else Export fails
            Circuit->>Circuit: 8d. Keep circuit open
        end
    end

    Note over MCP: MCP server operation never blocked by telemetry issues
```

---

## Future Implementation: End-to-End Telemetry

### Sequence 5: Client + Server Distributed Tracing (Future)

```mermaid
sequenceDiagram
    participant User as End User
    participant Client as MCP Client<br/>(Claude Desktop)
    participant ClientSDK as mcp-obs Client SDK<br/>(Future)
    participant Server as MCP Server<br/>(with mcp-obs SDK)
    participant ServerOTel as Server OpenTelemetry
    participant Collector as mcp-obs Collector
    participant Analytics as mcp-obs Analytics

    Note over User, Analytics: Future: Complete end-to-end observability

    User->>Client: 1. "Help me with API docs"

    Note over Client, ClientSDK: Client-side telemetry (Future)
    Client->>ClientSDK: 2. Initialize user session
    ClientSDK->>ClientSDK: 3. Start root span "mcp.client.session"
    Note right of ClientSDK: trace_id = "abc123"<br/>span_id = "root001"<br/>user.action = "api_help_request"

    Client->>ClientSDK: 4. Prepare MCP request
    ClientSDK->>ClientSDK: 5. Start span "mcp.client.request"
    Note right of ClientSDK: parent_span_id = "root001"<br/>span_id = "client001"<br/>mcp.client.type = "claude-desktop"

    Note over ClientSDK, Server: Trace context propagation
    ClientSDK->>Server: 6. tools/call with trace headers
    Note right of Server: traceparent: 00-abc123-client001-01

    Server->>ServerOTel: 7. Extract trace context
    ServerOTel->>ServerOTel: 8. Start linked span "mcp.server.request"
    Note right of ServerOTel: trace_id = "abc123" (same)<br/>parent_span_id = "client001"<br/>span_id = "server001"

    Server->>Server: 9. Execute tool logic
    ServerOTel->>ServerOTel: 10. Create child spans
    Note right of ServerOTel: mcp.tool.call<br/>mcp.business.logic<br/>mcp.database.query

    Server-->>ClientSDK: 11. Return result with trace context

    ClientSDK->>ClientSDK: 12. End client request span
    Client->>User: 13. Display formatted result
    ClientSDK->>ClientSDK: 14. End client session span

    par Export client telemetry
        ClientSDK->>Collector: 15a. Export client spans
    and Export server telemetry
        ServerOTel->>Collector: 15b. Export server spans
    end

    Collector->>Collector: 16. Correlate spans by trace_id
    Collector->>Analytics: 17. Complete user journey data

    Note over Analytics: Complete observability:<br/>• User intent → Client UX → Server perf<br/>• End-to-end latency breakdown<br/>• Error attribution across stack<br/>• Business outcome tracking
```

### Sequence 6: Privacy-Compliant Client Telemetry (Future)

```mermaid
sequenceDiagram
    participant User as End User
    participant Client as MCP Client
    participant Consent as Consent Manager
    participant ClientSDK as mcp-obs Client SDK
    participant Privacy as Privacy Filter
    participant Collector as mcp-obs Collector

    Note over User, Collector: Future: Privacy-first client telemetry

    User->>Client: 1. First-time usage
    Client->>Consent: 2. Check telemetry consent

    alt No consent given
        Consent->>User: 3a. Request telemetry consent
        Note right of User: "Help improve MCP performance?<br/>• Only timing data<br/>• No personal content<br/>• Can opt out anytime"
        User-->>Consent: 4a. Grant/deny consent
    else Consent already given
        Consent-->>Client: 3b. Consent approved
    end

    alt User grants consent
        Client->>ClientSDK: 5a. Initialize with consent
        Note right of ClientSDK: dataPolicy:<br/>• captureUserInputs: false<br/>• captureResponses: false<br/>• capturePerformance: true<br/>• captureErrors: true

        Client->>ClientSDK: 6a. Start instrumentation

        loop Normal MCP operations
            Client->>ClientSDK: 7a. MCP tool call
            ClientSDK->>Privacy: 8a. Filter sensitive data
            Note right of Privacy: Removes:<br/>• Tool arguments<br/>• Tool responses<br/>• User prompts<br/>Keeps:<br/>• Timing data<br/>• Error types<br/>• Performance metrics

            Privacy->>ClientSDK: 9a. Sanitized telemetry
            ClientSDK->>Collector: 10a. Export safe data
        end

    else User denies consent
        Client->>Client: 5b. Disable telemetry
        Note over Client: Client works normally<br/>No telemetry collected
    end

    Note over Collector: Receives only privacy-compliant data:<br/>• Performance metrics only<br/>• No sensitive user content<br/>• GDPR compliant by design
```

---

## Data Flow Summary

### Current Implementation Flow
```
MCP Tool Call → Auto-Instrumentation → OpenTelemetry → mcp-obs Collector → PostgreSQL
                                                                         → (Future: Customer Platform)
```

### Future End-to-End Flow
```
User Action → Client Telemetry → Trace Context → Server Telemetry → mcp-obs Collector → Analytics Dashboard
                                      ↓                                      ↓
                               Privacy Filter                        Customer Platform
```

## Key Implementation Notes

### Performance Guarantees
- **Non-blocking exports**: Telemetry never blocks MCP operations
- **Circuit breaker**: Graceful degradation when mcp-obs unavailable
- **Async processing**: All telemetry operations are asynchronous
- **Minimal overhead**: <5% performance impact target

### Security & Privacy
- **API key authentication**: All exports secured with organization-scoped keys
- **Privacy-first**: Client telemetry (future) never captures sensitive content
- **User consent**: GDPR-compliant opt-in model for client instrumentation
- **Data minimization**: Only essential performance data collected

### Observability Benefits
- **Complete user attribution**: Link anonymous usage to authenticated users
- **Performance insights**: End-to-end latency breakdown per user/tool
- **Business intelligence**: Tool popularity, user engagement patterns
- **Proactive monitoring**: Error detection and performance degradation alerts