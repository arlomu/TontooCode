"""System prompt composer for the agent.

Loads ``prompts/systemprompts/*.md`` in list.txt order, substitutes known
``%placeholders%`` with real values (time, OS, settings, project, model)
and leaves unknown ones (tasks, skills, subagents, ...) literally in place.
"""
from __future__ import annotations

import os
import platform
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from storage import Storage

ORDER = [
    "GENERAL.md",
    "INTERACTION.md",
    "TASK.md",
    "SUBAGENT.md",
    "SKILLS.md",
    "AGENTS.md",
]

PLACEHOLDER = re.compile(r"%([A-Za-z0-9_]+)%")

MAX_FILE_CHARS = 20000

INSTRUCTION_FILES = ("AGENTS.md", "CLAUDE.md", "GEMINI.md", "CURSOR.md")

#: Shell fallback per OS when no shell is configured.
DEFAULT_SHELLS = {
    "Windows": "Git Bash — default",
    "Darwin": "Terminal — default",
    "Linux": "Bash — default",
}


def prompts_dir() -> Path | None:
    """Locate prompts/systemprompts (env override or repo-relative)."""
    override = os.environ.get("TONTOO_PROMPTS_DIR", "").strip()
    if override:
        cand = Path(override)
        return cand if cand.is_dir() else None
    root = Path(__file__).resolve().parent.parent.parent.parent
    cand = root / "prompts" / "systemprompts"
    return cand if cand.is_dir() else None


def load_parts(directory: Path | None = None) -> list[tuple[str, str]]:
    """Read the prompt files in order; missing files are skipped."""
    base = directory if directory is not None else prompts_dir()
    if base is None:
        return []
    parts: list[tuple[str, str]] = []
    for name in ORDER:
        path = base / name
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        if text.strip():
            parts.append((name, text))
    return parts


def _read_instruction_file(folder: str, filename: str) -> str:
    """Read a project instruction file; empty when missing/unreadable."""
    try:
        text = Path(folder, filename).read_text(encoding="utf-8")
    except OSError:
        return ""
    return text[:MAX_FILE_CHARS]


def _setting(settings: dict, key: str) -> str:
    value = settings.get(key, "")
    return str(value) if isinstance(value, (str, int, float, bool)) else ""


def working_dir(storage: Storage, project_id: str) -> tuple[dict | None, str, bool]:
    """Resolve the effective working folder: project folder, else tasks folder.

    Returns (project or None, folder, is_fallback).
    """
    project = storage.get_project(project_id) if project_id else None
    folder = project["main_folder"] if project else ""
    if folder:
        return project, folder, False
    settings = storage.get_all_settings()
    fallback = _setting(settings, "general.folder")
    return project, fallback, True


def build_values(
    storage: Storage, *, model: str, chat_id: str, project_id: str
) -> dict[str, str]:
    """Collect known placeholder values (settings, project, time, model)."""
    settings = storage.get_all_settings()

    def setting(key: str) -> str:
        return _setting(settings, key)

    now = datetime.now().astimezone()
    project, main_folder, is_fallback = working_dir(storage, project_id)
    subfolders = project["subfolders"] if project else []
    shell = setting("general.shell") or DEFAULT_SHELLS.get(platform.system(), "")
    values: dict[str, str] = {
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "weekday": now.strftime("%A"),
        "timezone": now.strftime("%Z"),
        "datetime": now.isoformat(timespec="seconds"),
        "os": platform.system(),
        "shell": shell,
        "project_id": project["id"] if project else "",
        "project_name": project["name"] if project else "",
        "project_main_folder": (
            f"{main_folder} (fallback: tasks folder)" if is_fallback and main_folder
            else main_folder
        ),
        "project_subfolders": ", ".join(subfolders) if subfolders else "(none)",
        "user_name": setting("personalization.name"),
        "model": model,
        "chat_id": chat_id,
        "personalization_name": setting("personalization.name"),
        "personalization_hobbies": setting("personalization.hobbies"),
        "personalization_about": setting("personalization.about"),
        "personalization_emojis": setting("personalization.emojis"),
        "personalization_structure": setting("personalization.structure"),
        "personalization_detail": setting("personalization.detail"),
        "personalization_tone": setting("personalization.tone"),
    }
    for filename in INSTRUCTION_FILES:
        key = filename[:-3].lower() + "_md"
        values[key] = (
            _read_instruction_file(main_folder, filename) if main_folder else f"%{key}%"
        )
    values["tasks"] = _format_tasks(storage)
    return values


def _format_tasks(storage: Storage) -> str:
    """Render active tasks for %tasks% (never invent any)."""
    try:
        tasks = storage.list_tasks()
    except Exception:
        return "(unavailable)"
    active = [t for t in tasks if t["status"] not in ("done", "cancelled")]
    if not active:
        return "(no active tasks)"
    lines = []
    for task in active:
        lines.append(f"- #{task['id']} [{task['status']}] {task['title']}")
        if task["description"]:
            lines.append(f"  {task['description']}")
    return "\n".join(lines)


def substitute(text: str, values: dict[str, str]) -> str:
    """Replace known %placeholders%; leave unknown ones literally in place."""

    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return values.get(key, match.group(0))

    return PLACEHOLDER.sub(replace, text)


def compose(
    storage: Storage,
    *,
    model: str,
    chat_id: str = "",
    project_id: str = "",
    directory: Path | None = None,
) -> str:
    """Load, join and substitute the system prompt files."""
    parts = load_parts(directory)
    if not parts:
        return ""
    values = build_values(
        storage, model=model, chat_id=chat_id, project_id=project_id
    )
    return "\n\n".join(substitute(text, values) for _, text in parts)


def token_hint(text: str) -> int:
    """Rough size estimate (chars/4) for logs."""
    return max(0, len(text) // 4)
