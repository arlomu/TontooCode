"""SSE translation for the agent.

Converts upstream OpenAI-style server-sent events into the UI-message
stream protocol (text-start / text-delta / text-end / finish, plus an
error chunk when the stream breaks mid-flight) that the frontend expects.
"""
from __future__ import annotations

import json
from typing import Any, Iterator
from uuid import uuid4


def _sse(payload: dict[str, Any]) -> bytes:
    return ("data: " + json.dumps(payload) + "\n\n").encode("utf-8")


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
