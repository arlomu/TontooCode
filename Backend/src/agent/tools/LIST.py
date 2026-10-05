"""`list` tool (TOOLS.md): show folders and files in a directory."""
from __future__ import annotations

import os
from pathlib import Path

from ._common import (
    MAX_RESULTS,
    _file_size,
    _human_size,
    hidden,
    resolve_base,
)


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

    base = resolve_base(project_dir, path)
    if isinstance(base, str):
        return base
    resolved = base
    if not resolved.exists():
        return f"Error: not found: {resolved}"
    if not resolved.is_dir():
        return f"Error: not a directory: {resolved}"

    entries: list[tuple[str, bool, int]] = []  # (display, is_dir, size)
    total = 0
    truncated = False

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
