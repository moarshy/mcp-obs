#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { FetchTransport } from "@modelcontextprotocol/sdk/client/fetch.js";

interface EchoArgs {
  message?: string;
}

async function runHttpClient() {
  console.log("=== Running MCP Client with HTTP transport ===");

  // Note: This requires an HTTP MCP server to be running
  // For demo purposes, we'll show the setup but it won't connect without a server
  const serverUrl = "http://localhost:3001/mcp";

  const transport = new FetchTransport({
    url: serverUrl,
  });

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
    console.log(`🌐 Attempting to connect to HTTP server at ${serverUrl}`);

    // This will fail if no HTTP server is running, which is expected for this demo
    await client.connect(transport);
    console.log("✅ Connected to MCP server via HTTP");

    // List available tools
    const tools = await client.listTools();
    console.log("📋 Available tools:", tools.tools.map(t => t.name));

    // Call the echo tool
    console.log("🔧 Calling echo tool...");
    const result = await client.callTool({
      name: "echo",
      arguments: {
        message: "HTTP Transport Demo!",
      } as EchoArgs,
    });
    console.log("📤 Result:", result.content[0]);

  } catch (error) {
    console.log("ℹ️ HTTP server not available (this is expected for stdio demo)");
    console.log("   To test HTTP transport, implement an HTTP MCP server");
  } finally {
    await client.close();
    console.log("🔌 Disconnected from HTTP server");
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