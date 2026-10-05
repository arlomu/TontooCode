"""Provider resolution for the agent (pydantic-ai models).

Matches a model id prefix against the configured providers (keys included)
and builds the matching pydantic-ai model: native models for OpenAI
(Responses API), Anthropic, Google, OpenRouter and Ollama, and
OpenAI-compatible chat models for everything else with a known or custom
base URL.
"""
from __future__ import annotations

import re
from typing import Any

from storage import Storage
import modelsdev

from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.ollama import OllamaModel
from pydantic_ai.models.openai import OpenAIChatModel, OpenAIResponsesModel
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.providers.openrouter import OpenRouterProvider


class AgentError(Exception):
    """Carries an HTTP status code plus a user-facing detail message."""

    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


# Fallback base URLs for OpenAI-compatible providers without a custom one.
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


def _resolve_record(
    storage: Storage, model: str
) -> tuple[dict[str, Any], dict[str, Any] | None, str]:
    """Match model id to (configured provider, catalog entry, short model id)."""
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
    pid = entry["id"] if entry is not None else ""
    if not provider.get("api_key") and not provider.get("base_url") and pid != "ollama":
        raise AgentError(
            409,
            f"provider '{provider['name']}' has no API key — add one in Settings > Providers",
        )
    short = model
    if "/" in model:
        # Strip the routing prefix (catalog id or configured name); the
        # remainder is the upstream model id (gateways keep their own path).
        short = model[len(prefix) + 1 :]
    return provider, entry, short


def build_model(storage: Storage, model: str):
    """Build the pydantic-ai model for a model id."""
    record, entry, short = _resolve_record(storage, (model or "").strip())
    key = record.get("api_key") or ""
    base = (record.get("base_url") or "").rstrip("/")
    pid = entry["id"] if entry is not None else ""
    if pid == "openai":
        return OpenAIResponsesModel(short, provider=OpenAIProvider(api_key=key))
    if pid == "anthropic":
        return AnthropicModel(short, provider=AnthropicProvider(api_key=key))
    if pid == "google":
        return GoogleModel(short, provider=GoogleProvider(api_key=key))
    if pid == "openrouter":
        return OpenRouterModel(short, provider=OpenRouterProvider(api_key=key))
    if pid == "ollama":
        return OllamaModel(
            short,
            provider=OllamaProvider(
                base_url=base or "http://localhost:11434/v1", api_key=key or None
            ),
        )
    if not base:
        base = PROVIDER_API.get(pid, "")
    if not base:
        raise AgentError(
            502,
            f"provider '{record['name']}' has no known API endpoint — set a base URL for it",
        )
    return OpenAIChatModel(short, provider=OpenAIProvider(base_url=base, api_key=key))
