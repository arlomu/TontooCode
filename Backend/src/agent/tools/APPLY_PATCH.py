"""`apply_patch` tool (TOOLS.md): edit multiple files at once.

Accepts standard unified diffs (--- +++, @@ hunks), including new files
(--- /dev/null) and deletions (+++ /dev/null). All hunks are validated
first; files are only written when everything matches (all-or-nothing).
"""
from __future__ import annotations

import re
from pathlib import Path

from ._common import resolve_base

_HUNK_HEAD = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")

#: Refuse patches touching more files than this.
MAX_FILES = 20


def _strip_prefix(path: str) -> str:
    if path.startswith("a/") or path.startswith("b/"):
        return path[2:]
    return path


def _split_lines(text: str) -> list[str]:
    """Split keeping line endings (last element may lack one)."""
    return text.splitlines(keepends=True)


def _text_of(line: str) -> str:
    return line.rstrip("\r\n")


def apply_patch(project_dir: str, patch: str) -> str:
    """Apply a unified diff to the project. Returns a per-file summary."""
    if not patch or not patch.strip():
        return "Error: empty patch"
    try:
        files = _parse(patch)
    except ValueError as exc:
        return f"Error: malformed patch: {exc}"
    if not files:
        return "Error: patch contains no files"
    if len(files) > MAX_FILES:
        return f"Error: patch touches {len(files)} files (max {MAX_FILES})"

    planned: list[tuple[Path, str | None, str]] = []  # (path, new_text|None=delete, label)
    for old, new, hunks in files:
        if old == "/dev/null" and new == "/dev/null":
            return "Error: patch entry with /dev/null on both sides"
        if old == "/dev/null":
            target = _resolve_target(project_dir, new)
            if isinstance(target, str):
                return target
            if target.exists():
                return f"Error: '{target}' already exists — use edit or write"
            try:
                new_text = _apply_hunks([], hunks, str(target))
            except ValueError as exc:
                return f"Error: {target}: {exc}"
            planned.append((target, new_text, "created"))
            continue
        target = _resolve_target(project_dir, old)
        if isinstance(target, str):
            return target
        if not target.exists():
            return f"Error: not found: {target}"
        if target.is_dir():
            return f"Error: '{target}' is a directory"
        try:
            original = target.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return f"Error: cannot decode '{target}' as utf-8 (binary file?)"
        except OSError as exc:
            return f"Error: cannot read '{target}': {exc}"
        if new == "/dev/null":
            planned.append((target, None, "deleted"))
            continue
        try:
            new_text = _apply_hunks(_split_lines(original), hunks, str(target))
        except ValueError as exc:
            return f"Error: {target}: {exc}"
        planned.append((target, new_text, "modified"))

    results: list[str] = []
    for target, new_text, label in planned:
        try:
            if new_text is None:
                target.unlink()
                results.append(f"{target} — deleted")
            else:
                if target.parent and not target.parent.exists():
                    target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(new_text, encoding="utf-8")
                lines = new_text.count("\n") + (
                    0 if new_text.endswith("\n") or not new_text else 1
                )
                results.append(f"{target} — {label} ({lines} lines)")
        except OSError as exc:
            return f"Error: cannot write '{target}': {exc} (earlier files may be unchanged)"
    return "\n".join(results)


def _resolve_target(project_dir: str, name: str) -> Path | str:
    cleaned = _strip_prefix(name.strip().strip('"'))
    if not cleaned or cleaned == "/dev/null":
        return "Error: patch entry with missing filename"
    return resolve_base(project_dir, cleaned)


def _apply_hunks(
    original: list[str], hunks: list[tuple[int, list[str]]], label: str
) -> str:
    """Apply hunks (1-based old_start, body lines) to split original lines."""
    out: list[str] = []
    cursor = 0
    for hunk_no, (old_start, body) in enumerate(hunks, start=1):
        start = max(0, old_start - 1)
        if start < cursor:
            raise ValueError(f"hunk {hunk_no}: overlapping hunks")
        out.extend(original[cursor:start])
        cursor = start
        prev_op: str | None = None
        for line in body:
            if not line:
                raise ValueError(f"hunk {hunk_no}: empty diff line")
            op, text = line[0], line[1:]
            if op == "\\":
                if prev_op in ("+", " "):
                    if out:
                        out[-1] = out[-1].rstrip("\r\n")
                prev_op = None
                continue
            if op not in (" ", "-", "+"):
                raise ValueError(f"hunk {hunk_no}: bad diff line {line!r}")
            if op in (" ", "-"):
                if cursor >= len(original) or _text_of(original[cursor]) != text:
                    actual = _text_of(original[cursor]) if cursor < len(original) else "<eof>"
                    raise ValueError(
                        f"hunk {hunk_no}: context mismatch at line {cursor + 1} "
                        f"(expected {text!r}, found {actual!r})"
                    )
                if op == " ":
                    out.append(original[cursor])
                cursor += 1
            else:
                out.append(text + "\n")
            prev_op = op
    out.extend(original[cursor:])
    return "".join(out)


def _parse(patch: str) -> list[tuple[str, str, list[tuple[int, list[str]]]]]:
    """Parse unified diff into (old, new, [(old_start, body)]) per file."""
    files: list[tuple[str, str, list[tuple[int, list[str]]]]] = []
    old: str | None = None
    new: str | None = None
    hunks: list[tuple[int, list[str]]] = []
    body: list[str] | None = None

    def flush() -> None:
        nonlocal old, new, hunks, body
        if old is None or new is None:
            if old is not None or new is not None or hunks:
                raise ValueError("file entry without ---/+++ headers")
            return
        if body is not None:
            hunks.append((pending_start, body))
        if not hunks:
            raise ValueError(f"no hunks for '{old}'")
        files.append((old, new, hunks))
        old = new = None
        hunks = []
        body = None

    pending_start = 1
    for raw in patch.splitlines():
        if not raw:
            # Blank lines only ever separate sections (empty hunk lines
            # are " " / "+" / "-", never bare).
            continue
        if raw.startswith("--- "):
            if old is not None:
                flush()
            old = raw[4:].split("\t")[0].strip()
        elif raw.startswith("+++ "):
            if old is None:
                raise ValueError("+++ without ---")
            new = raw[4:].split("\t")[0].strip()
        elif raw.startswith("@@ "):
            if old is None or new is None:
                raise ValueError("hunk without file headers")
            match = _HUNK_HEAD.match(raw)
            if not match:
                raise ValueError(f"bad hunk header {raw!r}")
            if body is not None:
                hunks.append((pending_start, body))
            pending_start = int(match.group(1))
            body = []
        elif raw.startswith(("diff ", "index ", "new file", "deleted ", "Binary ")):
            continue
        else:
            if body is None:
                raise ValueError(f"unexpected line outside hunk: {raw!r}")
            body.append(raw)
    if old is not None:
        flush()
    return files
