"""Persistence boundary for the agent: chat stubs for agent runs.

Chat titles are always the prompt head (first TITLE_MAX_LENGTH chars),
so the rule lives here instead of diverging between callers.
"""
from __future__ import annotations

from typing import Any

from storage import Storage

TITLE_MAX_LENGTH = 20
FALLBACK_TITLE = "New chat"


def build_title(prompt: str) -> str:
    """Derive a chat title from a prompt head, with a fallback."""
    title = (prompt or "")[:TITLE_MAX_LENGTH].strip()
    return title or FALLBACK_TITLE


def create_chat(storage: Storage, name: str, project_id: str = "") -> dict[str, Any]:
    """Create a chat stub (id + title), enforcing the title rule."""
    return storage.create_chat(build_title(name), project_id.strip())
