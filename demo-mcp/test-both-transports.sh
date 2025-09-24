#!/bin/bash

echo "🧪 Testing MCP servers for Cursor integration..."
echo ""

echo "1. Testing stdio server (tools/list):"
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
  timeout 3s /Users/arshath/play/naptha/mcp-obs/demo-mcp/node_modules/.bin/tsx \
  /Users/arshath/play/naptha/mcp-obs/demo-mcp/server/src/index.ts || echo "Timeout (expected for stdin test)"

echo ""
echo "2. Testing SSE server (health check):"
curl -s http://localhost:3003/health 2>/dev/null || echo "SSE server not running (start with: bun run dev:server:http)"

echo ""
echo "3. Demo scripts available:"
echo "   • stdio demo: bun run demo"
echo "   • SSE demo: bun run demo:http (requires server running)"

echo ""
echo "4. Cursor MCP configuration:"
echo "   📁 Location: /Users/arshath/play/naptha/mcp-obs/.cursor/mcp.json"
echo "   🔧 Two servers configured:"
echo "      - demo-mcp-obs-stdio (process-based)"
echo "      - demo-mcp-obs-sse (HTTP-based, requires server running)"

echo ""
echo "5. To test in Cursor:"
echo "   • Restart Cursor and open this project"
echo "   • For stdio: @demo-mcp-obs-stdio"
echo "   • For SSE: Start server first, then @demo-mcp-obs-sse"
echo "   • Both respond with: 'hello from mcp-obs: {your message}'"