#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface EchoArgs {
  message?: string;
}

async function runStreamableHttpClient() {
  console.log("=== Running MCP Client with Streamable HTTP transport ===");

  const serverUrl = "http://localhost:3004/mcp";

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers: {
        "User-Agent": "demo-mcp-client/1.0.0",
        "Content-Type": "application/json",
      },
    },
  });

  const client = new Client(
    {
      name: "demo-mcp-streamable-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    console.log(`🌐 Attempting to connect to Streamable HTTP server at ${serverUrl}`);

    // Connect to server
    await client.connect(transport);
    console.log("✅ Connected to MCP server via Streamable HTTP");

    // List available tools
    console.log("📋 Listing available tools...");
    const tools = await client.listTools();
    console.log("🔧 Available tools:", tools.tools.map(t => `${t.name} - ${t.description}`));

    // Call the echo tool with default message
    console.log("🔧 Calling echo tool with default message...");
    const result1 = await client.callTool({
      name: "echo",
      arguments: {},
    });
    console.log("📤 Result:", result1.content[0]);

    // Call the echo tool with custom message
    console.log("🔧 Calling echo tool with custom message...");
    const result2 = await client.callTool({
      name: "echo",
      arguments: {
        message: "Streamable HTTP is working great!",
      } as EchoArgs,
    });
    console.log("📤 Result:", result2.content[0]);

    // Test multiple rapid calls to verify session management
    console.log("🔧 Testing rapid calls for session management...");
    const rapidCalls = await Promise.all([
      client.callTool({
        name: "echo",
        arguments: { message: "Call 1" } as EchoArgs,
      }),
      client.callTool({
        name: "echo",
        arguments: { message: "Call 2" } as EchoArgs,
      }),
      client.callTool({
        name: "echo",
        arguments: { message: "Call 3" } as EchoArgs,
      }),
    ]);

    rapidCalls.forEach((result, index) => {
      console.log(`📤 Rapid call ${index + 1}:`, result.content[0]);
    });

  } catch (error) {
    console.error("❌ Client error:", error);
    console.log("💡 Make sure the Streamable HTTP server is running:");
    console.log("   bun run dev:server:streamable");
  } finally {
    // Clean up
    await client.close();
    console.log("🔌 Disconnected from Streamable HTTP server");
  }
}

async function main() {
  console.log("🚀 Demo MCP Streamable HTTP Client Starting...\n");

  await runStreamableHttpClient();

  console.log("\n✨ Streamable HTTP Client demo completed!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Streamable HTTP Client error:", error);
    process.exit(1);
  });
}