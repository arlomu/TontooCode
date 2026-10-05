"""`grep` tool (TOOLS.md): matching lines with file paths (regex)."""
from __future__ import annotations

import fnmatch
import os
import re
from pathlib import Path

from ._common import (
    MAX_GREP_BYTES,
    MAX_LINE_CHARS,
    SKIP_DIRS,
    hidden,
    resolve_base,
)


def grep_files(
    project_dir: str,
    pattern: str,
    path: str = "",
    glob: str = ".",
    case_insensitive: bool = False,
    max_matches: int = 150,
) -> str:
    """Return matching lines with file paths (regex over file content).

    Mirrors TOOLS.md `grep`: pattern is required, path defaults to the
    project folder (a single file is allowed too), glob filters files
    ("." means all), case_insensitive toggles case, max_matches caps
    output (default 150).
    """
    if not pattern:
        return "Error: no pattern given"
    try:
        flags = re.IGNORECASE if case_insensitive else 0
        matcher = re.compile(pattern, flags)
    except re.error as exc:
        return f"Error: invalid pattern '{pattern}': {exc}"
    try:
        max_matches = max(1, min(int(max_matches), 1000))
    except (TypeError, ValueError):
        max_matches = 150
    base = resolve_base(project_dir, path)
    if isinstance(base, str):
        return base
    if not base.exists():
        return f"Error: not found: {base}"
    use_filter = bool(glob and glob not in (".", "*"))

    def wanted(rel: str) -> bool:
        if not use_filter:
            return True
        return fnmatch.fnmatch(rel, glob) or fnmatch.fnmatchcase(rel, glob)

    files: list[Path] = []
    if base.is_file():
        files = [base]
        search_root = base.parent
    else:
        search_root = base
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = sorted(
                d
                for d in dirnames
                if not hidden(d) and d not in SKIP_DIRS
            )
            here = Path(dirpath)
            for name in sorted(filenames, key=str.casefold):
                if hidden(name):
                    continue
                candidate = here / name
                try:
                    rel = candidate.relative_to(search_root).as_posix()
                except ValueError:
                    continue
                if wanted(rel):
                    files.append(candidate)

    matches: list[str] = []
    total = 0
    truncated = False
    for file in files:
        try:
            if file.stat().st_size > MAX_GREP_BYTES:
                continue
            text = file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        try:
            rel = file.relative_to(search_root).as_posix()
        except ValueError:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            try:
                hit = matcher.search(line) is not None
            except re.error:
                continue
            if not hit:
                continue
            total += 1
            if len(matches) >= max_matches:
                truncated = True
                break
            shown = line if len(line) <= MAX_LINE_CHARS else line[:MAX_LINE_CHARS] + "…"
            matches.append(f"{rel}:{lineno}: {shown}")
        if truncated:
            break
    lines = [f'{search_root} — pattern "{pattern}": {total} match{"es" if total != 1 else ""}']
    if truncated:
        lines[0] += f" (showing first {max_matches})"
    lines.extend(matches)
    if not matches:
        lines.append("(no matches)")
    return "\n".join(lines)
