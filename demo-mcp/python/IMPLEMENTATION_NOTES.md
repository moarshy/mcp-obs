# Python SDK OAuth Implementation - Key Learnings

This document captures critical lessons learned during the Python SDK OAuth implementation to help with future development and troubleshooting.

## Critical Success Factors

### 1. Transport Selection is Everything

**❌ Wrong Approach**:
```python
app = create_fastmcp_with_oauth(...)
app.run()  # Defaults to stdio - OAuth won't work with MCP clients!
```

**✅ Correct Approach**:
```python
app = create_fastmcp_with_oauth(...)
app.run('streamable-http')  # Required for OAuth with MCP clients
```

**Why This Matters**:
- MCP clients like Cursor expect HTTP-based OAuth flows
- `stdio` transport doesn't support OAuth discovery endpoints
- `streamable-http` enables both MCP communication and OAuth endpoints

### 2. Scope Format Compatibility

**The Problem**: mcp-obs platform returns comma-separated scopes, OAuth standard expects space-separated.

**Platform Returns**:
```json
{
  "scope": "read,write"
}
```

**OAuth Standard Expects**:
```json
{
  "scope": "read write"
}
```

**SDK Solution**:
```python
def parse_scopes(scope_string: str) -> List[str]:
    if "," in scope_string:
        # Platform uses comma-separated
        return [s.strip() for s in scope_string.split(",")]
    else:
        # OAuth standard space-separated
        return scope_string.split()
```

**Debug Evidence**:
```
🔍 [mcp-obs] Raw scope string: 'read,write'
🔍 [mcp-obs] Parsed scopes: ['read', 'write']  # ✅ Correctly parsed
```

### 3. Official MCP SDK Integration Patterns

**Key Insight**: The SDK must create MCP-compatible components to work with official MCP SDK patterns.

**✅ Correct Integration**:
```python
from mcp.server.auth.provider import TokenVerifier
from mcp.server.auth.settings import AuthSettings

class McpObsTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> Optional[AccessToken]:
        # RFC 7662 token introspection
        # Returns official MCP SDK AccessToken
        return AccessToken(
            token=token,
            client_id=data.get("client_id"),
            scopes=parsed_scopes,  # Critical: properly parsed scopes
            expires_at=data.get("exp"),
            resource=data.get("aud")
        )
```

### 4. OAuth Discovery Requirements

**Critical Endpoints** (all created automatically by SDK):

1. **`GET /.well-known/oauth-protected-resource`**
   - **Purpose**: Resource server metadata discovery
   - **MCP Client Usage**: Initial OAuth capability detection
   - **Must Include**: `authorization_servers`, `scopes_supported`

2. **`POST /register`**
   - **Purpose**: Dynamic Client Registration proxy
   - **MCP Client Usage**: Automatic OAuth client setup
   - **Must Proxy**: All DCR requests to mcp-obs platform

3. **`GET /authorize`**
   - **Purpose**: OAuth authorization redirect proxy
   - **MCP Client Usage**: User authorization flow
   - **Must Redirect**: To platform OAuth authorization endpoint

4. **`POST /token`**
   - **Purpose**: OAuth token exchange proxy
   - **MCP Client Usage**: Exchange authorization code for tokens
   - **Must Proxy**: All token requests to mcp-obs platform

## Architecture Decisions & Rationale

### 1. SDK-First Design

**Decision**: Put all OAuth complexity in the SDK, not the server implementation.

**Rationale**:
- Enables "3-line integration" developer experience
- Consistent behavior across all MCP servers
- Centralized maintenance and updates
- Matches TypeScript SDK architecture

**Evidence**:
```python
# This is all developers need to write:
app = create_fastmcp_with_oauth(
    name="My Server",
    server_slug="test",
    debug=True
)
```

### 2. Dual Integration Patterns

**Decision**: Support both FastMCP integration and manual SDK usage.

**FastMCP Integration** (Recommended):
```python
from mcp_obs_server.fastmcp_integration import create_fastmcp_with_oauth
app = create_fastmcp_with_oauth(...)
```

**Manual SDK Integration** (Advanced):
```python
from mcp_obs_server import McpObsSDK
mcp_obs = McpObsSDK({...})
oauth_adapter = await mcp_obs.create_oauth_middleware('http')
```

**Rationale**:
- FastMCP integration for typical use cases
- Manual integration for custom requirements
- Educational value in showing SDK internals

### 3. Transport-Agnostic Design

**Decision**: Single SDK supports all MCP transport types.

**Implementation**:
```python
# Same SDK, different transports
adapter = await mcp_obs.create_oauth_middleware('stdio')
adapter = await mcp_obs.create_oauth_middleware('http')
adapter = await mcp_obs.create_oauth_middleware('streamable-http')
```

**Rationale**:
- Future-proof for new transport types
- Consistent OAuth behavior across transports
- Easier testing and development

## Critical Bug Fixes Applied

### 1. Token Validator Constructor Mismatch

**Problem**:
```python
# This failed with TypeError
validator = OAuthTokenValidator(
    server_slug=self.server_slug,  # ❌ Wrong parameters
    platform_url=self.platform_url,
    debug=self.debug
)
```

**Solution**:
```python
# Fixed by using OAuthConfig object
oauth_config = create_oauth_config(
    server_slug=self.server_slug,
    debug=self.debug,
    platform_url=self.platform_url
)
validator = OAuthTokenValidator(oauth_config)  # ✅ Correct
```

**Root Cause**: Mismatch between SDK usage and validator implementation.

### 2. Subdomain URL Construction

**Problem**: Manual localhost→subdomain conversion was error-prone.

**Solution**: Automated in SDK:
```python
def _construct_platform_url(platform_url: str, server_slug: str) -> str:
    if "localhost" in platform_url and server_slug not in platform_url:
        if ":" in platform_url:
            protocol, rest = platform_url.split("://", 1)
            return f"{protocol}://{server_slug}.{rest}"
    return platform_url

# Input: "http://localhost:3000", "test"
# Output: "http://test.localhost:3000"
```

### 3. OAuth Challenge Headers

**Problem**: Missing proper OAuth challenge headers in error responses.

**Solution**: SDK automatically adds proper headers:
```python
headers = {
    "WWW-Authenticate": f'Bearer resource_metadata="{platform_url}/.well-known/oauth-protected-resource"'
}
```

## Testing Strategies

### 1. Manual OAuth Flow Testing

**Discovery Test**:
```bash
curl http://localhost:3006/.well-known/oauth-protected-resource
```

**DCR Test**:
```bash
curl -X POST http://localhost:3006/register \
  -H "Content-Type: application/json" \
  -d '{"client_name": "Test Client"}'
```

**Token Introspection Test**:
```bash
curl -X POST http://localhost:3006/mcp \
  -H "Authorization: Bearer dummy_token"
```

### 2. Debug Logging Validation

**Enable Debug**:
```python
create_fastmcp_with_oauth(..., debug=True)
```

**Key Debug Markers**:
- `🔍 [mcp-obs] Verifying token via` - Token introspection working
- `✅ [mcp-obs] Token verified for user` - Successful authentication
- `🔄 [OAuth Proxy] Proxying DCR request` - DCR proxy working
- `✅ [OAuth Proxy] DCR successful` - Client registration working

### 3. MCP Client Integration Testing

**Cursor Integration**:
1. Add server to `.cursor/mcp.json`
2. Observe Cursor logs for OAuth flow
3. Verify successful tool discovery and execution

**Expected Flow**:
1. Discovery → DCR → Authorization → Token Exchange → Authenticated Requests

## Performance Considerations

### 1. Token Introspection Caching

**Current**: Every request triggers token introspection
**Future Enhancement**: Implement token caching with TTL
**Implementation**: Cache valid tokens until expiry

### 2. OAuth Proxy Optimization

**Current**: All OAuth requests proxy to platform
**Future Enhancement**: Cache OAuth configuration
**Implementation**: Periodic refresh of OAuth metadata

## Security Considerations

### 1. No Secrets in Server Code

**✅ Correct**: SDK handles all OAuth flows without exposing secrets
**❌ Wrong**: Storing client secrets or tokens in server code

### 2. Proper Token Validation

**✅ Correct**: Always validate tokens via platform introspection
**❌ Wrong**: Trust tokens without validation

### 3. Scope Enforcement

**✅ Correct**: Check required scopes for every protected operation
**❌ Wrong**: Assume authenticated = authorized

## Future Enhancement Opportunities

### 1. Enhanced Scope Validation

```python
class HierarchicalScopeValidator:
    def validate_scopes(self, token_scopes: List[str], required_scopes: List[str]) -> bool:
        # Support hierarchical scopes like "admin:read" includes "read"
        pass
```

### 2. Token Caching Layer

```python
class TokenCache:
    async def get_cached_token(self, token: str) -> Optional[AuthContext]:
        # Cache valid tokens to reduce introspection calls
        pass
```

### 3. Custom OAuth Providers

```python
class CustomTokenVerifier(TokenVerifier):
    # Support multiple OAuth providers beyond mcp-obs
    pass
```

### 4. Advanced Transport Support

```python
# Future transport types
adapter = await mcp_obs.create_oauth_middleware('websocket')
adapter = await mcp_obs.create_oauth_middleware('grpc')
```

## Common Pitfalls to Avoid

### 1. Transport Confusion
- ❌ Using `stdio` for OAuth-enabled servers
- ✅ Always use `streamable-http` for OAuth

### 2. Scope Format Assumptions
- ❌ Assuming scopes are always space-separated
- ✅ Handle both comma and space-separated formats

### 3. Manual OAuth Implementation
- ❌ Implementing OAuth endpoints manually
- ✅ Let SDK handle all OAuth complexity

### 4. Missing Debug Information
- ❌ Running without debug logging when troubleshooting
- ✅ Always enable debug during development and troubleshooting

## Success Metrics

### ✅ Implementation Complete When:
1. **3-Line Integration**: Developers can add OAuth in 3 lines of code
2. **MCP Client Compatibility**: Works with Cursor and other MCP clients
3. **Standards Compliance**: RFC 7662 token introspection working
4. **Debug Visibility**: Comprehensive OAuth flow logging
5. **Error Handling**: Proper OAuth error responses and challenge headers
6. **Transport Compatibility**: Works with MCP `streamable-http` transport

### ✅ Quality Indicators:
- No manual OAuth endpoint creation needed
- No secrets or tokens in server code
- Automatic scope parsing and validation
- Seamless platform integration
- Clear error messages for troubleshooting

## Documentation References

- **SDK README**: `/packages/sdk/python/mcp-server/README.md`
- **Demo README**: `/demo-mcp/python/README.md`
- **Official MCP SDK**: https://github.com/modelcontextprotocol/python-sdk
- **RFC 7662**: OAuth 2.0 Token Introspection
- **RFC 8707**: OAuth 2.0 Authorization Server Issuer Identification

---

**Key Takeaway**: The Python SDK successfully achieves the "SDK does all the heavy lifting" goal, providing the same seamless OAuth integration experience as the TypeScript version while maintaining full compatibility with official MCP SDK patterns.