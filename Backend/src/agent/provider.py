"""Provider resolution for the agent.

Matches a model id prefix against the configured providers (keys included)
and maps the catalog provider to its OpenAI-compatible API base URL.
"""
from __future__ import annotations

import re
from typing import Any

from storage import Storage
import modelsdev


class AgentError(Exception):
    """Carries an HTTP status code plus a user-facing detail message."""

    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


# The models.dev catalog no longer ships API base URLs, so the minimal
# agent maps well-known catalog provider ids to their OpenAI-compatible
# chat-completions endpoints. Anything else gets a clear 502.
PROVIDER_API: dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "google": "https://generativelanguage.googleapis.com/v1beta/openai",
    "deepseek": "https://api.deepseek.com",
    "mistral": "https://api.mistral.ai/v1",
    "xai": "https://api.x.ai/v1",
    "groq": "https://api.groq.com/openai/v1",
    "together": "https://api.together.xyz/v1",
    "fireworks": "https://api.fireworks.ai/inference/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "ollama": "http://localhost:11434/v1",
    "kilo": "https://api.kilo.ai/api/gateway",
}


def _match_configured(
    storage: Storage, prefix: str, entry: dict[str, Any] | None
) -> dict[str, Any] | None:
    """Match a model prefix against configured providers.

    Direct hits (id or name equal the prefix) win; otherwise the models.dev
    catalog entry mediates (id or name equal the entry id or name), so a
    provider picked from the catalog by name still matches.
    """
    wanted = {_norm(prefix)}
    if entry is not None:
        wanted.add(_norm(entry["id"]))
        wanted.add(_norm(entry.get("name", "")))
    for cand in storage.list_providers():
        full = storage.get_provider(cand["id"], with_key=True)
        if full is None:
            continue
        if cand["id"] == prefix or _norm(full["name"]) in wanted:
            return full
    return None


def resolve_provider(storage: Storage, model: str) -> tuple[dict[str, Any], str, str]:
    """Match the model prefix against configured providers (keys included).

    Returns the provider (with API key), the upstream API base URL and the
    short model id to send upstream.
    """
    prefix = model.split("/")[0] if "/" in model else model
    if not prefix:
        raise AgentError(400, "no model selected")
    try:
        catalog = modelsdev.get_catalog(storage)
    except modelsdev.ModelsDevError:
        catalog = None
    entry = modelsdev.find_provider(catalog, prefix) if catalog else None
    provider = _match_configured(storage, prefix, entry)
    if provider is None:
        configured = [c["name"] for c in storage.list_providers()]
        have = f"configured: {', '.join(configured)}" if configured else "no providers configured"
        raise AgentError(
            409,
            f"no provider configured for model '{model}' ({have}) — add one in Settings > Providers",
        )
    if not provider.get("api_key") and not provider.get("base_url"):
        raise AgentError(
            409,
            f"provider '{provider['name']}' has no API key — add one in Settings > Providers",
        )
    api = (provider.get("base_url") or "").rstrip("/")
    if not api and entry is not None:
        api = PROVIDER_API.get(entry["id"], "").rstrip("/")
    if not api:
        raise AgentError(
            502,
            f"provider '{provider['name']}' has no known API endpoint — set a base URL for it",
        )
    short = model
    if "/" in model:
        # Strip the routing prefix (catalog id or configured name); the
        # remainder is the upstream model id (gateways keep their own path).
        short = model[len(prefix) + 1 :]
    return provider, api, short
