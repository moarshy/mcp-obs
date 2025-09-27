#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  Notification,
  LoggingMessageNotification,
  ToolListChangedNotification,
  JSONRPCNotification,
  JSONRPCError,
} from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { McpObsSDK, type AuthContext } from "@mcp-obs/server-sdk";

interface EchoArgs {
  message?: string;
}

const app = express();
const PORT = 3005; // Different port from non-OAuth version
const SESSION_ID_HEADER_NAME = "mcp-session-id";
const JSON_RPC = "2.0";

// Initialize mcp-obs SDK with OAuth configuration
const mcpObs = new McpObsSDK({
  serverName: "demo-mcp-streamable-oauth-server",
  version: "1.0.0",
  oauthConfig: {
    serverSlug: "test", // Maps to test subdomain
    platformUrl: "http://localhost:3000", // Local mcp-obs platform
    debug: true // Enable debug logging
  }
});

// Create OAuth adapter for streamable HTTP transport (initialized in main())
let oauthAdapter: any;

// Middleware - keep it simple like the working streamable server
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For OAuth form data

// Track multiple transport instances by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
const servers: { [sessionId: string]: Server } = {};
const sessionAuthContexts: { [sessionId: string]: AuthContext } = {};

// Helper function to check if request is an initialize request
function isInitializeRequest(body: any): boolean {
  const isInitial = (data: any) => {
    const result = InitializeRequestSchema.safeParse(data);
    return result.success;
  };
  if (Array.isArray(body)) {
    return body.some((request) => isInitial(request));
  }
  return isInitial(body);
}

// Helper function to create error response
function createErrorResponse(message: string): JSONRPCError {
  return {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: message,
    },
    id: randomUUID(),
  };
}

// Helper function to send notification
async function sendNotification(
  transport: StreamableHTTPServerTransport,
  notification: Notification
) {
  const rpcNotification: JSONRPCNotification = {
    ...notification,
    jsonrpc: JSON_RPC,
  };
  await transport.send(rpcNotification);
}

// Helper function to create and setup MCP server with OAuth protection
function createMCPServer(sessionId: string): Server {
  const server = new Server(
    {
      name: "demo-mcp-streamable-oauth-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "echo",
          description: "Echo a message back with a greeting from mcp-obs via OAuth-protected Streamable HTTP transport",
          inputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The message to echo back",
                default: "Hello World from OAuth Streamable HTTP!",
              },
            },
          },
        },
      ],
    };
  });

  // OAuth-protected tool handler - get auth context from session
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Get auth context from the session (set by Express middleware)
    const authContext = sessionAuthContexts[sessionId];

    if (!authContext) {
      throw new Error('Authentication required - no auth context found for this session');
    }

    // Track authenticated tool usage
    await mcpObs.trackAuthenticatedToolUsage(
      request.params.name,
      authContext,
      { sessionId, transport: 'streamable-http' }
    );

    if (request.params.name === "echo") {
      const args = request.params.arguments as EchoArgs;
      const message = args?.message || "Hello World from OAuth Streamable HTTP!";

      return {
        content: [
          {
            type: "text",
            text: `hello from mcp-obs (OAuth Streamable HTTP): ${message} (authenticated as: ${authContext.email})`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  return server;
}

// GET route will be moved inside main() function after OAuth middleware


// Health check endpoint (public - no OAuth)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "demo-mcp-streamable-oauth-server",
    transport: "OAuth Streamable HTTP",
    uptime: process.uptime(),
    oauth: {
      enabled: true,
      serverSlug: "test",
      endpoint: "https://test.mcp-obs.com"
    }
  });
});

// Status endpoint to show server info (public - no OAuth)
app.get("/status", (req, res) => {
  const activeSessions = Object.keys(transports).length;
  const cacheStats = oauthAdapter.getCacheStats?.() || { size: 0, maxSize: 1000 };

  res.json({
    status: "running",
    service: "demo-mcp-streamable-oauth-server",
    uptime: process.uptime(),
    transport: "OAuth Streamable HTTP (MCP v2025-03-26)",
    endpoint: "/mcp",
    oauth: {
      enabled: true,
      serverSlug: "test",
      activeSessions: activeSessions,
      tokenCache: cacheStats
    }
  });
});

// Stream messages function for SSE with OAuth context
async function streamMessages(transport: StreamableHTTPServerTransport, authContext: AuthContext) {
  try {
    // Send initial connection message with user info
    const message: LoggingMessageNotification = {
      method: "notifications/message",
      params: {
        level: "info",
        data: `OAuth SSE Connection established for user: ${authContext.email}`
      },
    };

    await sendNotification(transport, message);

    let messageCount = 0;
    const interval = setInterval(async () => {
      messageCount++;

      const data = `OAuth Message ${messageCount} at ${new Date().toISOString()} for ${authContext.email}`;
      const message: LoggingMessageNotification = {
        method: "notifications/message",
        params: { level: "info", data: data },
      };

      try {
        await sendNotification(transport, message);

        if (messageCount === 2) {
          clearInterval(interval);
          const finalMessage: LoggingMessageNotification = {
            method: "notifications/message",
            params: {
              level: "info",
              data: `OAuth streaming complete for ${authContext.email}!`
            },
          };
          await sendNotification(transport, finalMessage);
        }
      } catch (error) {
        console.error("Error sending OAuth message:", error);
        clearInterval(interval);
      }
    }, 1000);
  } catch (error) {
    console.error("Error streaming OAuth messages:", error);
  }
}

// Session cleanup function
function cleanupSession(sessionId: string) {
  if (servers[sessionId]) {
    servers[sessionId].close();
    delete servers[sessionId];
  }
  if (transports[sessionId]) {
    delete transports[sessionId];
  }
  if (sessionAuthContexts[sessionId]) {
    delete sessionAuthContexts[sessionId];
  }
  console.log(`🧹 OAuth session ${sessionId} cleaned up`);
}

// Cleanup inactive sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const sessionId in transports) {
    // Clean up sessions older than 1 hour
    // Note: In production, you'd want proper session tracking with timestamps
    // This is a simple cleanup mechanism
  }
}, 300000); // Check every 5 minutes

async function main() {
  // Initialize mcp-obs SDK
  await mcpObs.initialize();

  // Initialize OAuth adapter
  oauthAdapter = await mcpObs.createOAuthMiddleware('streamable-http');

  // OAuth middleware for all MCP endpoints (but skip health/status)
  app.use('/mcp', oauthAdapter.expressMiddleware());

  // Handle POST requests (tool calls and initialization) - OAuth protected
  // This route handler MUST be defined AFTER the OAuth middleware
  app.post("/mcp", async (req, res) => {
    console.log(`📨 POST request to OAuth /mcp`);

    const sessionId = req.headers[SESSION_ID_HEADER_NAME] as string | undefined;
    const authContext = (req as any).authContext as AuthContext;
    let transport: StreamableHTTPServerTransport;

    try {
      // Reuse existing transport if session exists
      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];

        // Store auth context globally for this session to be used by MCP handlers
        if (sessionId) {
          sessionAuthContexts[sessionId] = authContext;
        }

        // Pass the request through normally
        const authenticatedRequest = req.body;

        await transport.handleRequest(req, res, authenticatedRequest);
        return;
      }

      // Create new transport for initialization request
      if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableDnsRebindingProtection: false, // Disable for local development
        });

        const newSessionId = transport.sessionId || randomUUID();
        const server = createMCPServer(newSessionId);
        await server.connect(transport);

        // Handle the request without modifying the JSON-RPC body
        // The authContext is already available in the session store
        await transport.handleRequest(req, res);

        // Store transport, server, and auth context for session management
        if (newSessionId) {
          transports[newSessionId] = transport;
          servers[newSessionId] = server;
          sessionAuthContexts[newSessionId] = authContext;
          console.log(`✅ New OAuth session created: ${newSessionId} for user: ${authContext.email}`);
        }

        return;
      }

      res
        .status(400)
        .json(createErrorResponse("Bad Request: invalid session ID or method."));
      return;
    } catch (error) {
      console.error(`❌ Error handling OAuth POST request:`, error);
      if (!res.headersSent) {
        res.status(500).json(createErrorResponse("Internal server error."));
      }
    }
  });

  // Handle GET requests (SSE streaming) - OAuth protected
  // This route handler MUST be defined AFTER the OAuth middleware
  app.get("/mcp", async (req, res) => {
    console.log(`📨 GET request to /mcp for OAuth SSE streaming`);

    const sessionId = req.headers[SESSION_ID_HEADER_NAME] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res
        .status(400)
        .json(createErrorResponse("Bad Request: invalid session ID or method."));
      return;
    }

    // OAuth is already validated by Express middleware
    const authContext = (req as any).authContext as AuthContext;
    if (!authContext) {
      res.status(401).json(createErrorResponse("Authentication required for SSE streaming."));
      return;
    }

    console.log(`Establishing OAuth SSE stream for session ${sessionId}, user: ${authContext.email}`);
    const transport = transports[sessionId];

    try {
      await transport.handleRequest(req, res);
      await streamMessages(transport, authContext);
    } catch (error) {
      console.error(`❌ Error handling OAuth SSE request:`, error);
      if (!res.headersSent) {
        res.status(500).json(createErrorResponse("Internal server error."));
      }
    }
  });

  // Create OAuth proxy endpoints from SDK for MCP client compatibility
  oauthAdapter.createOAuthProxyEndpoints(app);

  app.listen(PORT, () => {
    console.log(`🌐 Demo MCP OAuth Streamable HTTP Server running on http://localhost:${PORT}`);
    console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Status: http://localhost:${PORT}/status`);
    console.log(`🚀 Transport: OAuth Streamable HTTP (MCP v2025-03-26)`);
    console.log(`🔐 OAuth: Enabled for server slug "test" (localhost:3000)`);
    console.log(`🔑 Note: All /mcp requests require valid Bearer tokens from localhost:3000`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down OAuth server...');

    // Close all sessions
    for (const sessionId in servers) {
      cleanupSession(sessionId);
    }

    process.exit(0);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("OAuth Streamable HTTP Server error:", error);
    process.exit(1);
  });
}