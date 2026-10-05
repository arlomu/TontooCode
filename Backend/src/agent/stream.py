"""SSE translation for the agent.

Converts an async stream of text deltas into the UI-message stream
protocol (text-start / text-delta / text-end / finish, plus an error
chunk when the stream breaks mid-flight) that the frontend expects.
"""
from __future__ import annotations

import json
from typing import Any, AsyncIterator
from uuid import uuid4


def _sse(payload: dict[str, Any]) -> bytes:
    return ("data: " + json.dumps(payload) + "\n\n").encode("utf-8")


def error_chunk(text: str) -> bytes:
    return _sse({"type": "error", "errorText": text})


async def iter_ui_chunks(deltas: AsyncIterator[str]) -> AsyncIterator[bytes]:
    """Wrap text deltas in UI-message stream chunks."""
    text_id = f"t_{uuid4().hex[:8]}"
    started = False
    try:
        async for delta in deltas:
            if not delta:
                continue
            if not started:
                yield _sse({"type": "text-start", "id": text_id})
                started = True
            yield _sse({"type": "text-delta", "id": text_id, "delta": delta})
    except Exception as exc:
        yield error_chunk(f"stream interrupted: {exc}")
        return
    if started:
        yield _sse({"type": "text-end", "id": text_id})
    yield _sse({"type": "finish"})
