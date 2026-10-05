"""Agent tools: one module per tool, shared plumbing in _common."""
from __future__ import annotations

from typing import Any

from .APPLY_PATCH import apply_patch
from .EDIT import edit_file
from .GLOB import glob_files
from .GREP import grep_files
from .LIST import list_directory
from .READ import read_file
from .WRITE import write_file
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
    "edit": edit_file,
    "write": write_file,
    "apply_patch": apply_patch,
}

__all__ = [
    "MAX_GREP_BYTES",
    "MAX_LINE_CHARS",
    "MAX_RESULTS",
    "SKIP_DIRS",
    "TOOL_IMPLS",
    "TOOL_TIMEOUT",
    "TOOLS_POOL",
    "apply_patch",
    "edit_file",
    "glob_files",
    "grep_files",
    "list_directory",
    "read_file",
    "write_file",
]
