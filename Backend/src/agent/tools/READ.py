"""`read` tool (TOOLS.md): return file content, sliced by line range."""
from __future__ import annotations

import codecs
from pathlib import Path

from ._common import resolve_base


def read_file(
    project_dir: str,
    path: str,
    offset: int = 0,
    limit: int = 100,
    encoding: str = "utf8",
) -> str:
    """Return file content, sliced by line range.

    Mirrors TOOLS.md `read`: path is required, offset defaults to 0,
    limit to 100 lines, encoding to utf8.
    """
    try:
        offset = max(0, int(offset))
    except (TypeError, ValueError):
        offset = 0
    try:
        limit = max(1, min(int(limit), 2000))
    except (TypeError, ValueError):
        limit = 100

    try:
        codec = codecs.lookup(encoding or "utf8").name
    except LookupError:
        return f"Error: unknown encoding '{encoding}'"

    if not path:
        return "Error: no path given"
    base = resolve_base(project_dir, path)
    if isinstance(base, str):
        return base
    resolved = base
    if not resolved.exists():
        return f"Error: not found: {resolved}"
    if resolved.is_dir():
        return f"Error: '{resolved}' is a directory — use list"
    try:
        text = resolved.read_text(encoding=codec)
    except UnicodeDecodeError:
        return f"Error: cannot decode '{resolved}' as {codec} (binary file?)"
    except OSError as exc:
        return f"Error: cannot read '{resolved}': {exc}"
    lines = text.splitlines()
    total = len(lines)
    if total == 0:
        return f"{resolved} — empty file (0 lines)"
    window = lines[offset : offset + limit]
    if not window:
        return f"{resolved} — lines {offset + 1}–{offset + limit} of {total} (no lines in this range)"
    numbered = [f"{offset + i + 1}: {line}" for i, line in enumerate(window)]
    head = f"{resolved} — lines {offset + 1}–{offset + len(window)} of {total}"
    return head + "\n" + "\n".join(numbered)
