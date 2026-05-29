"""
Production-grade logging configuration with structured JSON logging and multiple handlers.
"""
import sys
import os
import json
from typing import Dict, Any
from loguru import logger
from app.core.config import settings


# Log directory
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)


class JSONFormatter:
    """Custom JSON formatter for structured logging."""

    def __call__(self, record: Dict[str, Any]) -> str:
        """Format log record as JSON."""
        log_entry = {
            "timestamp": record["time"].isoformat(),
            "level": record["level"].name,
            "logger": record["name"],
            "message": record["message"],
            "module": record["module"],
            "function": record["function"],
            "line": record["line"],
        }

        # Add extra fields if present
        if "extra" in record and record["extra"]:
            log_entry.update(record["extra"])

        # Add exception info if present
        if record["exception"]:
            log_entry["exception"] = record["exception"]

        return json.dumps(log_entry, default=str)


def setup_logging():
    """Configure logging based on environment settings."""

    # Remove default logger
    logger.remove()

    # Determine log level
    log_level = settings.log_level.upper()

    # Console handler for development
    if settings.environment == "development":
        logger.add(
            sys.stdout,
            level=log_level,
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
                   "<level>{level}</level> | "
                   "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
                   "<level>{message}</level>",
        )
    else:
        # JSON logging for production
        logger.add(
            sys.stdout,
            level=log_level,
            format=JSONFormatter(),
        )

    # File handler with rotation
    logger.add(
        os.path.join(LOG_DIR, "app.log"),
        rotation="10 MB",
        retention="30 days",
        level=log_level,
        format=JSONFormatter() if settings.environment == "production" else
               "{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}",
        compression="gz",  # Compress old logs
    )

    # Error log file (separate for easier monitoring)
    logger.add(
        os.path.join(LOG_DIR, "error.log"),
        rotation="10 MB",
        retention="90 days",
        level="ERROR",
        format=JSONFormatter() if settings.environment == "production" else
               "{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}",
        compression="gz",
    )

    # Trading activity log (separate for compliance)
    logger.add(
        os.path.join(LOG_DIR, "trading.log"),
        rotation="50 MB",
        retention="1 year",
        level="INFO",
        format=JSONFormatter() if settings.environment == "production" else
               "{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
        compression="gz",
        filter=lambda record: "trading" in record["extra"] if "extra" in record else False,
    )

    logger.info("Logging system initialized", extra={"environment": settings.environment})


# Initialize logging
setup_logging()


def get_logger(name: str):
    """Get a logger instance with the specified name."""
    return logger.bind(name=name)


# Export logger instance
__all__ = ["logger", "get_logger"]