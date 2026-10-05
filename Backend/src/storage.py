"""SQLite storage for the Tontoo backend.

Database location: ``~/.tontcode/db/settings.db`` (``Path.home()`` based,
so it resolves to ``%USERPROFILE%`` on Windows and ``$HOME`` elsewhere).

Settings, projects and chat stubs live here. Chat *messages* are
deliberately NOT stored yet — there is no messages table.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    main_folder TEXT NOT NULL DEFAULT '',
    subfolders TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    project_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


def default_db_path() -> Path:
    """Home-based DB path (``%USER_HOME%/.tontcode/db/settings.db``)."""
    return Path.home() / ".tontcode" / "db" / "settings.db"


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Storage:
    """Thread-safe SQLite wrapper (WAL mode, short transactions)."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = Path(path) if path else default_db_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA foreign_keys=ON;")
        self._conn.executescript(SCHEMA)
        # Backfill for databases created before chats.project_id existed.
        try:
            self._conn.execute(
                "ALTER TABLE chats ADD COLUMN project_id TEXT NOT NULL DEFAULT ''"
            )
            self._conn.commit()
        except sqlite3.OperationalError:
            pass
        self._lock = threading.Lock()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    # ----- settings -----

    def get_setting(self, key: str) -> Any | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT value FROM settings WHERE key = ?", (key,)
            ).fetchone()
        return json.loads(row["value"]) if row else None

    def get_all_settings(self) -> dict[str, Any]:
        with self._lock:
            rows = self._conn.execute("SELECT key, value FROM settings").fetchall()
        return {row["key"]: json.loads(row["value"]) for row in rows}

    def set_settings(self, mapping: dict[str, Any]) -> None:
        if not mapping:
            return
        now = utcnow()
        with self._lock:
            self._conn.executemany(
                """INSERT INTO settings (key, value, updated_at)
                   VALUES (?, ?, ?)
                   ON CONFLICT(key) DO UPDATE
                   SET value = excluded.value, updated_at = excluded.updated_at""",
                [(k, json.dumps(v), now) for k, v in mapping.items()],
            )
            self._conn.commit()

    # ----- projects -----

    @staticmethod
    def _row_to_project(row: sqlite3.Row) -> dict[str, Any]:
        try:
            subfolders = json.loads(row["subfolders"])
        except (json.JSONDecodeError, TypeError):
            subfolders = []
        return {
            "id": row["id"],
            "name": row["name"],
            "main_folder": row["main_folder"],
            "subfolders": subfolders if isinstance(subfolders, list) else [],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def list_projects(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM projects ORDER BY created_at ASC"
            ).fetchall()
        return [self._row_to_project(r) for r in rows]

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM projects WHERE id = ?", (project_id,)
            ).fetchone()
        return self._row_to_project(row) if row else None

    def create_project(
        self, project_id: str, name: str, main_folder: str = "",
        subfolders: list[str] | None = None,
    ) -> dict[str, Any]:
        now = utcnow()
        with self._lock:
            self._conn.execute(
                """INSERT INTO projects
                   (id, name, main_folder, subfolders, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (project_id, name, main_folder, json.dumps(subfolders or []), now, now),
            )
            self._conn.commit()
        project = self.get_project(project_id)
        assert project is not None
        return project

    def update_project(
        self,
        project_id: str,
        name: str | None = None,
        main_folder: str | None = None,
        subfolders: list[str] | None = None,
    ) -> dict[str, Any] | None:
        current = self.get_project(project_id)
        if current is None:
            return None
        with self._lock:
            self._conn.execute(
                """UPDATE projects
                   SET name = ?, main_folder = ?, subfolders = ?, updated_at = ?
                   WHERE id = ?""",
                (
                    name if name is not None else current["name"],
                    main_folder if main_folder is not None else current["main_folder"],
                    json.dumps(subfolders) if subfolders is not None else json.dumps(current["subfolders"]),
                    utcnow(),
                    project_id,
                ),
            )
            self._conn.commit()
        return self.get_project(project_id)

    def delete_project(self, project_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM projects WHERE id = ?", (project_id,)
            )
            self._conn.commit()
            return cur.rowcount > 0

    def ensure_default_project(self) -> dict[str, Any]:
        """Seed the one guaranteed project. Only 'default' is seeded."""
        existing = self.get_project("default")
        if existing is not None:
            return existing
        return self.create_project("default", "Default")

    # ----- providers -----

    @staticmethod
    def _row_to_provider(row: sqlite3.Row, *, with_key: bool = False) -> dict[str, Any]:
        item: dict[str, Any] = {
            "id": row["id"],
            "name": row["name"],
            "has_key": bool(row["api_key"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        if with_key:
            item["api_key"] = row["api_key"]
        return item

    def list_providers(self) -> list[dict[str, Any]]:
        """Public listing — API keys are never exposed."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM providers ORDER BY created_at ASC"
            ).fetchall()
        return [self._row_to_provider(r) for r in rows]

    def get_provider(self, provider_id: str, *, with_key: bool = False) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM providers WHERE id = ?", (provider_id,)
            ).fetchone()
        return self._row_to_provider(row, with_key=with_key) if row else None

    def create_provider(self, provider_id: str, name: str, api_key: str = "") -> dict[str, Any]:
        now = utcnow()
        with self._lock:
            self._conn.execute(
                """INSERT INTO providers (id, name, api_key, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (provider_id, name, api_key, now, now),
            )
            self._conn.commit()
        provider = self.get_provider(provider_id)
        assert provider is not None
        return provider

    def delete_provider(self, provider_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM providers WHERE id = ?", (provider_id,)
            )
            self._conn.commit()
            return cur.rowcount > 0

    # ----- chats (stubs only: id + name, no messages) -----

    def create_chat(self, name: str, project_id: str = "") -> dict[str, Any]:
        now = utcnow()
        with self._lock:
            cur = self._conn.execute(
                """INSERT INTO chats (name, project_id, created_at, updated_at)
                   VALUES (?, ?, ?, ?)""",
                (name, project_id, now, now),
            )
            self._conn.commit()
            chat_id = cur.lastrowid
            row = self._conn.execute(
                "SELECT * FROM chats WHERE id = ?", (chat_id,)
            ).fetchone()
        assert row is not None
        return {
            "id": row["id"],
            "name": row["name"],
            "project_id": row["project_id"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
