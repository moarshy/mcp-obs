#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EchoArgs {
  message?: string;
  [key: string]: unknown;
}

async function runStdioClient() {
  console.log("=== Running MCP Client with stdio transport ===");

  // Get the path to the server script
  const serverPath = path.resolve(__dirname, "../../server/src/index.ts");

  // Create transport - let StdioClientTransport handle the process spawning
  const transport = new StdioClientTransport({
    command: "tsx",
    args: [serverPath],
  });

  const client = new Client(
    {
      name: "demo-mcp-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    // Connect to server
    await client.connect(transport);
    console.log("✅ Connected to MCP server via stdio");

    // List available tools
    const tools = await client.listTools();
    console.log("📋 Available tools:", tools.tools.map(t => t.name));

    // Call the echo tool with default message
    console.log("🔧 Calling echo tool with default message...");
    const result1 = await client.callTool({
      name: "echo",
      arguments: {},
    });
    console.log("📤 Result:", (result1.content as any)[0]);

    // Call the echo tool with custom message
    console.log("🔧 Calling echo tool with custom message...");
    const result2 = await client.callTool({
      name: "echo",
      arguments: {
        message: "TypeScript MCP Demo is working!",
      } as EchoArgs,
    });
    console.log("📤 Result:", (result2.content as any)[0]);

  } catch (error) {
    console.error("❌ Client error:", error);
  } finally {
    // Clean up
    await client.close();
    console.log("🔌 Disconnected from MCP server");
  }
}

async function main() {
  console.log("🚀 Demo MCP Client Starting...\n");

  // Run stdio client demo
  await runStdioClient();

  console.log("\n✨ Demo completed!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Client error:", error);
    process.exit(1);
  });
}