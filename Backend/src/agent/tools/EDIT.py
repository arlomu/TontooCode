"""`edit` tool (TOOLS.md): exact string replacement in a single file."""
from __future__ import annotations

from ._common import resolve_base


def edit_file(
    project_dir: str,
    path: str,
    old_string: str,
    new_string: str,
    replace_all: bool = False,
) -> str:
    """Edit a single file by exact string replacement.

    Mirrors TOOLS.md `edit`: path, old_string and new_string are required,
    replace_all defaults to false. The match must be unique unless
    replace_all is set.
    """
    if not path:
        return "Error: no path given"
    if not old_string:
        return "Error: no old_string given"
    if new_string is None:
        return "Error: no new_string given"
    if old_string == new_string:
        return "Error: old_string and new_string are identical — nothing to do"
    base = resolve_base(project_dir, path)
    if isinstance(base, str):
        return base
    resolved = base
    if not resolved.exists():
        return f"Error: not found: {resolved}"
    if resolved.is_dir():
        return f"Error: '{resolved}' is a directory"
    try:
        text = resolved.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return f"Error: cannot decode '{resolved}' as utf-8 (binary file?)"
    except OSError as exc:
        return f"Error: cannot read '{resolved}': {exc}"
    count = text.count(old_string)
    if count == 0:
        return f"Error: old_string not found in '{resolved}'"
    if count > 1 and not replace_all:
        return (
            f"Error: old_string found {count} times in '{resolved}' — "
            "make it unique or set replace_all to true"
        )
    updated = text.replace(old_string, new_string) if replace_all else text.replace(
        old_string, new_string, 1
    )
    first_line = text[: text.index(old_string)].count("\n") + 1
    try:
        resolved.write_text(updated, encoding="utf-8")
    except OSError as exc:
        return f"Error: cannot write '{resolved}': {exc}"
    done = count if replace_all else 1
    where = f" (first match at line {first_line})" if not replace_all else ""
    return (
        f"{resolved} — replaced {done} "
        f"{'occurrence' if done == 1 else 'occurrences'}{where}"
    )
