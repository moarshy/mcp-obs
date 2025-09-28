# MCP Demo Server - Python with OAuth

A demonstration MCP (Model Context Protocol) server built with FastMCP and integrated with mcp-obs OAuth authentication.

## Overview

This demo server showcases how to:
- Build an MCP server using FastMCP
- Integrate mcp-obs OAuth authentication
- Implement authenticated tools and resources
- Handle user context in MCP operations

## Features

### Authenticated Tools
- **get_server_info**: Get server information and authenticated user details
- **calculate**: Perform mathematical calculations with user attribution
- **get_weather**: Get weather information for locations
- **create_task**: Create tasks with user attribution

### Authenticated Resources
- **user://profile**: Get authenticated user profile information

## Prerequisites

- Python 3.9 or higher
- UV package manager (recommended) or pip
- Access to mcp-obs platform running on `http://localhost:3000`

## Installation

### Using UV (Recommended)
```bash
# Install UV if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync
```

### Using Pip
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Configuration

The server is configured to connect to the mcp-obs platform with the following settings:

```python
oauth_config = create_oauth_config(
    server_slug="test",  # Your server slug on mcp-obs platform
    platform_url="http://localhost:3000",  # mcp-obs platform URL
    debug=True
)
```

### Environment Variables
You can override configuration using environment variables:
- `MCP_OBS_PLATFORM_URL`: Platform URL (default: http://localhost:3000)
- `MCP_OBS_SERVER_SLUG`: Server slug (default: test)
- `MCP_OBS_DEBUG`: Enable debug mode (default: true)

## Running the Server

### Development Mode (with auto-reload)
```bash
# Using UV directly
uv run uvicorn src.server:app --host 0.0.0.0 --port 3005 --reload

# Or using hatch (if you have hatch installed)
hatch run dev

# Or directly with uvicorn (if you have dependencies installed)
uvicorn src.server:app --host 0.0.0.0 --port 3005 --reload
```

### Production Mode
```bash
# Using UV
uv run uvicorn src.server:app --host 0.0.0.0 --port 3005

# Or using hatch
hatch run start

# Or directly with Python
uv run python src/server.py

# Or with gunicorn for production
gunicorn src.server:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:3005
```

## Usage

### Authentication Flow

1. **Register Server**: First register your MCP server on the mcp-obs platform at `http://localhost:3000`
2. **Get Tokens**: Obtain OAuth tokens through the platform's authentication flow
3. **Make Requests**: Include Bearer tokens in your MCP requests

### Example Request with Authentication

```bash
curl -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_server_info",
      "arguments": {}
    }
  }'
```

### Available Tools

#### get_server_info
Returns server information and authenticated user details.

**Response:**
```json
{
  "server_name": "Demo MCP Python Server",
  "version": "1.0.0",
  "transport": "Streamable HTTP with OAuth",
  "authenticated_user": {
    "user_id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "scopes": ["read", "write"],
    "client_id": "client_123"
  },
  "oauth_platform": "http://localhost:3000",
  "server_slug": "test"
}
```

#### calculate
Performs mathematical calculations with user attribution.

**Parameters:**
- `expression` (string): Mathematical expression to evaluate

**Response:**
```json
{
  "expression": "2 + 2",
  "result": 4,
  "calculated_by": "user@example.com",
  "user_id": "user_123"
}
```

#### get_weather
Gets weather information for a location.

**Parameters:**
- `location` (string): Location to get weather for

**Response:**
```json
{
  "location": "New York",
  "temperature": "22°C",
  "condition": "Sunny",
  "humidity": "65%",
  "requested_by": "user@example.com",
  "user_id": "user_123"
}
```

#### create_task
Creates a new task with user attribution.

**Parameters:**
- `description` (string): Task description

**Response:**
```json
{
  "id": "task_1703123456",
  "description": "Complete project documentation",
  "status": "pending",
  "created_by": "user@example.com",
  "user_id": "user_123",
  "created_at": "2023-12-20 15:30:56"
}
```

### Available Resources

#### user://profile
Returns authenticated user profile information.

**Response:**
```
User Profile:
- ID: user_123
- Email: user@example.com
- Name: John Doe
- Scopes: read, write
- Client: client_123
- Token expires: 1703123456
```

## Authentication Details

The server uses the mcp-obs OAuth system with the following features:

- **Bearer Token Authentication**: All requests require valid Bearer tokens
- **Token Validation**: Tokens are validated against the mcp-obs platform
- **User Context**: Authenticated user information is available in all tools and resources
- **Scope-based Access**: Tools can require specific scopes (configurable)

## Error Handling

The server handles various authentication scenarios:

- **Missing Token**: Returns MCP error with code -32602
- **Invalid Token**: Returns authentication failure error
- **Expired Token**: Prompts for token refresh
- **Insufficient Scopes**: Returns scope requirement error

## Development

### Project Structure
```
demo-mcp/python/
├── src/
│   └── server.py          # Main FastMCP server with OAuth
├── pyproject.toml         # Project configuration
├── requirements.txt       # Dependencies for pip users
└── README.md             # This file
```

### Dependencies
- **fastmcp**: MCP server framework
- **uvicorn**: ASGI server
- **httpx**: HTTP client for OAuth validation
- **mcp-obs-server**: OAuth SDK for mcp-obs platform

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure mcp-obs platform is running on `http://localhost:3000`
   - Check server is running on port 3005

2. **Authentication Failed**
   - Verify Bearer token is valid and not expired
   - Check server slug matches registration

3. **Import Errors**
   - Ensure all dependencies are installed: `uv sync`
   - Verify mcp-obs-server SDK is properly installed

### Debug Mode

Enable debug logging by setting `debug=True` in oauth config or environment variable:
```bash
export MCP_OBS_DEBUG=true
```

## Production Deployment

For production deployment:

1. **Environment Variables**: Set production URLs and disable debug mode
2. **Process Manager**: Use gunicorn or similar for process management
3. **Reverse Proxy**: Use nginx or similar for SSL termination
4. **Monitoring**: Add proper logging and monitoring
5. **Security**: Review and harden security settings

## License

This demo is part of the mcp-obs project and follows the same licensing terms.