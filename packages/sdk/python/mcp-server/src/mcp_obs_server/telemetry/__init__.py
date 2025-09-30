"""
mcp-obs Telemetry SDK for Python

This module provides OpenTelemetry integration for MCP servers with:
- Automatic instrumentation of MCP operations
- MCP-specific semantic conventions
- Resilient OTLP export with circuit breaker
- Integration with mcp-obs authentication context
"""

from typing import Optional, Dict, Any, Callable, Awaitable

from .auto_instrumentation import (
    configure_mcp_telemetry,
    instrument_mcp_server,
    shutdown_telemetry,
    get_telemetry_stats,
    MCPTelemetryConfig,
    AuthContext,
)

from .mcp_semantic_conventions import (
    MCPAttributes,
    MCPOperationType,
    MCPSpanNames,
    StandardAttributes,
)

from .otlp_exporter import (
    ResilientOTLPExporter,
    CircuitBreaker,
    create_mcp_otlp_exporter,
    create_circuit_breaker,
    OTLPExporterConfig,
    CircuitBreakerConfig,
)

__all__ = [
    # Main API functions
    "configure_mcp_telemetry",
    "instrument_mcp_server",
    "shutdown_telemetry",
    "get_telemetry_stats",
    # Configuration models
    "MCPTelemetryConfig",
    "AuthContext",
    "OTLPExporterConfig",
    "CircuitBreakerConfig",
    # Semantic conventions
    "MCPAttributes",
    "MCPOperationType",
    "MCPSpanNames",
    "StandardAttributes",
    # Advanced components
    "ResilientOTLPExporter",
    "CircuitBreaker",
    "create_mcp_otlp_exporter",
    "create_circuit_breaker",
    # Convenience functions
    "configure_unified_mcp_telemetry",
    "setup_simple_telemetry",
]


async def configure_unified_mcp_telemetry(
    server_slug: str,
    api_key: str,
    endpoint: Optional[str] = None,
    service_name: Optional[str] = None,
    service_version: Optional[str] = None,
    sampling: Optional[Dict[str, float]] = None,
    skip_instrumentation: Optional[list] = None,
    debug: bool = False,
    get_auth_context: Optional[Callable[[], Awaitable[Optional[AuthContext]]]] = None
) -> Dict[str, Any]:
    """
    Convenience function for unified configuration

    This is the primary API for customers who want telemetry alongside OAuth
    """

    config = MCPTelemetryConfig(
        server_slug=server_slug,
        api_key=api_key,
        endpoint=endpoint,
        service_name=service_name,
        service_version=service_version,
        sampling=sampling,
        skip_instrumentation=skip_instrumentation,
        debug=debug,
    )

    # Initialize telemetry
    configure_mcp_telemetry(config)

    # Return instrumentation function that can be called with server instance
    def instrument_server(server):
        # If auth context provider is available, get current context
        auth_context = None  # Will be set dynamically
        instrument_mcp_server(server, auth_context)

    return {
        "instrument_server": instrument_server,
        "shutdown": shutdown_telemetry,
        "get_stats": get_telemetry_stats,
        "config": config,
    }


async def setup_simple_telemetry(
    server_slug: str,
    api_key: str,
    server,
    endpoint: Optional[str] = None,
    **kwargs
) -> Dict[str, Callable]:
    """
    Simple telemetry setup for customers who only want telemetry
    """

    config = MCPTelemetryConfig(
        server_slug=server_slug,
        api_key=api_key,
        endpoint=endpoint,
        **kwargs
    )

    configure_mcp_telemetry(config)
    instrument_mcp_server(server)

    return {
        "shutdown": shutdown_telemetry,
        "get_stats": get_telemetry_stats,
    }