"""Minimal streaming chat agent (no tools yet).

Resolves the configured provider for a model id, calls its
OpenAI-compatible chat-completions endpoint with stream=true and
translates the upstream SSE chunks into the UI-message stream protocol
(text-start / text-delta / text-end / finish) that the frontend expects.
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from typing import Any, Iterator
from uuid import uuid4

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
}


def resolve_provider(storage: Storage, model: str) -> tuple[dict[str, Any], str, str]:
    """Match the model prefix against configured providers (keys included).

    Returns the provider (with API key), the upstream API base URL and the
    short model id to send upstream.
    """
    prefix = model.split("/")[0] if "/" in model else model
    if not prefix:
        raise AgentError(400, "no model selected")
    provider: dict[str, Any] | None = None
    if storage.get_provider(prefix) is not None:
        provider = storage.get_provider(prefix, with_key=True)
    else:
        for cand in storage.list_providers():
            full = storage.get_provider(cand["id"], with_key=True)
            if full is not None and _norm(full["name"]) == _norm(prefix):
                provider = full
                break
    if provider is None:
        raise AgentError(
            409,
            f"no provider configured for model '{model}' — add one in Settings > Providers",
        )
    if not provider.get("api_key"):
        raise AgentError(
            409,
            f"provider '{provider['name']}' has no API key — add one in Settings > Providers",
        )
    try:
        catalog = modelsdev.get_catalog(storage)
    except modelsdev.ModelsDevError as exc:
        raise AgentError(502, str(exc)) from exc
    entry = modelsdev.find_provider(catalog, provider["id"]) or modelsdev.find_provider(
        catalog, provider["name"]
    )
    if entry is None:
        raise AgentError(
            502, f"provider '{provider['name']}' is not in the models catalog"
        )
    api = PROVIDER_API.get(entry["id"], "").rstrip("/")
    if not api:
        raise AgentError(
            502,
            f"provider '{provider['name']}' is not supported by the minimal agent yet",
        )
    short = model
    if "/" in model and model.startswith(entry["id"] + "/"):
        short = model[len(entry["id"]) + 1 :]
    return provider, api, short


def to_openai_messages(messages: list[Any]) -> list[dict[str, str]]:
    """Flatten UI messages (parts with text) into OpenAI chat messages."""
    out: list[dict[str, str]] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        if role not in ("user", "assistant", "system"):
            continue
        text = ""
        parts = message.get("parts")
        if isinstance(parts, list):
            text = "\n".join(
                part.get("text", "")
                for part in parts
                if isinstance(part, dict)
                and part.get("type") == "text"
                and isinstance(part.get("text"), str)
            )
        elif isinstance(message.get("content"), str):
            text = message["content"]
        text = text.strip()
        if text:
            out.append({"role": role, "content": text})
    return out


def _sse(payload: dict[str, Any]) -> bytes:
    return ("data: " + json.dumps(payload) + "\n\n").encode("utf-8")


def open_completion_stream(
    api: str, api_key: str, model: str, messages: list[dict[str, str]]
):
    """POST to the upstream chat-completions endpoint, return the open response."""
    body = json.dumps({"model": model, "messages": messages, "stream": True}).encode(
        "utf-8"
    )
    req = urllib.request.Request(
        api + "/chat/completions",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        return urllib.request.urlopen(req, timeout=120)
    except urllib.error.HTTPError as exc:
        detail = f"provider request failed (HTTP {exc.code})"
        if exc.code == 401:
            detail = "provider rejected the API key (HTTP 401) — check it in Settings > Providers"
        elif exc.code == 404:
            detail = f"provider has no such model (HTTP 404) — '{model}'"
        raise AgentError(502, detail) from exc
    except Exception as exc:
        raise AgentError(502, f"provider unreachable: {exc}") from exc


def iter_ui_chunks(response) -> Iterator[bytes]:
    """Translate upstream OpenAI-style SSE into UI-message stream chunks."""
    text_id = f"t_{uuid4().hex[:8]}"
    started = False
    try:
        while True:
            raw = response.readline()
            if not raw:
                break
            line = raw.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                event = json.loads(data)
            except json.JSONDecodeError:
                continue
            content = ""
            choices = event.get("choices") if isinstance(event, dict) else None
            if isinstance(choices, list):
                for choice in choices:
                    if not isinstance(choice, dict):
                        continue
                    delta = choice.get("delta")
                    piece = delta.get("content") if isinstance(delta, dict) else None
                    if isinstance(piece, str):
                        content += piece
            if not content:
                continue
            if not started:
                yield _sse({"type": "text-start", "id": text_id})
                started = True
            yield _sse({"type": "text-delta", "id": text_id, "delta": content})
    except Exception as exc:
        yield _sse({"type": "error", "errorText": f"stream interrupted: {exc}"})
        return
    finally:
        try:
            response.close()
        except Exception:
            pass
    if started:
        yield _sse({"type": "text-end", "id": text_id})
    yield _sse({"type": "finish"})
