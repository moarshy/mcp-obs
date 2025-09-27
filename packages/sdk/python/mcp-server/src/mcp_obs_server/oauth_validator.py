"""
OAuth token validation utilities for MCP servers
Uses HTTP request to mcp-obs platform for token validation
"""
from typing import Optional, List
import time
import httpx
from loguru import logger
from urllib.parse import urlencode

from .types import OAuthConfig, AuthContext


class OAuthTokenValidator:
    """OAuth token validator that validates tokens against mcp-obs platform"""

    def __init__(self, config: OAuthConfig):
        self.config = config
        self._http_client = httpx.AsyncClient(timeout=30.0)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._http_client.aclose()

    async def validate_token(self, token: str) -> Optional[AuthContext]:
        """
        Validate a Bearer token using HTTP request to mcp-obs platform

        Args:
            token: The Bearer token to validate

        Returns:
            AuthContext if valid, None if invalid
        """
        try:
            platform_url = (
                self.config.platform_url or
                f"https://{self.config.server_slug}.mcp-obs.com"
            )

            if self.config.debug:
                logger.debug(f"[OAuth] Validating token with platform: {platform_url}")

            # Make HTTP request to introspect token
            introspect_url = f"{platform_url}/api/mcp-oauth/introspect"

            form_data = {
                "token": token,
                "server_slug": self.config.server_slug
            }

            response = await self._http_client.post(
                introspect_url,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                content=urlencode(form_data)
            )

            if not response.is_success:
                if self.config.debug:
                    logger.error(f"[OAuth] HTTP error {response.status_code}: {response.text}")
                return None

            introspection = response.json()

            if not introspection.get("active", False):
                if self.config.debug:
                    logger.error("[OAuth] Token is not active")
                return None

            # Build AuthContext from introspection response
            user_id = (
                introspection.get("sub") or
                introspection.get("mcp:user_id") or
                "unknown"
            )

            email = introspection.get("username", "unknown")
            name = introspection.get("name")
            image = introspection.get("picture")

            scopes = []
            if introspection.get("scope"):
                scopes = introspection["scope"].split(" ")

            client_id = introspection.get("client_id", "unknown")

            # Handle expiration time
            expires_at = int(time.time() * 1000) + 3600000  # Default: 1 hour from now
            if introspection.get("exp"):
                expires_at = int(introspection["exp"]) * 1000

            auth_context = AuthContext(
                user_id=user_id,
                email=email,
                name=name,
                image=image,
                scopes=scopes,
                client_id=client_id,
                expires_at=expires_at
            )

            if self.config.debug:
                logger.debug(f"[OAuth] Token validation successful for user: {auth_context.email}")

            return auth_context

        except Exception as error:
            logger.error(f"[OAuth] Token validation error: {error}")
            return None

    def extract_bearer_token(self, auth_header: Optional[str]) -> Optional[str]:
        """
        Extract Bearer token from Authorization header

        Args:
            auth_header: The Authorization header value

        Returns:
            The Bearer token or None if not found
        """
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        return auth_header[7:]  # Remove "Bearer " prefix

    def has_required_scopes(self, auth_context: AuthContext, required_scopes: List[str]) -> bool:
        """
        Check if token has required scopes

        Args:
            auth_context: The validated auth context
            required_scopes: Array of required scopes

        Returns:
            True if all required scopes are present
        """
        return all(scope in auth_context.scopes for scope in required_scopes)

    async def close(self):
        """Close the HTTP client"""
        await self._http_client.aclose()


# Convenience function for simple token validation
async def validate_token(config: OAuthConfig, token: str) -> Optional[AuthContext]:
    """
    Convenience function to validate a token without managing the validator instance

    Args:
        config: OAuth configuration
        token: Bearer token to validate

    Returns:
        AuthContext if valid, None if invalid
    """
    async with OAuthTokenValidator(config) as validator:
        return await validator.validate_token(token)