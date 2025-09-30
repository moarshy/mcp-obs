"""
Auto-instrumentation for MCP servers using OpenTelemetry

This module provides automatic instrumentation of MCP operations with
OpenTelemetry tracing, following the same patterns as the TypeScript SDK.
"""

import asyncio
import json
import time
from typing import Optional, Dict, Any, List, Callable, Awaitable
from contextlib import asynccontextmanager

from pydantic import BaseModel, Field
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.sampling import TraceIdRatioBasedSampler, AlwaysOnSampler, AlwaysOffSampler
from opentelemetry.trace import Status, StatusCode, SpanKind
from mcp.server import Server
from loguru import logger

from .otlp_exporter import ResilientOTLPExporter, OTLPExporterConfig
from .mcp_semantic_conventions import MCPAttributes, MCPOperationType, MCPSpanNames


class MCPTelemetryConfig(BaseModel):
    """Configuration for MCP telemetry"""

    server_slug: str
    api_key: str
    endpoint: Optional[str] = None
    service_name: Optional[str] = None
    service_version: Optional[str] = None
    sampling: Optional[Dict[str, float]] = None
    skip_instrumentation: Optional[List[str]] = None
    debug: bool = Field(default=False, description="Enable debug logging")


class AuthContext(BaseModel):
    """Authentication context from OAuth middleware"""

    user_id: Optional[str] = None
    email: Optional[str] = None
    session_id: Optional[str] = None


# Global state
_global_config: Optional[MCPTelemetryConfig] = None
_global_tracer_provider: Optional[TracerProvider] = None
_global_tracer: Optional[trace.Tracer] = None
_global_exporter: Optional[ResilientOTLPExporter] = None


def configure_mcp_telemetry(config: MCPTelemetryConfig) -> None:
    """Initialize OpenTelemetry with MCP-specific configuration"""
    global _global_config, _global_tracer_provider, _global_tracer, _global_exporter

    if _global_tracer_provider:
        logger.warning("[mcp-obs] Telemetry already configured")
        return

    _global_config = config

    try:
        # Create OTLP exporter with circuit breaker
        _global_exporter = ResilientOTLPExporter(OTLPExporterConfig(
            server_slug=config.server_slug,
            api_key=config.api_key,
            endpoint=config.endpoint,
            service_name=config.service_name,
            service_version=config.service_version,
        ))

        # Create sampler
        sampling_rate = config.sampling.get("rate", 1.0) if config.sampling else 1.0
        sampler = _create_sampler(sampling_rate)

        # Initialize tracer provider
        _global_tracer_provider = TracerProvider(sampler=sampler)

        # Add span processor with our exporter
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        span_processor = BatchSpanProcessor(_global_exporter.exporter)
        _global_tracer_provider.add_span_processor(span_processor)

        # Set global tracer provider
        trace.set_tracer_provider(_global_tracer_provider)

        # Get tracer
        _global_tracer = trace.get_tracer("mcp-obs-server-sdk", "1.0.0")

        if config.debug:
            logger.info(f"[mcp-obs] Telemetry initialized: {config.server_slug}")
            logger.info(f"[mcp-obs] Endpoint: {config.endpoint or 'https://api.mcp-obs.com/otel/traces'}")
            logger.info(f"[mcp-obs] Sampling rate: {sampling_rate}")

    except Exception as error:
        logger.error(f"[mcp-obs] Failed to initialize telemetry: {error}")


def _create_sampler(rate: float):
    """Create sampling configuration"""
    if rate >= 1.0:
        return AlwaysOnSampler()
    elif rate <= 0:
        return AlwaysOffSampler()
    else:
        return TraceIdRatioBasedSampler(rate)


def instrument_mcp_server(server: Server, auth_context: Optional[AuthContext] = None) -> None:
    """Instrument an MCP server with automatic telemetry"""
    if not _global_tracer or not _global_config:
        logger.warning("[mcp-obs] Telemetry not configured - skipping instrumentation")
        return

    if _global_config.debug:
        logger.info("[mcp-obs] Instrumenting MCP server")

    # Store original handlers
    _instrument_server_handlers(server, _global_config, auth_context)

    if _global_config.debug:
        logger.info("[mcp-obs] MCP server instrumented successfully")


def _instrument_server_handlers(server: Server, config: MCPTelemetryConfig, auth_context: Optional[AuthContext]):
    """Instrument MCP server request handlers"""

    # Store original method
    original_call_tool = getattr(server, "_call_tool_handler", None)
    original_read_resource = getattr(server, "_read_resource_handler", None)
    original_list_resources = getattr(server, "_list_resources_handler", None)
    original_get_prompt = getattr(server, "_get_prompt_handler", None)
    original_list_prompts = getattr(server, "_list_prompts_handler", None)

    # Wrap tool call handler
    if original_call_tool:
        async def wrapped_call_tool(request):
            return await _wrap_tool_call_handler(original_call_tool, request, config, auth_context)
        server._call_tool_handler = wrapped_call_tool

    # Wrap resource handlers
    if original_read_resource:
        async def wrapped_read_resource(request):
            return await _wrap_resource_read_handler(original_read_resource, request, config, auth_context)
        server._read_resource_handler = wrapped_read_resource

    if original_list_resources:
        async def wrapped_list_resources(request):
            return await _wrap_resource_list_handler(original_list_resources, request, config, auth_context)
        server._list_resources_handler = wrapped_list_resources

    # Wrap prompt handlers
    if original_get_prompt:
        async def wrapped_get_prompt(request):
            return await _wrap_prompt_get_handler(original_get_prompt, request, config, auth_context)
        server._get_prompt_handler = wrapped_get_prompt

    if original_list_prompts:
        async def wrapped_list_prompts(request):
            return await _wrap_prompt_list_handler(original_list_prompts, request, config, auth_context)
        server._list_prompts_handler = wrapped_list_prompts


async def _wrap_tool_call_handler(
    original_handler: Callable,
    request: Any,
    config: MCPTelemetryConfig,
    auth_context: Optional[AuthContext]
):
    """Wrap tool call handler with telemetry"""
    tool_name = getattr(request.params, 'name', 'unknown_tool')

    # Check if this tool should be skipped
    if config.skip_instrumentation and tool_name in config.skip_instrumentation:
        return await original_handler(request)

    span_attributes = {
        MCPAttributes.MCP_OPERATION_TYPE: MCPOperationType.TOOL_CALL,
        MCPAttributes.MCP_TOOL_NAME: tool_name,
        MCPAttributes.MCP_SERVER_SLUG: config.server_slug,
    }

    # Add input size
    try:
        args_json = json.dumps(getattr(request.params, 'arguments', {}))
        span_attributes[MCPAttributes.MCP_TOOL_INPUT_SIZE] = len(args_json)
    except (TypeError, AttributeError):
        pass

    # Add auth context if available
    if auth_context:
        if auth_context.user_id:
            span_attributes[MCPAttributes.MCP_USER_ID] = auth_context.user_id
        if auth_context.email:
            span_attributes[MCPAttributes.MCP_USER_EMAIL] = auth_context.email
        if auth_context.session_id:
            span_attributes[MCPAttributes.MCP_SESSION_ID] = auth_context.session_id

    with _global_tracer.start_as_current_span(
        MCPSpanNames.TOOL_CALL,
        kind=SpanKind.SERVER,
        attributes=span_attributes
    ) as span:
        start_time = time.time()

        try:
            result = await original_handler(request)

            # Add success attributes
            span.set_attributes({
                MCPAttributes.MCP_TOOL_SUCCESS: True,
            })

            # Add output size
            try:
                result_json = json.dumps(result.model_dump() if hasattr(result, 'model_dump') else result)
                span.set_attribute(MCPAttributes.MCP_TOOL_OUTPUT_SIZE, len(result_json))
            except (TypeError, AttributeError):
                pass

            span.set_status(Status(StatusCode.OK))
            return result

        except Exception as error:
            # Add error attributes
            span.set_attributes({
                MCPAttributes.MCP_TOOL_SUCCESS: False,
                MCPAttributes.MCP_ERROR_TYPE: error.__class__.__name__,
                MCPAttributes.MCP_ERROR_MESSAGE: str(error),
            })

            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR, str(error)))
            raise error

        finally:
            duration = (time.time() - start_time) * 1000  # milliseconds
            span.set_attribute("duration_ms", duration)


async def _wrap_resource_read_handler(
    original_handler: Callable,
    request: Any,
    config: MCPTelemetryConfig,
    auth_context: Optional[AuthContext]
):
    """Wrap resource read handler with telemetry"""
    resource_uri = getattr(request.params, 'uri', 'unknown_resource')

    span_attributes = {
        MCPAttributes.MCP_OPERATION_TYPE: MCPOperationType.RESOURCE_READ,
        MCPAttributes.MCP_RESOURCE_URI: resource_uri,
        MCPAttributes.MCP_SERVER_SLUG: config.server_slug,
    }

    # Add auth context if available
    if auth_context:
        if auth_context.user_id:
            span_attributes[MCPAttributes.MCP_USER_ID] = auth_context.user_id
        if auth_context.session_id:
            span_attributes[MCPAttributes.MCP_SESSION_ID] = auth_context.session_id

    with _global_tracer.start_as_current_span(
        MCPSpanNames.RESOURCE_READ,
        kind=SpanKind.SERVER,
        attributes=span_attributes
    ) as span:
        try:
            result = await original_handler(request)

            # Add resource size
            try:
                result_json = json.dumps(result.model_dump() if hasattr(result, 'model_dump') else result)
                span.set_attribute(MCPAttributes.MCP_RESOURCE_SIZE, len(result_json))
            except (TypeError, AttributeError):
                pass

            span.set_status(Status(StatusCode.OK))
            return result

        except Exception as error:
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR, str(error)))
            raise error


async def _wrap_resource_list_handler(
    original_handler: Callable,
    request: Any,
    config: MCPTelemetryConfig,
    auth_context: Optional[AuthContext]
):
    """Wrap resource list handler with telemetry"""
    span_attributes = {
        MCPAttributes.MCP_OPERATION_TYPE: MCPOperationType.RESOURCE_LIST,
        MCPAttributes.MCP_SERVER_SLUG: config.server_slug,
    }

    # Add auth context
    if auth_context:
        if auth_context.user_id:
            span_attributes[MCPAttributes.MCP_USER_ID] = auth_context.user_id
        if auth_context.session_id:
            span_attributes[MCPAttributes.MCP_SESSION_ID] = auth_context.session_id

    with _global_tracer.start_as_current_span(
        MCPSpanNames.RESOURCE_LIST,
        kind=SpanKind.SERVER,
        attributes=span_attributes
    ) as span:
        try:
            result = await original_handler(request)

            # Add resource count
            try:
                resources = getattr(result, 'resources', [])
                span.set_attribute("mcp.resource.count", len(resources))
            except (TypeError, AttributeError):
                pass

            span.set_status(Status(StatusCode.OK))
            return result

        except Exception as error:
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR, str(error)))
            raise error


async def _wrap_prompt_get_handler(
    original_handler: Callable,
    request: Any,
    config: MCPTelemetryConfig,
    auth_context: Optional[AuthContext]
):
    """Wrap prompt get handler with telemetry"""
    prompt_name = getattr(request.params, 'name', 'unknown_prompt')

    span_attributes = {
        MCPAttributes.MCP_OPERATION_TYPE: MCPOperationType.PROMPT_GET,
        MCPAttributes.MCP_PROMPT_NAME: prompt_name,
        MCPAttributes.MCP_SERVER_SLUG: config.server_slug,
    }

    # Add prompt args count
    try:
        args = getattr(request.params, 'arguments', {})
        span_attributes[MCPAttributes.MCP_PROMPT_ARGS_COUNT] = len(args)
    except (TypeError, AttributeError):
        pass

    # Add auth context
    if auth_context:
        if auth_context.user_id:
            span_attributes[MCPAttributes.MCP_USER_ID] = auth_context.user_id
        if auth_context.session_id:
            span_attributes[MCPAttributes.MCP_SESSION_ID] = auth_context.session_id

    with _global_tracer.start_as_current_span(
        MCPSpanNames.PROMPT_GET,
        kind=SpanKind.SERVER,
        attributes=span_attributes
    ) as span:
        try:
            result = await original_handler(request)
            span.set_status(Status(StatusCode.OK))
            return result

        except Exception as error:
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR, str(error)))
            raise error


async def _wrap_prompt_list_handler(
    original_handler: Callable,
    request: Any,
    config: MCPTelemetryConfig,
    auth_context: Optional[AuthContext]
):
    """Wrap prompt list handler with telemetry"""
    span_attributes = {
        MCPAttributes.MCP_OPERATION_TYPE: MCPOperationType.PROMPT_LIST,
        MCPAttributes.MCP_SERVER_SLUG: config.server_slug,
    }

    # Add auth context
    if auth_context:
        if auth_context.user_id:
            span_attributes[MCPAttributes.MCP_USER_ID] = auth_context.user_id
        if auth_context.session_id:
            span_attributes[MCPAttributes.MCP_SESSION_ID] = auth_context.session_id

    with _global_tracer.start_as_current_span(
        MCPSpanNames.PROMPT_LIST,
        kind=SpanKind.SERVER,
        attributes=span_attributes
    ) as span:
        try:
            result = await original_handler(request)

            # Add prompt count
            try:
                prompts = getattr(result, 'prompts', [])
                span.set_attribute("mcp.prompt.count", len(prompts))
            except (TypeError, AttributeError):
                pass

            span.set_status(Status(StatusCode.OK))
            return result

        except Exception as error:
            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR, str(error)))
            raise error


async def shutdown_telemetry() -> None:
    """Shutdown telemetry"""
    global _global_tracer_provider, _global_tracer, _global_config, _global_exporter

    if _global_tracer_provider:
        _global_tracer_provider.shutdown()

    if _global_exporter:
        _global_exporter.shutdown()

    _global_tracer_provider = None
    _global_tracer = None
    _global_config = None
    _global_exporter = None


def get_telemetry_stats() -> Dict[str, Any]:
    """Get telemetry statistics"""
    return {
        "configured": _global_config is not None,
        "server_slug": _global_config.server_slug if _global_config else None,
        "sampling": (_global_config.sampling.get("rate", 1.0)
                   if _global_config and _global_config.sampling else 1.0),
        "exporter_stats": _global_exporter.get_stats() if _global_exporter else None,
    }