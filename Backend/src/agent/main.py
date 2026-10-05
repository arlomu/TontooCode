"""Agent entrypoint: turn a chat request into an SSE byte stream."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Iterator

from storage import Storage

from .provider import AgentError, resolve_provider
from .stream import iter_ui_chunks


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


def handle_run(storage: Storage, model: str, messages: list[Any]) -> Iterator[bytes]:
    """Resolve, call upstream eagerly, and return the UI-stream iterator.

    The upstream response is opened eagerly so HTTP errors surface before
    the route commits to a 200 SSE stream.
    """
    provider, api, short_model = resolve_provider(storage, (model or "").strip())
    openai_messages = to_openai_messages(messages or [])
    if not openai_messages:
        raise AgentError(400, "no message text to send")
    upstream = open_completion_stream(
        api, provider["api_key"], short_model, openai_messages
    )
    return iter_ui_chunks(upstream)
