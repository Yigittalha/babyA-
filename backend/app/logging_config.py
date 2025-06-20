"""
Professional logging configuration with structured logging and error tracking
"""
import sys
import json
import traceback
from typing import Any, Dict, Optional
from datetime import datetime
import structlog
from loguru import logger
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
import uuid

from .config import settings


def setup_logging():
    """Configure structured logging for the application"""
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="ISO"),
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.ConsoleRenderer() if settings.DEBUG else structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            level=getattr(structlog, settings.LOG_LEVEL.upper(), structlog.INFO)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Configure loguru
    logger.remove()  # Remove default handler
    
    # Console handler
    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "<level>{message}</level>"
    )
    
    if settings.LOG_FORMAT == "json":
        log_format = json_formatter
    
    logger.add(
        sys.stdout,
        format=log_format,
        level=settings.LOG_LEVEL,
        colorize=True,
        backtrace=True,
        diagnose=True
    )
    
    # File handler for errors
    logger.add(
        "logs/error.log",
        format=json_formatter,
        level="ERROR",
        rotation="10 MB",
        retention="30 days",
        compression="gz",
        backtrace=True,
        diagnose=True
    )
    
    # File handler for all logs
    logger.add(
        "logs/app.log",
        format=json_formatter,
        level="INFO",
        rotation="50 MB",
        retention="7 days",
        compression="gz"
    )
    
    # File handler for audit logs
    logger.add(
        "logs/audit.log",
        format=json_formatter,
        level="INFO",
        filter=lambda record: record["extra"].get("audit", False),
        rotation="daily",
        retention="90 days",
        compression="gz"
    )


def json_formatter(record):
    """Custom JSON formatter for structured logging"""
    log_entry = {
        "timestamp": record["time"].isoformat(),
        "level": record["level"].name,
        "logger": record["name"],
        "function": record["function"],
        "line": record["line"],
        "message": record["message"],
        "module": record["module"],
        "process_id": record["process"].id,
        "thread_id": record["thread"].id,
    }
    
    # Add extra fields
    if record["extra"]:
        log_entry.update(record["extra"])
    
    # Add exception info if present
    if record["exception"]:
        log_entry["exception"] = {
            "type": record["exception"].type.__name__,
            "value": str(record["exception"].value),
            "traceback": record["exception"].traceback
        }
    
    return json.dumps(log_entry, default=str)


class RequestLogger:
    """Middleware for logging HTTP requests and responses"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request_id = str(uuid.uuid4())
        start_time = datetime.utcnow()
        
        # Extract request info
        method = scope["method"]
        path = scope["path"]
        query_string = scope.get("query_string", b"").decode()
        client_ip = self._get_client_ip(scope)
        
        # Log request start
        logger.info(
            "Request started",
            request_id=request_id,
            method=method,
            path=path,
            query=query_string,
            client_ip=client_ip,
            user_agent=self._get_header(scope, "user-agent"),
            extra={"request_id": request_id}
        )
        
        async def send_with_logging(message):
            nonlocal start_time
            
            if message["type"] == "http.response.start":
                status_code = message["status"]
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                # Log response
                log_level = "ERROR" if status_code >= 500 else "WARNING" if status_code >= 400 else "INFO"
                
                getattr(logger, log_level.lower())(
                    "Request completed",
                    request_id=request_id,
                    method=method,
                    path=path,
                    status_code=status_code,
                    duration_seconds=duration,
                    client_ip=client_ip,
                    extra={"request_id": request_id}
                )
            
            await send(message)
        
        await self.app(scope, receive, send_with_logging)
    
    def _get_client_ip(self, scope) -> str:
        """Extract client IP from request"""
        headers = dict(scope.get("headers", []))
        
        # Check X-Forwarded-For header
        forwarded_for = headers.get(b"x-forwarded-for")
        if forwarded_for:
            return forwarded_for.decode().split(",")[0].strip()
        
        # Check X-Real-IP header
        real_ip = headers.get(b"x-real-ip")
        if real_ip:
            return real_ip.decode()
        
        # Fallback to client info
        client = scope.get("client")
        return client[0] if client else "unknown"
    
    def _get_header(self, scope, header_name: str) -> Optional[str]:
        """Get header value from scope"""
        headers = dict(scope.get("headers", []))
        header_value = headers.get(header_name.lower().encode())
        return header_value.decode() if header_value else None


class ErrorHandler:
    """Centralized error handling with detailed logging"""
    
    @staticmethod
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions with logging"""
        request_id = getattr(request.state, "request_id", "unknown")
        
        logger.warning(
            "HTTP exception occurred",
            request_id=request_id,
            status_code=exc.status_code,
            detail=exc.detail,
            path=request.url.path,
            method=request.method,
            extra={"request_id": request_id}
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.status_code,
                    "message": exc.detail,
                    "type": "http_exception",
                    "request_id": request_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
            },
            headers=exc.headers
        )
    
    @staticmethod
    async def validation_exception_handler(request: Request, exc):
        """Handle validation exceptions"""
        request_id = getattr(request.state, "request_id", "unknown")
        
        logger.warning(
            "Validation error occurred",
            request_id=request_id,
            errors=exc.errors(),
            path=request.url.path,
            method=request.method,
            extra={"request_id": request_id}
        )
        
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": 422,
                    "message": "Validation failed",
                    "type": "validation_error",
                    "details": exc.errors(),
                    "request_id": request_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        )
    
    @staticmethod
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle general exceptions with full error tracking"""
        request_id = getattr(request.state, "request_id", "unknown")
        error_id = str(uuid.uuid4())
        
        # Log the full exception with traceback
        logger.error(
            "Unhandled exception occurred",
            request_id=request_id,
            error_id=error_id,
            exception_type=type(exc).__name__,
            exception_message=str(exc),
            path=request.url.path,
            method=request.method,
            traceback=traceback.format_exc(),
            extra={"request_id": request_id, "error_id": error_id}
        )
        
        # Return sanitized error response
        if settings.DEBUG:
            error_detail = {
                "code": 500,
                "message": str(exc),
                "type": type(exc).__name__,
                "traceback": traceback.format_exc(),
                "request_id": request_id,
                "error_id": error_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            error_detail = {
                "code": 500,
                "message": "Internal server error",
                "type": "internal_error",
                "request_id": request_id,
                "error_id": error_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        return JSONResponse(
            status_code=500,
            content={"error": error_detail}
        )


class AuditLogger:
    """Audit logging for security-sensitive operations"""
    
    @staticmethod
    def log_user_action(
        user_id: Optional[int],
        action: str,
        resource: str,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        success: bool = True
    ):
        """Log user actions for audit trail"""
        logger.info(
            f"User action: {action}",
            user_id=user_id,
            action=action,
            resource=resource,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            timestamp=datetime.utcnow().isoformat(),
            extra={"audit": True}
        )
    
    @staticmethod
    def log_security_event(
        event_type: str,
        severity: str,
        description: str,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Log security events"""
        logger.warning(
            f"Security event: {event_type}",
            event_type=event_type,
            severity=severity,
            description=description,
            user_id=user_id,
            ip_address=ip_address,
            additional_data=additional_data or {},
            timestamp=datetime.utcnow().isoformat(),
            extra={"audit": True, "security": True}
        )
    
    @staticmethod
    def log_admin_action(
        admin_user_id: int,
        action: str,
        target_user_id: Optional[int] = None,
        resource: str = "",
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ):
        """Log admin actions"""
        logger.info(
            f"Admin action: {action}",
            admin_user_id=admin_user_id,
            action=action,
            target_user_id=target_user_id,
            resource=resource,
            details=details or {},
            ip_address=ip_address,
            timestamp=datetime.utcnow().isoformat(),
            extra={"audit": True, "admin": True}
        )


# Performance monitoring
class PerformanceMonitor:
    """Monitor application performance and log slow operations"""
    
    @staticmethod
    def log_slow_operation(
        operation: str,
        duration: float,
        threshold: float = 1.0,
        details: Optional[Dict[str, Any]] = None
    ):
        """Log operations that exceed threshold"""
        if duration > threshold:
            logger.warning(
                f"Slow operation detected: {operation}",
                operation=operation,
                duration_seconds=duration,
                threshold_seconds=threshold,
                details=details or {},
                extra={"performance": True}
            )
    
    @staticmethod
    def log_resource_usage(
        cpu_percent: float,
        memory_mb: float,
        active_connections: int,
        redis_memory_mb: Optional[float] = None
    ):
        """Log system resource usage"""
        logger.info(
            "Resource usage snapshot",
            cpu_percent=cpu_percent,
            memory_mb=memory_mb,
            active_connections=active_connections,
            redis_memory_mb=redis_memory_mb,
            timestamp=datetime.utcnow().isoformat(),
            extra={"metrics": True}
        )


# Initialize logging
setup_logging()

# Export loggers
app_logger = structlog.get_logger("app")
audit_logger = AuditLogger()
performance_monitor = PerformanceMonitor()
error_handler = ErrorHandler() 