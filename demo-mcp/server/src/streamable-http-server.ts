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

interface EchoArgs {
  message?: string;
}

const app = express();
const PORT = 3004;
const SESSION_ID_HEADER_NAME = "mcp-session-id";
const JSON_RPC = "2.0";

// Middleware
app.use(cors());
app.use(express.json());

// Track multiple transport instances by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
const servers: { [sessionId: string]: Server } = {};

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

// Helper function to create and setup MCP server
function createMCPServer(): Server {
  const server = new Server(
    {
      name: "demo-mcp-streamable-server",
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
          description: "Echo a message back with a greeting from mcp-obs via Streamable HTTP transport",
          inputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The message to echo back",
                default: "Hello World from Streamable HTTP!",
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "echo") {
      const args = request.params.arguments as EchoArgs;
      const message = args?.message || "Hello World from Streamable HTTP!";

      return {
        content: [
          {
            type: "text",
            text: `hello from mcp-obs (Streamable HTTP): ${message}`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  return server;
}

// Handle GET requests (SSE streaming)
app.get("/mcp", async (req, res) => {
  console.log(`📨 GET request to /mcp for SSE streaming`);

  const sessionId = req.headers[SESSION_ID_HEADER_NAME] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res
      .status(400)
      .json(createErrorResponse("Bad Request: invalid session ID or method."));
    return;
  }

  console.log(`Establishing SSE stream for session ${sessionId}`);
  const transport = transports[sessionId];

  try {
    await transport.handleRequest(req, res);
    await streamMessages(transport);
  } catch (error) {
    console.error(`❌ Error handling SSE request:`, error);
    if (!res.headersSent) {
      res.status(500).json(createErrorResponse("Internal server error."));
    }
  }
});

// Handle POST requests (tool calls and initialization)
app.post("/mcp", async (req, res) => {
  console.log(`📨 POST request to /mcp`);

  const sessionId = req.headers[SESSION_ID_HEADER_NAME] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  try {
    // Reuse existing transport if session exists
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Create new transport for initialization request
    if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableDnsRebindingProtection: false, // Disable for local development
      });

      const server = createMCPServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      // Store transport and server for session management
      const newSessionId = transport.sessionId;
      if (newSessionId) {
        transports[newSessionId] = transport;
        servers[newSessionId] = server;
        console.log(`✅ New session created: ${newSessionId}`);
      }

      return;
    }

    res
      .status(400)
      .json(createErrorResponse("Bad Request: invalid session ID or method."));
    return;
  } catch (error) {
    console.error(`❌ Error handling POST request:`, error);
    if (!res.headersSent) {
      res.status(500).json(createErrorResponse("Internal server error."));
    }
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "demo-mcp-streamable-server",
    transport: "Streamable HTTP",
    uptime: process.uptime()
  });
});

// Status endpoint to show server info
app.get("/status", (req, res) => {
  res.json({
    status: "running",
    service: "demo-mcp-streamable-server",
    uptime: process.uptime(),
    transport: "Streamable HTTP (MCP v2025-03-26)",
    endpoint: "/mcp"
  });
});

// Stream messages function for SSE
async function streamMessages(transport: StreamableHTTPServerTransport) {
  try {
    // Send initial connection message
    const message: LoggingMessageNotification = {
      method: "notifications/message",
      params: { level: "info", data: "SSE Connection established" },
    };

    await sendNotification(transport, message);

    let messageCount = 0;
    const interval = setInterval(async () => {
      messageCount++;

      const data = `Message ${messageCount} at ${new Date().toISOString()}`;
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
            params: { level: "info", data: "Streaming complete!" },
          };
          await sendNotification(transport, finalMessage);
        }
      } catch (error) {
        console.error("Error sending message:", error);
        clearInterval(interval);
      }
    }, 1000);
  } catch (error) {
    console.error("Error streaming messages:", error);
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
  console.log(`🧹 Session ${sessionId} cleaned up`);
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
  app.listen(PORT, () => {
    console.log(`🌐 Demo MCP Streamable HTTP Server running on http://localhost:${PORT}`);
    console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Status: http://localhost:${PORT}/status`);
    console.log(`🚀 Transport: Streamable HTTP (MCP v2025-03-26)`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down server...');

    // Close all sessions
    for (const sessionId in servers) {
      cleanupSession(sessionId);
    }

    process.exit(0);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Streamable HTTP Server error:", error);
    process.exit(1);
  });
}