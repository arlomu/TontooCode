"""Settings registry: known keys, product defaults, light validation.

Mirrors the frontend sections (General, Appearance, Personalization,
Computer Use, Browser Use) plus the active chat state (model and thinking
level) so UI and API speak the same key vocabulary.
All state is RAM + SQLite only; chats are not part of this module.
"""
from __future__ import annotations

from typing import Any

from storage import Storage

DEFAULTS: dict[str, Any] = {
    # general
    "general.folder": "C:\\Users\\arlo1\\tflow",
    "general.shell": "Git Bash \u2014 default",
    "general.notify": True,
    "general.sound": True,
    # appearance
    "appearance.design": "light",
    "appearance.preset": "tontoo-light",
    "appearance.overrides": {},
    # personalization
    "personalization.name": "",
    "personalization.hobbies": "",
    "personalization.about": "",
    "personalization.emojis": "some",
    "personalization.structure": "some",
    "personalization.detail": "normal",
    "personalization.tone": "factual",
    # computer use
    "computer_use.enabled": True,
    "computer_use.selection_mode": "allow",
    "computer_use.selected_apps": [],
    "computer_use.cursor_color": "#FF7300",
    # browser use
    "browser_use.open_links_with": "System Default",
    "browser_use.clear_browsing_data": True,
    "browser_use.cursor_color": "#7D24EB",
    # chat
    "chat.model": "opencode/space-bunny-free",
    "chat.thinking_level": "medium",
}

ALLOWED_KEYS = frozenset(DEFAULTS)


class SettingsError(ValueError):
    """Raised for unknown keys or type mismatches."""


def validate_patch(patch: dict[str, Any]) -> dict[str, Any]:
    """Reject unknown keys and values whose type differs from the default."""
    cleaned: dict[str, Any] = {}
    for key, value in patch.items():
        if key not in ALLOWED_KEYS:
            raise SettingsError(f"unknown settings key: {key!r}")
        expected = type(DEFAULTS[key])
        # bool is a subclass of int — require exact bool for bool defaults.
        if expected is bool and not isinstance(value, bool):
            raise SettingsError(f"key {key!r} expects a boolean")
        if expected is not bool and not isinstance(value, expected):
            raise SettingsError(
                f"key {key!r} expects {expected.__name__}, got {type(value).__name__}"
            )
        cleaned[key] = value
    return cleaned


class SettingsService:
    """Reads defaults overlaid with stored values; writes validated patches."""

    def __init__(self, storage: Storage) -> None:
        self._storage = storage

    def all(self) -> dict[str, Any]:
        stored = self._storage.get_all_settings()
        merged = dict(DEFAULTS)
        for key, value in stored.items():
            if key in ALLOWED_KEYS:
                merged[key] = value
        return merged

    def update(self, patch: dict[str, Any]) -> dict[str, Any]:
        cleaned = validate_patch(patch)
        self._storage.set_settings(cleaned)
        return self.all()
