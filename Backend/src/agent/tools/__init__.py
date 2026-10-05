"""Agent tools: one module per tool, shared plumbing in _common."""
from __future__ import annotations

from typing import Any

from .GLOB import glob_files
from .GREP import grep_files
from .LIST import list_directory
from .READ import read_file
from ._common import (
    MAX_GREP_BYTES,
    MAX_LINE_CHARS,
    MAX_RESULTS,
    SKIP_DIRS,
    TOOL_TIMEOUT,
    TOOLS_POOL,
)

#: Registry for dispatch (more tools plug in here).
TOOL_IMPLS: dict[str, Any] = {
    "list": list_directory,
    "read": read_file,
    "glob": glob_files,
    "grep": grep_files,
}

__all__ = [
    "MAX_GREP_BYTES",
    "MAX_LINE_CHARS",
    "MAX_RESULTS",
    "SKIP_DIRS",
    "TOOL_IMPLS",
    "TOOL_TIMEOUT",
    "TOOLS_POOL",
    "glob_files",
    "grep_files",
    "list_directory",
    "read_file",
]
