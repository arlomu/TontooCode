"""Tool implementations for the agent.

Tools run in a small dedicated thread pool (2 workers) so a slow tool
never blocks the request thread or the event loop — the backend and all
other chats stay responsive while a tool executes.
"""
from __future__ import annotations

import os
import re
import fnmatch
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
import codecs

# Two workers: enough for parallel tool calls, bounded so runaway tools
# cannot exhaust the machine. Extra calls queue instead of blocking.
TOOLS_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="tontoo-tool")

#: Hard cap per listing (TOOLS.md).
MAX_RESULTS = 250

#: Max seconds a single tool call may take before it reports a timeout.
#: The worker thread keeps running; only the wait is abandoned.
TOOL_TIMEOUT = 120


def _human_size(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"


def list_directory(
    project_dir: str,
    path: str = "",
    recursive: bool = False,
    include_hidden: bool = False,
    max_depth: int = 0,
    hide_folders: bool = False,
) -> str:
    """Show folders and files in a directory (max 250 results).

    Mirrors TOOLS.md `list`: path defaults to the project folder,
    recursive descends, max_depth limits levels (0 = unlimited),
    include_hidden shows dotfiles, hide_folders lists files only.
    """
    recursive = bool(recursive)
    include_hidden = bool(include_hidden)
    hide_folders = bool(hide_folders)
    try:
        max_depth = max(0, int(max_depth))
    except (TypeError, ValueError):
        max_depth = 0

    if path:
        target = Path(path)
        if not target.is_absolute():
            if not project_dir:
                return "Error: relative path without project context — pass an absolute path"
            target = Path(project_dir) / path
    else:
        if not project_dir:
            return "Error: no path given and no project context"
        target = Path(project_dir)
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
    if not resolved.exists():
        return f"Error: not found: {resolved}"
    if not resolved.is_dir():
        return f"Error: not a directory: {resolved}"

    entries: list[tuple[str, bool, int]] = []  # (display, is_dir, size)
    total = 0
    truncated = False

    def hidden(name: str) -> bool:
        return name.startswith(".")

    if not recursive:
        # Flat: read everything, sort, then cap the display.
        try:
            with os.scandir(resolved) as it:
                children = list(it)
        except OSError as exc:
            return f"Error: cannot read '{resolved}': {exc}"
        candidates: list[tuple[str, bool, int]] = []
        for entry in children:
            if not include_hidden and hidden(entry.name):
                continue
            try:
                is_dir = entry.is_dir(follow_symlinks=True)
                size = 0 if is_dir else entry.stat(follow_symlinks=True).st_size
            except OSError:
                continue
            if is_dir and hide_folders:
                continue
            candidates.append((entry.name + "/" if is_dir else entry.name, is_dir, size))
        total = len(candidates)
        candidates.sort(key=lambda e: (not e[1], e[0].casefold()))
        if len(candidates) > MAX_RESULTS:
            truncated = True
            candidates = candidates[:MAX_RESULTS]
        entries = candidates
    else:
        # Recursive: cap while walking so huge trees stay bounded.
        def add(rel: str, is_dir: bool, size: int) -> bool:
            """Append unless capped. Returns False when the cap is hit."""
            nonlocal total, truncated
            total += 1
            if len(entries) >= MAX_RESULTS:
                truncated = True
                return False
            if is_dir and hide_folders:
                return True
            entries.append((rel, is_dir, size))
            return True

        try:
            for dirpath, dirnames, filenames in os.walk(resolved):
                here = Path(dirpath)
                try:
                    rel_base = here.relative_to(resolved)
                except ValueError:
                    continue
                depth = 0 if str(rel_base) == "." else len(rel_base.parts)
                if not include_hidden:
                    dirnames[:] = [d for d in dirnames if not hidden(d)]
                    filenames = [f for f in filenames if not hidden(f)]
                dirnames.sort(key=str.casefold)
                filenames.sort(key=str.casefold)
                stop = False
                if depth >= 1:
                    rel = rel_base.as_posix() + "/"
                    if max_depth and depth > max_depth:
                        dirnames[:] = []
                        continue
                    if not add(rel, True, 0):
                        break
                if max_depth and depth >= max_depth:
                    dirnames[:] = []
                    continue
                for name in filenames:
                    if not add(
                        (rel_base / name).as_posix() if str(rel_base) != "." else name,
                        False,
                        _file_size(here / name),
                    ):
                        stop = True
                        break
                if stop:
                    break
        except OSError as exc:
            return f"Error: cannot read '{resolved}': {exc}"
        entries.sort(key=lambda e: (not e[1], e[0].casefold()))
    if truncated:
        lines = [f"{resolved} — showing first {len(entries)} of {total}+ entries"]
    else:
        lines = [f"{resolved} — {total} {'entry' if total == 1 else 'entries'}"]
    for rel, is_dir, size in entries:
        lines.append(f"DIR  {rel}" if is_dir else f"FILE {rel} ({_human_size(size)})")
    return "\n".join(lines)


def _file_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except OSError:
        return 0


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

    target = Path(path) if path else None
    if target is None:
        return "Error: no path given"
    if not target.is_absolute():
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


#: Registry for dispatch (more tools plug in here).
TOOL_IMPLS: dict[str, Any] = {
    "list": list_directory,
    "read": read_file,
}


def _resolve_base(project_dir: str, path: str) -> Path | str:
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
    base = _resolve_base(project_dir, path)
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


#: Directories never searched by grep (noise, not secrets).
SKIP_DIRS = frozenset(
    {".git", "node_modules", "__pycache__", "dist", "build", ".venv", "venv", "out", "target"}
)

#: Files larger than this are skipped by grep.
MAX_GREP_BYTES = 5 * 1024 * 1024

#: Content lines longer than this are truncated in grep output.
MAX_LINE_CHARS = 300


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
    base = _resolve_base(project_dir, path)
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
                if not d.startswith(".") and d not in SKIP_DIRS
            )
            here = Path(dirpath)
            for name in sorted(filenames, key=str.casefold):
                if name.startswith("."):
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


#: Registry for dispatch (more tools plug in here).
TOOL_IMPLS: dict[str, Any] = {
    "list": list_directory,
    "read": read_file,
    "glob": glob_files,
    "grep": grep_files,
}
