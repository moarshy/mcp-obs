#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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

// Middleware
app.use(cors());
app.use(express.json());

// Single global transport instance
let globalTransport: StreamableHTTPServerTransport | null = null;
let mcpServer: Server | null = null;

// Helper function to check if request is an initialize request
function isInitializeRequest(body: any): boolean {
  return body && body.method === "initialize";
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

// Main MCP endpoint - single transport per connection approach
app.all("/mcp", async (req, res) => {
  console.log(`📨 ${req.method} request to /mcp`);

  try {
    // Create a fresh transport for each request - let the SDK handle session management internally
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableDnsRebindingProtection: false, // Disable for local development
    });

    const server = createMCPServer();
    await server.connect(transport);

    await transport.handleRequest(req, res, req.body);
    console.log(`✅ Request handled successfully`);
  } catch (error) {
    console.error(`❌ Error handling request:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
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

async function main() {
  app.listen(PORT, () => {
    console.log(`🌐 Demo MCP Streamable HTTP Server running on http://localhost:${PORT}`);
    console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Status: http://localhost:${PORT}/status`);
    console.log(`🚀 Transport: Streamable HTTP (MCP v2025-03-26)`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Streamable HTTP Server error:", error);
    process.exit(1);
  });
}