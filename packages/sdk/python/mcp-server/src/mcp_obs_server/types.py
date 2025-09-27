"""
Type definitions for mcp-obs Server SDK
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime


class TokenValidationResult(BaseModel):
    """Result of token validation operation"""
    valid: bool
    token: Optional[Dict[str, Any]] = None
    user: Optional[Dict[str, Any]] = None
    client: Optional[Dict[str, Any]] = None
    server: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class OAuthConfig(BaseModel):
    """OAuth configuration for MCP server"""
    server_slug: str
    """MCP server slug (e.g., "test" for test.mcp-obs.com)"""

    platform_url: Optional[str] = None
    """Platform base URL (e.g., "http://localhost:3000" or "https://my-org.mcp-obs.com")"""

    debug: bool = False
    """Enable debug logging"""


class AuthContext(BaseModel):
    """Authenticated user context from validated OAuth token"""
    user_id: str
    """User ID from the OAuth token"""

    email: str
    """User email address"""

    name: Optional[str] = None
    """User display name"""

    image: Optional[str] = None
    """User profile image URL"""

    scopes: List[str] = []
    """OAuth scopes granted to the token"""

    client_id: str
    """OAuth client ID that requested the token"""

    expires_at: int
    """Token expiration timestamp (milliseconds since epoch)"""


class MCPServerConfig(BaseModel):
    """Configuration for MCP server with mcp-obs integration"""
    server_name: str
    version: str
    platform_url: Optional[str] = None
    api_key: Optional[str] = None

    oauth_config: Optional[OAuthConfig] = None
    """OAuth configuration for server authentication"""