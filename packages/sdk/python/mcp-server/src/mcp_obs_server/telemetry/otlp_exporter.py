"""
OTLP Exporter with circuit breaker for resilient telemetry export
"""

import asyncio
import time
from typing import Dict, Optional, Any, Callable, Awaitable, List
from enum import Enum

from pydantic import BaseModel, Field
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.resource import ResourceAttributes
from loguru import logger

from .mcp_semantic_conventions import StandardAttributes


class OTLPExporterConfig(BaseModel):
    """Configuration for OTLP exporter with authentication"""

    server_slug: str
    api_key: str
    endpoint: Optional[str] = None
    service_name: Optional[str] = None
    service_version: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    timeout: int = Field(default=10000, description="Timeout in milliseconds")
    concurrency_limit: int = Field(default=5, description="Maximum concurrent exports")


class CircuitBreakerConfig(BaseModel):
    """Configuration for circuit breaker"""

    failure_threshold: int = Field(default=5, description="Number of failures before opening")
    reset_timeout: int = Field(default=60000, description="Reset timeout in milliseconds")
    monitoring_period: int = Field(default=10000, description="Monitoring period in milliseconds")


class CircuitState(Enum):
    """Circuit breaker states"""

    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """Circuit breaker for resilient telemetry export"""

    def __init__(self, config: CircuitBreakerConfig):
        self.config = config
        self.failures = 0
        self.last_failure_time = 0
        self.state = CircuitState.CLOSED

    async def execute(self, operation: Callable[[], Awaitable[Any]]) -> Any:
        """Execute operation with circuit breaker protection"""

        if self.state == CircuitState.OPEN:
            current_time = time.time() * 1000  # milliseconds
            if current_time - self.last_failure_time > self.config.reset_timeout:
                self.state = CircuitState.HALF_OPEN
            else:
                raise Exception("Circuit breaker is OPEN - dropping telemetry")

        try:
            result = await operation()
            self._on_success()
            return result
        except Exception as error:
            self._on_failure()
            raise error

    def _on_success(self) -> None:
        """Handle successful operation"""
        self.failures = 0
        self.state = CircuitState.CLOSED

    def _on_failure(self) -> None:
        """Handle failed operation"""
        self.failures += 1
        self.last_failure_time = time.time() * 1000

        if self.failures >= self.config.failure_threshold:
            self.state = CircuitState.OPEN

    def get_state(self) -> str:
        """Get current circuit state"""
        return self.state.value

    def get_stats(self) -> Dict[str, Any]:
        """Get circuit breaker statistics"""
        return {
            "state": self.state.value,
            "failures": self.failures,
            "last_failure_time": self.last_failure_time,
        }


def create_mcp_otlp_exporter(config: OTLPExporterConfig) -> OTLPSpanExporter:
    """Create OTLP exporter with MCP-specific configuration"""

    # Default to mcp-obs platform endpoint
    endpoint = config.endpoint or "https://api.mcp-obs.com/otel/traces"

    # Create resource with service identification
    resource = Resource.create({
        ResourceAttributes.SERVICE_NAME: (
            config.service_name or f"{config.server_slug}-mcp-server"
        ),
        ResourceAttributes.SERVICE_VERSION: config.service_version or "1.0.0",
        "mcp.server.slug": config.server_slug,
    })

    # Configure headers with authentication
    headers = {
        "Authorization": f"Bearer {config.api_key}",
        "Content-Type": "application/x-protobuf",
        **(config.headers or {}),
    }

    # Create exporter
    exporter = OTLPSpanExporter(
        endpoint=endpoint,
        headers=headers,
        timeout=config.timeout / 1000.0,  # Convert to seconds
    )

    # Attach resource to exporter
    exporter._resource = resource

    return exporter


def create_circuit_breaker() -> CircuitBreaker:
    """Create circuit breaker with default configuration"""
    return CircuitBreaker(CircuitBreakerConfig(
        failure_threshold=5,  # Open after 5 consecutive failures
        reset_timeout=60000,  # Try again after 1 minute
        monitoring_period=10000,  # Monitor failures over 10 seconds
    ))


class ResilientOTLPExporter:
    """OTLP exporter wrapped with circuit breaker for resilient export"""

    def __init__(self, config: OTLPExporterConfig):
        self.exporter = create_mcp_otlp_exporter(config)
        self.circuit_breaker = create_circuit_breaker()
        self._shutdown = False

    async def export(self, spans: List[Any]) -> None:
        """Export spans with circuit breaker protection"""
        if not spans or self._shutdown:
            return

        try:
            await self.circuit_breaker.execute(
                lambda: self._export_spans(spans)
            )
        except Exception as error:
            # Log but don't raise - telemetry failures should never impact MCP server
            logger.warning(f"[mcp-obs] Telemetry export failed: {error}")

    async def _export_spans(self, spans: List[Any]) -> None:
        """Internal span export method"""
        # Convert async to sync for OpenTelemetry SDK compatibility
        loop = asyncio.get_event_loop()

        def _sync_export():
            result = self.exporter.export(spans)
            if result.name != "SUCCESS":
                raise Exception(f"Export failed: {result}")

        await loop.run_in_executor(None, _sync_export)

    def shutdown(self) -> None:
        """Shutdown the exporter"""
        self._shutdown = True
        if hasattr(self.exporter, 'shutdown'):
            self.exporter.shutdown()

    def get_stats(self) -> Dict[str, Any]:
        """Get exporter statistics"""
        return {
            "circuit_breaker": self.circuit_breaker.get_stats(),
            "shutdown": self._shutdown,
        }