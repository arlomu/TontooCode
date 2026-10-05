"""`write` tool (TOOLS.md): create or overwrite a file."""
from __future__ import annotations

from ._common import resolve_base

#: Refuse contents larger than this (protects context and disk).
MAX_WRITE_CHARS = 1_000_000


def write_file(project_dir: str, path: str, content: str) -> str:
    """Create or overwrite a file (parent folders are created as needed).

    Mirrors TOOLS.md `write`: path and content are required.
    """
    if not path:
        return "Error: no path given"
    if content is None:
        return "Error: no content given"
    if len(content) > MAX_WRITE_CHARS:
        return (
            f"Error: content too large ({len(content)} chars, "
            f"max {MAX_WRITE_CHARS}) — split it into smaller writes"
        )
    base = resolve_base(project_dir, path)
    if isinstance(base, str):
        return base
    resolved = base
    if resolved.exists() and resolved.is_dir():
        return f"Error: '{resolved}' is a directory"
    try:
        if resolved.parent and not resolved.parent.exists():
            resolved.parent.mkdir(parents=True, exist_ok=True)
        existed = resolved.exists()
        resolved.write_text(content, encoding="utf-8")
    except OSError as exc:
        return f"Error: cannot write '{resolved}': {exc}"
    verb = "overwrote" if existed else "created"
    lines = content.count("\n") + (0 if content.endswith("\n") or not content else 1)
    return f"{resolved} — {verb} ({lines} lines, {len(content)} chars)"
