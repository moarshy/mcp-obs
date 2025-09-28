#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

interface EchoArgs {
  message?: string;
  [key: string]: unknown;
}

async function runHttpClient() {
  console.log("=== Running MCP Client with SSE transport ===");

  // Note: This requires an HTTP MCP server to be running
  // For demo purposes, we'll show the setup but it won't connect without a server
  const serverUrl = "http://localhost:3003/sse";

  const transport = new SSEClientTransport(new URL(serverUrl));

  const client = new Client(
    {
      name: "demo-mcp-http-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    console.log(`🌐 Attempting to connect to SSE server at ${serverUrl}`);

    // This will fail if no HTTP server is running, which is expected for this demo
    await client.connect(transport);
    console.log("✅ Connected to MCP server via SSE");

    // List available tools
    const tools = await client.listTools();
    console.log("📋 Available tools:", tools.tools.map(t => t.name));

    // Call the echo tool
    console.log("🔧 Calling echo tool...");
    const result = await client.callTool({
      name: "echo",
      arguments: {
        message: "SSE Transport Demo!",
      } as EchoArgs,
    });
    console.log("📤 Result:", (result.content as any)[0]);

  } catch (error) {
    console.log("ℹ️ SSE server not available (expected - start with 'bun run dev:server:http')");
    console.log("   Error:", (error as any).message);
  } finally {
    await client.close();
    console.log("🔌 Disconnected from SSE server");
  }
}

async function main() {
  console.log("🌐 Demo MCP HTTP Client Starting...\n");
  await runHttpClient();
  console.log("\n✨ HTTP Client demo completed!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("HTTP Client error:", error);
    process.exit(1);
  });
}