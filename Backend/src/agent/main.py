"""Agent entrypoint: turn a chat request into an SSE byte stream (pydantic-ai)."""
from __future__ import annotations

import time
from typing import Any, AsyncIterator

from pydantic_ai import Agent
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    UserPromptPart,
)

from storage import Storage

from .provider import AgentError, build_model
from .stream import iter_ui_chunks
from .systemprompt import compose as compose_system_prompt


def flatten_transcript(messages: list[Any]) -> list[dict[str, str]]:
    """Flatten UI messages (parts with text) into plain role/content turns."""
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


def split_history(
    transcript: list[dict[str, str]],
) -> tuple[str | None, list[ModelMessage], str]:
    """Split a transcript into system instructions, history and the prompt."""
    instructions = (
        "\n\n".join(t["content"] for t in transcript if t["role"] == "system") or None
    )
    convo = [t for t in transcript if t["role"] in ("user", "assistant")]
    user_idx = [i for i, t in enumerate(convo) if t["role"] == "user"]
    if not user_idx:
        raise AgentError(400, "no message text to send")
    prompt = convo[user_idx[-1]]["content"]
    history: list[ModelMessage] = []
    for turn in convo[: user_idx[-1]]:
        if turn["role"] == "user":
            history.append(ModelRequest(parts=[UserPromptPart(content=turn["content"])]))
        else:
            history.append(ModelResponse(parts=[TextPart(content=turn["content"])]))
    return instructions, history, prompt


def prepare_run(
    storage: Storage,
    model: str,
    messages: list[Any],
    chat_id: str = "",
    project_id: str = "",
) -> tuple[Agent, str, list[ModelMessage]]:
    """Build the agent, prompt and history eagerly (raises before streaming)."""
    model_name = (model or "").strip()
    model_instance = build_model(storage, model_name)
    instructions, history, prompt = split_history(flatten_transcript(messages or []))
    repo_prompt = compose_system_prompt(
        storage, model=model_name, chat_id=chat_id, project_id=project_id
    )
    combined: str | None = None
    if repo_prompt.strip() and instructions:
        combined = repo_prompt + "\n\n" + instructions
    elif repo_prompt.strip():
        combined = repo_prompt
    elif instructions:
        combined = instructions
    agent = Agent(model_instance, instructions=combined) if combined else Agent(model_instance)
    return agent, prompt, history


async def _deltas(
    agent: Agent, prompt: str, history: list[ModelMessage]
) -> AsyncIterator[str]:
    # debounce_by=None: forward provider chunks untouched (no 100ms grouping).
    start = time.monotonic()
    chunks = 0
    chars = 0
    ttft = -1.0
    try:
        async with agent.run_stream(prompt, message_history=history) as result:
            async for text in result.stream_text(delta=True, debounce_by=None):
                if chunks == 0:
                    ttft = time.monotonic() - start
                chunks += 1
                chars += len(text)
                yield text
    finally:
        total = time.monotonic() - start
        print(
            f"[tontoo/agent] deltas={chunks} chars={chars} "
            f"ttft={ttft:.2f}s total={total:.2f}s"
        )


async def stream_run(
    agent: Agent, prompt: str, history: list[ModelMessage]
) -> AsyncIterator[bytes]:
    """Stream the agent reply as UI-message SSE chunks."""
    async for chunk in iter_ui_chunks(_deltas(agent, prompt, history)):
        yield chunk
