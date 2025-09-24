#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";

interface EchoArgs {
  message?: string;
}

const app = express();
const PORT = 3003;

// Middleware
app.use(cors());
app.use(express.json());

const server = new Server(
  {
    name: "demo-mcp-http-server",
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
        description: "Echo a message back with a greeting from mcp-obs via SSE transport",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to echo back",
              default: "Hello World from SSE!",
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
    const message = args?.message || "Hello World from SSE!";

    return {
      content: [
        {
          type: "text",
          text: `hello from mcp-obs (SSE): ${message}`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Store transports for each session
const transports: Record<string, SSEServerTransport> = {};

// SSE endpoint - establishes connection
app.get("/sse", async (req, res) => {
  console.log("📡 New SSE connection established");

  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;

  // Clean up transport when connection closes
  res.on("close", () => {
    console.log(`🔌 SSE connection closed for session ${transport.sessionId}`);
    delete transports[transport.sessionId];
  });

  await server.connect(transport);
});

// Message endpoint - handles POST requests
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  console.log(`📨 POST request for session ${sessionId}`);

  const transport = transports[sessionId];

  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    console.error(`❌ No transport found for sessionId: ${sessionId}`);
    res.status(400).send('No transport found for sessionId');
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "demo-mcp-http-server" });
});

async function main() {
  app.listen(PORT, () => {
    console.log(`🌐 Demo MCP HTTP Server running on http://localhost:${PORT}`);
    console.log(`📡 SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`📨 Messages endpoint: http://localhost:${PORT}/messages`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("HTTP Server error:", error);
    process.exit(1);
  });
}