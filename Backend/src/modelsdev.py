"""models.dev catalog: download, slim down, cache in the settings table.

The full catalog (~5 MB, 200+ providers) is fetched once and cached for
24 hours. Only id + name per provider/model are kept — enough for pickers
and menus without bloating the database.
"""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

from storage import Storage

CATALOG_URL = "https://models.dev/api.json"
CACHE_TTL = timedelta(hours=24)
KEY_DATA = "models.catalog"
KEY_FETCHED_AT = "models.catalog_fetched_at"


class ModelsDevError(RuntimeError):
    """Raised when the catalog cannot be downloaded and no cache exists."""


def _download() -> dict[str, Any]:
    req = urllib.request.Request(
        CATALOG_URL, headers={"User-Agent": "tontoocode-backend/0.1.0"}
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def _slim(raw: dict[str, Any]) -> dict[str, Any]:
    providers: dict[str, Any] = {}
    for pid, p in raw.items():
        if not isinstance(p, dict):
            continue
        models = p.get("models") or {}
        slim_models = [
            {"id": mid, "name": m.get("name", mid)}
            for mid, m in models.items()
            if isinstance(m, dict)
        ]
        providers[pid] = {
            "id": pid,
            "name": p.get("name", pid),
            "env": p.get("env", []),
            "api": p.get("api"),
            "doc": p.get("doc"),
            "model_count": len(slim_models),
            "models": slim_models,
        }
    return {"providers": providers}


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def find_provider(catalog: dict[str, Any], query: str) -> dict[str, Any] | None:
    """Match a provider by id, exact name, or normalized name."""
    providers = catalog.get("providers", {})
    if query in providers:
        return providers[query]
    want = _normalize(query)
    for pid, p in providers.items():
        if _normalize(pid) == want or _normalize(p.get("name", "")) == want:
            return p
    return None


def get_catalog(storage: Storage, *, refresh: bool = False) -> dict[str, Any]:
    """Return the slim catalog, refreshing it when missing, stale, or forced.

    If the download fails but a (stale) cache exists, the stale cache is
    returned so the UI keeps working offline.
    """
    cached = storage.get_setting(KEY_DATA)
    fetched_at = storage.get_setting(KEY_FETCHED_AT)

    stale = True
    if not refresh and isinstance(cached, dict) and isinstance(fetched_at, str):
        try:
            age = datetime.now(timezone.utc) - datetime.fromisoformat(fetched_at)
            stale = age > CACHE_TTL
        except ValueError:
            stale = True

    if not stale and isinstance(cached, dict):
        return cached

    try:
        slim = _slim(_download())
    except Exception as exc:
        if isinstance(cached, dict):
            return cached
        raise ModelsDevError(f"models.dev download failed: {exc}") from exc

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    storage.set_settings({KEY_DATA: slim, KEY_FETCHED_AT: now})
    return slim


def catalog_stats(catalog: dict[str, Any]) -> dict[str, int]:
    providers = catalog.get("providers", {})
    return {
        "providers": len(providers),
        "models": sum(p.get("model_count", 0) for p in providers.values()),
    }
