import json
import traceback
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Mapping

from colorama import Fore, Style, init

init(autoreset=True)

_LOG_CONTEXT: ContextVar[dict[str, Any]] = ContextVar("_LOG_CONTEXT", default={})

_LEVEL_COLORS = {
    "DEBUG": Fore.CYAN,
    "INFO": Fore.BLUE,
    "SUCCESS": Fore.GREEN,
    "WARNING": Fore.YELLOW,
    "ERROR": Fore.RED,
}


def truncate_text(value: Any, max_len: int = 600, max_lines: int = 20) -> str:
    text = value if isinstance(value, str) else str(value)
    lines = text.splitlines()
    visible_lines = lines[:max_lines]
    preview = "\n".join(visible_lines)

    if len(preview) > max_len:
        preview = preview[:max_len]

    hidden_chars = max(0, len(text) - len(preview))
    hidden_lines = max(0, len(lines) - len(visible_lines))

    if hidden_chars == 0 and hidden_lines == 0:
        return preview

    markers: list[str] = []
    if hidden_lines > 0:
        markers.append(f"{hidden_lines} lines")
    if hidden_chars > 0:
        markers.append(f"{hidden_chars} chars")

    return f"{preview}\n...[truncated {', '.join(markers)}]"


def _serialize_value(value: Any) -> str:
    if isinstance(value, BaseException):
        return json.dumps(
            {
                "name": type(value).__name__,
                "message": str(value),
                "stack": truncate_text(
                    "".join(
                        traceback.format_exception(
                            type(value), value, value.__traceback__
                        )
                    ),
                    max_len=3000,
                    max_lines=40,
                ),
            },
            ensure_ascii=True,
        )

    if isinstance(value, (dict, list, tuple, set)):
        try:
            return truncate_text(
                json.dumps(value, default=str, ensure_ascii=True),
                max_len=800,
                max_lines=20,
            )
        except Exception:
            return truncate_text(value)

    return truncate_text(value, max_len=240, max_lines=8)


def set_log_context(**context: Any) -> None:
    current = dict(_LOG_CONTEXT.get())
    for key, value in context.items():
        if value is None:
            current.pop(key, None)
        else:
            current[key] = value
    _LOG_CONTEXT.set(current)


def clear_log_context(*keys: str) -> None:
    if not keys:
        _LOG_CONTEXT.set({})
        return

    current = dict(_LOG_CONTEXT.get())
    for key in keys:
        current.pop(key, None)
    _LOG_CONTEXT.set(current)


def _format_context(context: Mapping[str, Any] | None = None) -> str:
    merged = dict(_LOG_CONTEXT.get())
    if context:
        merged.update({key: value for key, value in context.items() if value is not None})

    if not merged:
        return ""

    parts = [f"{key}={_serialize_value(value)}" for key, value in merged.items()]
    return " | " + " ".join(parts)


def _log(
    level: str,
    message: str,
    *,
    context: Mapping[str, Any] | None = None,
    exc_info: BaseException | None = None,
) -> None:
    color = _LEVEL_COLORS[level]
    timestamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
    context_suffix = _format_context(context)

    print(
        f"{color}{Style.BRIGHT}{timestamp} {level}: {truncate_text(message, max_len=500, max_lines=8)}{context_suffix}{Style.RESET_ALL}"
    )

    if exc_info is not None:
        stack = truncate_text(
            "".join(traceback.format_exception(type(exc_info), exc_info, exc_info.__traceback__)),
            max_len=4000,
            max_lines=60,
        )
        print(f"{color}{stack}{Style.RESET_ALL}")


def log_debug(message: str, context: Mapping[str, Any] | None = None) -> None:
    _log("DEBUG", message, context=context)


def log_error(
    message: str,
    context: Mapping[str, Any] | None = None,
    exc_info: BaseException | None = None,
) -> None:
    _log("ERROR", message, context=context, exc_info=exc_info)


def log_success(message: str, context: Mapping[str, Any] | None = None) -> None:
    _log("SUCCESS", message, context=context)


def log_info(message: str, context: Mapping[str, Any] | None = None) -> None:
    _log("INFO", message, context=context)


def log_warning(message: str, context: Mapping[str, Any] | None = None) -> None:
    _log("WARNING", message, context=context)