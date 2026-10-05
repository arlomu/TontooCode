"""SSE translation for the agent.

UI-message stream chunks (text-start / text-delta / text-end / finish,
tool input/output, error) that the frontend expects.
"""
from __future__ import annotations

import json
from typing import Any


def _sse(payload: dict[str, Any]) -> bytes:
    return ("data: " + json.dumps(payload) + "\n\n").encode("utf-8")


def error_chunk(text: str) -> bytes:
    return _sse({"type": "error", "errorText": text})
