"""Shared plumbing for agent tools: pool, caps, sandbox, formatting."""
from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# Two workers: enough for parallel tool calls, bounded so runaway tools
# cannot exhaust the machine. Extra calls queue instead of blocking.
TOOLS_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="tontoo-tool")

#: Max seconds a single tool call may take before it reports a timeout.
#: The worker thread keeps running; only the wait is abandoned.
TOOL_TIMEOUT = 120

#: Hard cap per listing (TOOLS.md).
MAX_RESULTS = 250

#: Directories never searched by grep (noise, not secrets).
SKIP_DIRS = frozenset(
    {".git", "node_modules", "__pycache__", "dist", "build", ".venv", "venv", "out", "target"}
)

#: Files larger than this are skipped by grep.
MAX_GREP_BYTES = 5 * 1024 * 1024

#: Content lines longer than this are truncated in grep output.
MAX_LINE_CHARS = 300


def hidden(name: str) -> bool:
    return name.startswith(".")


def _human_size(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"


def _file_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except OSError:
        return 0


def resolve_base(project_dir: str, path: str) -> Path | str:
    """Resolve a tool path against the project folder (sandboxed).

    Returns the resolved Path, or an "Error: ..." string.
    """
    target = Path(path) if path else None
    if target is None:
        if not project_dir:
            return "Error: no path given and no project context"
        target = Path(project_dir)
    elif not target.is_absolute():
        if not project_dir:
            return "Error: relative path without project context — pass an absolute path"
        target = Path(project_dir) / path
    try:
        resolved = target.resolve()
    except OSError as exc:
        return f"Error: cannot resolve '{target}': {exc}"
    if project_dir:
        try:
            root = Path(project_dir).resolve()
        except OSError as exc:
            return f"Error: cannot resolve project folder: {exc}"
        if resolved != root and root not in resolved.parents:
            return f"Error: '{resolved}' is outside the project ({root})"
    return resolved
