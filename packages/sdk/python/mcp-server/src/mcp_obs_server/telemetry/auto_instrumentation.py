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
from functools import wraps

from pydantic import BaseModel, Field
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased, ALWAYS_ON, ALWAYS_OFF
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
            logger.info(f"[mcp-obs] API key configured: {'Yes' if config.api_key else 'No'}")
            logger.info(f"[mcp-obs] Tracer provider: {_global_tracer_provider}")
            logger.info(f"[mcp-obs] Exporter: {_global_exporter}")

    except Exception as error:
        logger.error(f"[mcp-obs] Failed to initialize telemetry: {error}")


def _create_sampler(rate: float):
    """Create sampling configuration"""
    if rate >= 1.0:
        return ALWAYS_ON
    elif rate <= 0:
        return ALWAYS_OFF
    else:
        return TraceIdRatioBased(rate)


def instrument_mcp_server(server: Server, auth_context: Optional[AuthContext] = None) -> None:
    """Instrument an MCP server with automatic telemetry"""
    logger.info(f"[mcp-obs] 🎯 instrument_mcp_server called with server: {type(server).__name__}")
    logger.info(f"[mcp-obs] 🎯 Global tracer available: {_global_tracer is not None}")
    logger.info(f"[mcp-obs] 🎯 Global config available: {_global_config is not None}")

    if not _global_tracer or not _global_config:
        logger.warning("[mcp-obs] ❌ Telemetry not configured - skipping instrumentation")
        return

    if _global_config.debug:
        logger.info("[mcp-obs] 🔧 Instrumenting MCP server")

    # Store original handlers
    _instrument_server_handlers(server, _global_config, auth_context)

    if _global_config.debug:
        logger.info("[mcp-obs] ✅ MCP server instrumented successfully")


def _instrument_server_handlers(server: Server, config: MCPTelemetryConfig, auth_context: Optional[AuthContext]):
    """Instrument MCP server request handlers"""

    logger.info(f"[mcp-obs] 🔍 Instrumenting server handlers for: {type(server).__name__}")

    # Store original methods - check both standard MCP SDK and FastMCP patterns
    original_call_tool = getattr(server, "_call_tool_handler", None) or getattr(server, "call_tool", None)
    original_read_resource = getattr(server, "_read_resource_handler", None)
    original_list_resources = getattr(server, "_list_resources_handler", None)
    original_get_prompt = getattr(server, "_get_prompt_handler", None)
    original_list_prompts = getattr(server, "_list_prompts_handler", None)

    logger.info(f"[mcp-obs] 🔍 Found handlers: call_tool={original_call_tool is not None}, read_resource={original_read_resource is not None}, list_resources={original_list_resources is not None}, get_prompt={original_get_prompt is not None}, list_prompts={original_list_prompts is not None}")

    # Debug: Show all server attributes
    server_attrs = [attr for attr in dir(server) if not attr.startswith('__')]
    logger.info(f"[mcp-obs] 🔍 Server attributes: {server_attrs}")

    # Check for FastMCP specific attributes
    fastmcp_attrs = [attr for attr in server_attrs if 'tool' in attr.lower() or 'handler' in attr.lower() or 'call' in attr.lower()]
    logger.info(f"[mcp-obs] 🔍 FastMCP tool-related attributes: {fastmcp_attrs}")

    # Wrap tool call handler
    if original_call_tool:
        async def wrapped_call_tool(request):
            print(f"[mcp-obs] 🔥 WRAPPER CALLED! Request: {type(request).__name__}")
            return await _wrap_tool_call_handler(original_call_tool, request, config, auth_context)

        # Set the wrapped handler using the appropriate attribute name
        if hasattr(server, "_call_tool_handler"):
            server._call_tool_handler = wrapped_call_tool
            logger.info(f"[mcp-obs] ✅ Wrapped _call_tool_handler")
        elif hasattr(server, "call_tool"):
            original_method = server.call_tool
            server.call_tool = wrapped_call_tool
            logger.info(f"[mcp-obs] ✅ Wrapped call_tool method (original: {original_method})")

        # For FastMCP, the real magic happens in the ToolManager
        if hasattr(server, "_tool_manager"):
            logger.info(f"[mcp-obs] 🔍 Found _tool_manager: {server._tool_manager}")
            tool_manager = server._tool_manager

            # Wrap the ToolManager.call_tool method
            if hasattr(tool_manager, "call_tool"):
                logger.info(f"[mcp-obs] 🔍 Found call_tool on tool_manager, wrapping it")
                original_tool_manager_call_tool = tool_manager.call_tool

                async def wrapped_tool_manager_call_tool(name, arguments, context=None, convert_result=False):
                    print(f"[mcp-obs] 🔥 TOOL MANAGER WRAPPER CALLED! Tool: {name}")
                    return await _wrap_fastmcp_tool_call(
                        original_tool_manager_call_tool, name, arguments, context, convert_result, config, auth_context
                    )

                tool_manager.call_tool = wrapped_tool_manager_call_tool
                logger.info(f"[mcp-obs] ✅ Wrapped tool_manager.call_tool method")
            else:
                logger.info(f"[mcp-obs] ❌ No call_tool found on tool_manager")

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
    logger.info(f"[mcp-obs] 🛠️  Tool call detected: {tool_name}")
    logger.info(f"[mcp-obs] 🛠️  Global tracer available: {_global_tracer is not None}")

    # Check if this tool should be skipped
    if config.skip_instrumentation and tool_name in config.skip_instrumentation:
        logger.info(f"[mcp-obs] ⏭️  Skipping instrumentation for tool: {tool_name}")
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

    logger.info(f"[mcp-obs] 📊 Creating span with attributes: {span_attributes}")

    with _global_tracer.start_as_current_span(
        MCPSpanNames.TOOL_CALL,
        kind=SpanKind.SERVER,
        attributes=span_attributes
    ) as span:
        start_time = time.time()
        logger.info(f"[mcp-obs] ✨ Span started: {span.context.trace_id} / {span.context.span_id}")

        try:
            result = await original_handler(request)
            logger.info(f"[mcp-obs] ✅ Tool call completed successfully")

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


async def _wrap_fastmcp_tool_call(
    original_call_tool: Callable,
    name: str,
    arguments: Dict[str, Any],
    context: Any,
    convert_result: bool,
    config: MCPTelemetryConfig,
    auth_context: Optional[AuthContext]
):
    """
    Wrap FastMCP ToolManager.call_tool with OpenTelemetry instrumentation
    FastMCP signature: call_tool(self, name: str, arguments: Dict[str, Any], context: RequestContext, convert_result: bool = True)
    """
    print(f"[mcp-obs] 🎯 FastMCP ToolManager.call_tool wrapper executing for tool: {name}")

    # Check if this tool should be skipped
    if config.skip_instrumentation and name in config.skip_instrumentation:
        print(f"[mcp-obs] ⏭️  Skipping instrumentation for tool: {name}")
        return await original_call_tool(name, arguments, context, convert_result)

    # Extract user context from FastMCP context (always debug for now to see what's happening)
    extracted_auth_context = _extract_fastmcp_auth_context(context, True)

    # Use extracted context if available, fallback to passed auth_context
    active_auth_context = extracted_auth_context or auth_context

    span_attributes = {
        MCPAttributes.MCP_OPERATION_TYPE: MCPOperationType.TOOL_CALL,
        MCPAttributes.MCP_TOOL_NAME: name,
        MCPAttributes.MCP_SERVER_SLUG: config.server_slug,
        "mcp.server.type": "fastmcp",
    }

    # Add input data and size
    try:
        args_json = json.dumps(arguments)
        span_attributes[MCPAttributes.MCP_TOOL_INPUT_SIZE] = len(args_json)

        # Add actual input data (truncated for privacy)
        if len(args_json) <= 2000:  # Only store small inputs completely
            span_attributes["mcp.tool.input"] = args_json
        else:
            span_attributes["mcp.tool.input"] = args_json[:2000] + "...(truncated)"
        print(f"[mcp-obs] 📥 Captured input data: {len(args_json)} chars - {args_json}")
    except (TypeError, AttributeError) as e:
        print(f"[mcp-obs] ⚠️ Failed to capture input data: {e}")
        # Try with simpler serialization
        try:
            simple_args = str(arguments)
            span_attributes[MCPAttributes.MCP_TOOL_INPUT_SIZE] = len(simple_args)
            span_attributes["mcp.tool.input"] = simple_args[:2000]
            print(f"[mcp-obs] 📥 Captured simple input: {len(simple_args)} chars")
        except Exception as e2:
            print(f"[mcp-obs] ❌ Failed to capture any input: {e2}")

    # Add auth context if available (nullable - telemetry works without auth)
    if active_auth_context:
        print(f"[mcp-obs] 👤 Adding user context: {active_auth_context.user_id}, {active_auth_context.email}")
        if active_auth_context.user_id:
            span_attributes[MCPAttributes.MCP_USER_ID] = active_auth_context.user_id
        if active_auth_context.email:
            span_attributes[MCPAttributes.MCP_USER_EMAIL] = active_auth_context.email
        if active_auth_context.session_id:
            span_attributes[MCPAttributes.MCP_SESSION_ID] = active_auth_context.session_id
    else:
        print("[mcp-obs] ℹ️  No user context available (running without platform auth)")

    print(f"[mcp-obs] 📊 Creating span with attributes: {span_attributes}")

    with _global_tracer.start_as_current_span(
        MCPSpanNames.TOOL_CALL,
        kind=SpanKind.SERVER,
        attributes=span_attributes
    ) as span:
        start_time = time.time()
        print(f"[mcp-obs] ✨ Span started: {span.context.trace_id} / {span.context.span_id}")

        try:
            # Call the original FastMCP method
            result = await original_call_tool(name, arguments, context, convert_result)
            print(f"[mcp-obs] ✅ Tool call completed successfully")

            duration = (time.time() - start_time) * 1000  # milliseconds
            span.set_attribute(MCPAttributes.MCP_TOOL_SUCCESS, "true")
            span.set_attribute("duration_ms", duration)

            # Add output data and size
            try:
                result_json = json.dumps(result.model_dump() if hasattr(result, 'model_dump') else result)
                span.set_attribute(MCPAttributes.MCP_TOOL_OUTPUT_SIZE, len(result_json))

                # Add actual output data (truncated for privacy)
                if len(result_json) <= 2000:  # Only store small outputs completely
                    span.set_attribute("mcp.tool.output", result_json)
                else:
                    span.set_attribute("mcp.tool.output", result_json[:2000] + "...(truncated)")
                print(f"[mcp-obs] 📤 Captured output data: {len(result_json)} chars")
            except (TypeError, AttributeError) as e:
                print(f"[mcp-obs] ⚠️ Failed to capture output data: {e}")
                # Try with simpler serialization
                try:
                    simple_result = str(result)
                    span.set_attribute(MCPAttributes.MCP_TOOL_OUTPUT_SIZE, len(simple_result))
                    span.set_attribute("mcp.tool.output", simple_result[:2000])
                    print(f"[mcp-obs] 📤 Captured simple output: {len(simple_result)} chars")
                except Exception as e2:
                    print(f"[mcp-obs] ❌ Failed to capture any output: {e2}")

            span.set_status(Status(StatusCode.OK))
            return result

        except Exception as error:
            duration = (time.time() - start_time) * 1000  # milliseconds
            error_message = str(error)

            span.set_attribute(MCPAttributes.MCP_TOOL_SUCCESS, "false")
            span.set_attribute(MCPAttributes.MCP_ERROR_TYPE, error.__class__.__name__)
            span.set_attribute(MCPAttributes.MCP_ERROR_MESSAGE, error_message)
            span.set_attribute("duration_ms", duration)

            span.record_exception(error)
            span.set_status(Status(StatusCode.ERROR, error_message))
            print(f"[mcp-obs] ❌ Tool call failed: {error_message}")
            raise


def _extract_fastmcp_auth_context(context: Any, debug: bool = False) -> Optional[AuthContext]:
    """Extract user authentication context from FastMCP RequestContext"""
    try:
        if debug:
            print(f"[mcp-obs] 🔍 Extracting auth context from FastMCP context: {type(context)}")
            print(f"[mcp-obs] 🔍 Context attributes: {[attr for attr in dir(context) if not attr.startswith('_')]}")

        # Check if context has server session with authentication
        if hasattr(context, 'session') and context.session:
            session = context.session
            if debug:
                print(f"[mcp-obs] 🔍 Found session: {type(session)}")
                print(f"[mcp-obs] 🔍 Session attributes: {[attr for attr in dir(session) if not attr.startswith('_')]}")

            # Try to get auth information from session
            if hasattr(session, 'auth') and session.auth:
                auth = session.auth
                if debug:
                    print(f"[mcp-obs] 🔍 Found auth: {type(auth)}")

                # Extract user details from auth token
                user_id = getattr(auth, 'subject', None) or getattr(auth, 'user_id', None)
                email = getattr(auth, 'username', None) or getattr(auth, 'email', None)
                token = getattr(auth, 'token', None)

                if user_id or email:
                    auth_context = AuthContext(
                        user_id=user_id,
                        email=email,
                        session_id=token[:16] + "..." if token else None  # Use token prefix as session ID
                    )

                    if debug:
                        print(f"[mcp-obs] ✅ Extracted auth context: user_id={user_id}, email={email}")

                    return auth_context
            elif debug:
                print("[mcp-obs] 🔍 Session has no auth attribute or auth is None")

        # Alternative: Try to get token verifier from the app instance or session
        # Check in multiple locations for the token verifier
        token_verifier = None

        # Try context.app first
        if hasattr(context, 'app') and hasattr(context.app, '_mcp_obs_token_verifier'):
            token_verifier = context.app._mcp_obs_token_verifier
        # Try session.server if available
        elif hasattr(context, 'session') and hasattr(context.session, 'server') and hasattr(context.session.server, '_mcp_obs_token_verifier'):
            token_verifier = context.session.server._mcp_obs_token_verifier
        # Try session directly
        elif hasattr(context, 'session') and hasattr(context.session, '_mcp_obs_token_verifier'):
            token_verifier = context.session._mcp_obs_token_verifier

        if token_verifier:
            if debug:
                print(f"[mcp-obs] 🔍 Found token verifier: {type(token_verifier)}")

            # Try to get current token and decode it
            current_token = getattr(token_verifier, '_current_token', None)
            if current_token and hasattr(token_verifier, '_last_token_data'):
                token_data = getattr(token_verifier, '_last_token_data', {})

                if token_data:
                    auth_context = AuthContext(
                        user_id=token_data.get('mcp:user_id') or token_data.get('sub'),
                        email=token_data.get('username') or token_data.get('email'),
                        session_id=token_data.get('jti', current_token[:16] + "...")
                    )

                    if debug:
                        print(f"[mcp-obs] ✅ Extracted auth from token verifier: {auth_context.user_id}, {auth_context.email}")

                    return auth_context
                elif debug:
                    print(f"[mcp-obs] ⚠️ Token verifier has no _last_token_data")
            elif debug:
                print(f"[mcp-obs] ⚠️ No current token or token data in verifier")
        elif debug:
            print("[mcp-obs] ⚠️ No token verifier found in context")

        if debug:
            print("[mcp-obs] ❌ No auth context found in FastMCP context")

    except Exception as error:
        if debug:
            print(f"[mcp-obs] ❌ Error extracting auth context: {error}")

    return None


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