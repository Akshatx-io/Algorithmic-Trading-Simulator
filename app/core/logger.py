"""
Logging configuration.

Development: human-readable, colorized console + plain rotating file logs.
Production:  loguru-native JSON via ``serialize=True`` (one JSON object per
            line). A custom format-function that returns raw JSON is the wrong
            approach -- loguru treats the returned string as a *template* and
            tries to substitute the JSON braces, raising ``KeyError`` on every
            record. ``serialize=True`` is the correct, robust way to emit
            structured logs.
"""

import os
import sys

from loguru import logger

from app.core.config import settings

# Log directory
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

_IS_PROD = settings.environment == "production"
_CONSOLE_FMT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
    "<level>{level}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
    "<level>{message}</level>"
)
_FILE_FMT = "{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}"


def setup_logging():
    """Configure logging sinks based on environment settings."""
    logger.remove()
    log_level = settings.log_level.upper()

    # Console -- JSON in prod (serialize), colorized human-readable in dev.
    logger.add(
        sys.stdout,
        level=log_level,
        serialize=_IS_PROD,
        format=_CONSOLE_FMT,
        colorize=not _IS_PROD,
    )

    # Application log (all levels).
    logger.add(
        os.path.join(LOG_DIR, "app.log"),
        rotation="10 MB", retention="30 days", level=log_level,
        serialize=_IS_PROD, format=_FILE_FMT, compression="gz",
    )

    # Error log (separate, for easier monitoring).
    logger.add(
        os.path.join(LOG_DIR, "error.log"),
        rotation="10 MB", retention="90 days", level="ERROR",
        serialize=_IS_PROD, format=_FILE_FMT, compression="gz",
    )

    # Trading activity log (compliance) -- only records tagged with `trading`.
    logger.add(
        os.path.join(LOG_DIR, "trading.log"),
        rotation="50 MB", retention="1 year", level="INFO",
        serialize=_IS_PROD,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
        compression="gz",
        filter=lambda record: "trading" in record["extra"],
    )

    logger.info("Logging system initialized (env={})", settings.environment)


# Initialize on import.
setup_logging()


def get_logger(name: str):
    """Return a logger instance bound with the specified name."""
    return logger.bind(name=name)


__all__ = ["get_logger", "logger"]
