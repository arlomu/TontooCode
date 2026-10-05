"""`glob` tool (TOOLS.md): find files by pattern."""
from __future__ import annotations

from ._common import MAX_RESULTS, resolve_base


def glob_files(
    project_dir: str,
    pattern: str,
    path: str = "",
    max_results: int = 100,
) -> str:
    """Find files by pattern (supports *, ?, [...] and **).

    Mirrors TOOLS.md `glob`: pattern is required, path defaults to the
    project folder, max_results caps the listing (default 100).
    """
    if not pattern or not pattern.strip():
        return "Error: no pattern given"
    try:
        max_results = max(1, min(int(max_results), 1000))
    except (TypeError, ValueError):
        max_results = 100
    base = resolve_base(project_dir, path)
    if isinstance(base, str):
        return base
    if not base.exists():
        return f"Error: not found: {base}"
    if not base.is_dir():
        return f"Error: not a directory: {base}"
    try:
        matches = [p for p in base.glob(pattern) if p.is_file()]
    except (OSError, ValueError) as exc:
        return f"Error: bad pattern '{pattern}': {exc}"
    matches.sort(key=lambda p: p.relative_to(base).as_posix().casefold())
    total = len(matches)
    shown = matches[:max_results]
    lines = [f'{base} — pattern "{pattern}": {total} match{"es" if total != 1 else ""}']
    if total > len(shown):
        lines[0] += f" (showing first {len(shown)})"
    for match in shown:
        lines.append(match.relative_to(base).as_posix())
    if not shown:
        lines.append("(no matches)")
    return "\n".join(lines)
