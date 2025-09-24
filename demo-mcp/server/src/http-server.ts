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
const PORT = 3001;

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
        description: "Echo a message back with a greeting from mcp-obs (HTTP version)",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to echo back",
              default: "Hello World from HTTP!",
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
    const message = args?.message || "Hello World from HTTP!";

    return {
      content: [
        {
          type: "text",
          text: `hello from mcp-obs (HTTP): ${message}`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// SSE endpoint for MCP
app.get("/mcp", async (req, res) => {
  console.log("📡 New SSE connection established");

  const transport = new SSEServerTransport("/mcp", res);
  await server.connect(transport);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "demo-mcp-http-server" });
});

async function main() {
  app.listen(PORT, () => {
    console.log(`🌐 Demo MCP HTTP Server running on http://localhost:${PORT}`);
    console.log(`📡 MCP endpoint available at http://localhost:${PORT}/mcp`);
    console.log(`🔍 Health check at http://localhost:${PORT}/health`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("HTTP Server error:", error);
    process.exit(1);
  });
}