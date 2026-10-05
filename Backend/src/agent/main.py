"""Agent entrypoint: turn a chat request into an SSE byte stream (pydantic-ai)."""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, AsyncIterator
from uuid import uuid4

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
from .stream import _sse, error_chunk
from .tools import TOOL_TIMEOUT, TOOLS_POOL, glob_files, grep_files, list_directory, read_file
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
) -> tuple[Agent, str, list[ModelMessage], asyncio.Queue]:
    """Build the agent, prompt, history and status queue eagerly."""
    model_name = (model or "").strip()
    model_instance = build_model(storage, model_name)
    project = storage.get_project(project_id) if project_id else None
    project_dir = project["main_folder"] if project else ""
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
    status_queue: asyncio.Queue = asyncio.Queue()
    agent = build_agent(model_instance, project_dir, status_queue, instructions=combined)
    return agent, prompt, history, status_queue


def build_agent(
    model_instance,
    project_dir: str,
    status_queue: asyncio.Queue,
    instructions: str | None = None,
) -> Agent:
    """Create the agent with its tools (more plug in here)."""
    agent = Agent(model_instance, instructions=instructions) if instructions else Agent(model_instance)

    async def _run_tool(name: str, args: dict[str, Any], impl, impl_args: tuple) -> str:
        """Run one tool call in the pool, streaming input/output status."""
        call_id = f"call-{uuid4().hex[:8]}"
        status_queue.put_nowait(("input", call_id, name, args))
        loop = asyncio.get_running_loop()
        try:
            result = await asyncio.wait_for(
                loop.run_in_executor(TOOLS_POOL, impl, *impl_args),
                timeout=TOOL_TIMEOUT,
            )
        except asyncio.TimeoutError:
            result = f"Error: {name} timed out after {TOOL_TIMEOUT}s"
        error = result.startswith("Error:")
        status_queue.put_nowait(("output", call_id, result, error))
        return result

    @agent.tool_plain
    async def list(  # noqa: A003 — the tool is literally named `list` (TOOLS.md)
        path: str = "",
        recursive: bool = False,
        include_hidden: bool = False,
        max_depth: int = 0,
        hide_folders: bool = False,
    ) -> str:
        """Show folders and files in a directory (max 250 results).

        `path` defaults to the project folder. Set `recursive` to descend,
        `max_depth` to limit levels (0 = unlimited), `include_hidden` for
        dotfiles, `hide_folders` to list files only.
        """
        args = {
            "path": path,
            "recursive": recursive,
            "include_hidden": include_hidden,
            "max_depth": max_depth,
            "hide_folders": hide_folders,
        }
        return await _run_tool(
            "list",
            args,
            list_directory,
            (project_dir, path, recursive, include_hidden, max_depth, hide_folders),
        )

    @agent.tool_plain
    async def read(
        path: str, offset: int = 0, limit: int = 100, encoding: str = "utf8"
    ) -> str:
        """Return file content, sliced by line range.

        `path` is required. `offset` starts at line 0, `limit` caps the
        lines (default 100), `encoding` defaults to utf8.
        """
        args = {"path": path, "offset": offset, "limit": limit, "encoding": encoding}
        return await _run_tool(
            "read", args, read_file, (project_dir, path, offset, limit, encoding)
        )

    @agent.tool_plain
    async def glob(pattern: str, path: str = "", max_results: int = 100) -> str:
        """Find files by pattern (supports *, ?, [...] and **).

        `pattern` is required. `path` defaults to the project folder,
        `max_results` caps the listing (default 100).
        """
        args = {"pattern": pattern, "path": path, "max_results": max_results}
        return await _run_tool(
            "glob", args, glob_files, (project_dir, pattern, path, max_results)
        )

    @agent.tool_plain
    async def grep(
        pattern: str,
        path: str = "",
        glob: str = ".",
        case_insensitive: bool = False,
        max_matches: int = 150,
    ) -> str:
        """Return matching lines with file paths (regex over file content).

        `pattern` is required. `path` defaults to the project folder,
        `glob` filters files ("." means all), `case_insensitive` toggles
        case, `max_matches` caps output (default 150).
        """
        args = {
            "pattern": pattern,
            "path": path,
            "glob": glob,
            "case_insensitive": case_insensitive,
            "max_matches": max_matches,
        }
        return await _run_tool(
            "grep",
            args,
            grep_files,
            (project_dir, pattern, path, glob, case_insensitive, max_matches),
        )

    return agent


def _tool_chunks(event: tuple) -> list[bytes]:
    """Translate a tool status event into UI-message chunks."""
    kind = event[0]
    if kind == "input":
        _, call_id, name, args = event
        return [
            _sse(
                {
                    "type": "tool-input-available",
                    "toolCallId": call_id,
                    "toolName": name,
                    "input": args,
                }
            )
        ]
    _, call_id, result, is_error = event
    if is_error:
        return [
            _sse(
                {
                    "type": "tool-output-error",
                    "toolCallId": call_id,
                    "errorText": result,
                }
            )
        ]
    return [
        _sse(
            {"type": "tool-output-available", "toolCallId": call_id, "output": result}
        )
    ]


async def _merged(
    agent: Agent, prompt: str, history: list[ModelMessage], status_queue: asyncio.Queue
) -> AsyncIterator[bytes]:
    """Interleave text deltas and tool status events into UI chunks.

    Queued tool events always win over waiting: causality (input before
    output, tool status before later text) is preserved.
    """
    text_id = f"t_{uuid4().hex[:8]}"
    started = False
    chunks = 0
    chars = 0
    tools = 0
    start = time.monotonic()
    ttft = -1.0
    waiter: asyncio.Task | None = None
    try:
        async with agent.run_stream(prompt, message_history=history) as result:
            text_iter = result.stream_text(delta=True, debounce_by=None).__aiter__()
            pending: asyncio.Task = asyncio.ensure_future(text_iter.__anext__())
            try:
                while True:
                    while True:
                        try:
                            event = status_queue.get_nowait()
                        except asyncio.QueueEmpty:
                            break
                        if event[0] == "output":
                            tools += 1
                        for chunk in _tool_chunks(event):
                            yield chunk
                    if pending.done():
                        try:
                            delta = pending.result()
                        except StopAsyncIteration:
                            break
                        if delta:
                            if not started:
                                started = True
                                ttft = time.monotonic() - start
                                yield _sse({"type": "text-start", "id": text_id})
                            chunks += 1
                            chars += len(delta)
                            yield _sse(
                                {"type": "text-delta", "id": text_id, "delta": delta}
                            )
                        pending = asyncio.ensure_future(text_iter.__anext__())
                        continue
                    waiter = asyncio.ensure_future(status_queue.get())
                    done, _ = await asyncio.wait(
                        {pending, waiter}, return_when=asyncio.FIRST_COMPLETED
                    )
                    if waiter in done:
                        event = waiter.result()
                        waiter = None
                        if event[0] == "output":
                            tools += 1
                        for chunk in _tool_chunks(event):
                            yield chunk
                    if waiter is not None and not waiter.done():
                        waiter.cancel()
                        waiter = None
            finally:
                if not pending.done():
                    pending.cancel()
                if waiter is not None and not waiter.done():
                    waiter.cancel()
    except Exception as exc:
        yield error_chunk(f"stream interrupted: {exc}")
        return
    if started:
        yield _sse({"type": "text-end", "id": text_id})
    yield _sse({"type": "finish"})
    total = time.monotonic() - start
    print(
        f"[tontoo/agent] deltas={chunks} chars={chars} tools={tools} "
        f"ttft={ttft:.2f}s total={total:.2f}s"
    )


async def stream_run(
    agent: Agent,
    prompt: str,
    history: list[ModelMessage],
    status_queue: asyncio.Queue,
) -> AsyncIterator[bytes]:
    """Stream the agent reply (text + tool calls) as UI-message SSE chunks."""
    async for chunk in _merged(agent, prompt, history, status_queue):
        yield chunk
