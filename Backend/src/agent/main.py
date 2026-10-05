"""Agent entrypoint: turn a chat request into an SSE byte stream (pydantic-ai).

Runs the full agent graph via ``agent.iter()`` so tool calls never cut
the run short: text streams, tools execute, and the model always gets to
answer afterwards.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, AsyncIterator
from uuid import uuid4

from pydantic_ai import Agent
from pydantic_ai.messages import (
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    ModelMessage,
    ModelRequest,
    ModelResponse,
    PartDeltaEvent,
    TextPart,
    TextPartDelta,
    ToolReturnPart,
    UserPromptPart,
)

from storage import Storage

from .provider import AgentError, build_model
from .stream import _sse, error_chunk
from .systemprompt import working_dir
from .tools import (
    TOOL_TIMEOUT,
    TOOLS_POOL,
    apply_patch as apply_patch_impl,
    edit_file,
    git_tool,
    glob_files,
    grep_files,
    list_directory,
    read_file,
    task_tool,
    write_file,
)
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
    _, project_dir, _ = working_dir(storage, project_id.strip())
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
    agent = build_agent(model_instance, project_dir, storage, instructions=combined)
    return agent, prompt, history


async def _run_tool(name: str, impl, impl_args: tuple) -> str:
    """Run one tool call in the pool (never blocks the event loop)."""
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(TOOLS_POOL, impl, *impl_args),
            timeout=TOOL_TIMEOUT,
        )
    except asyncio.TimeoutError:
        return f"Error: {name} timed out after {TOOL_TIMEOUT}s"


def build_agent(
    model_instance,
    project_dir: str,
    storage: Storage,
    instructions: str | None = None,
) -> Agent:
    """Create the agent with its tools (more plug in here)."""
    agent = Agent(model_instance, instructions=instructions) if instructions else Agent(model_instance)

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
        return await _run_tool(
            "list",
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
        return await _run_tool(
            "read", read_file, (project_dir, path, offset, limit, encoding)
        )

    @agent.tool_plain
    async def glob(pattern: str, path: str = "", max_results: int = 100) -> str:
        """Find files by pattern (supports *, ?, [...] and **).

        `pattern` is required. `path` defaults to the project folder,
        `max_results` caps the listing (default 100).
        """
        return await _run_tool(
            "glob", glob_files, (project_dir, pattern, path, max_results)
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
        return await _run_tool(
            "grep",
            grep_files,
            (project_dir, pattern, path, glob, case_insensitive, max_matches),
        )

    @agent.tool_plain
    async def edit(
        path: str, old_string: str, new_string: str, replace_all: bool = False
    ) -> str:
        """Edit a single file by exact string replacement.

        `path`, `old_string` and `new_string` are required. The match must
        be unique unless `replace_all` is set.
        """
        return await _run_tool(
            "edit",
            edit_file,
            (project_dir, path, old_string, new_string, replace_all),
        )

    @agent.tool_plain
    async def write(path: str, content: str) -> str:
        """Create or overwrite a file (parent folders are created as needed).

        `path` and `content` are required.
        """
        return await _run_tool("write", write_file, (project_dir, path, content))

    @agent.tool_plain
    async def apply_patch(patch: str) -> str:
        """Edit multiple files at once with a unified diff.

        `patch` is required. Supports new files (--- /dev/null) and
        deletions (+++ /dev/null); all hunks must match or nothing changes.
        """
        return await _run_tool(
            "apply_patch", apply_patch_impl, (project_dir, patch)
        )

    @agent.tool_plain
    async def git(
        action: str,
        message: str = "",
        files: list[str] | None = None,
        remote: str = "",
        branch: str = "",
        force: bool = False,
    ) -> str:
        """Run git actions in the project folder.

        `action` is required (status, diff, commit, push, pull, log).
        commit needs a `message`; `files` optionally scope the action;
        push/pull take `remote`/`branch`; push honors `force`.
        """
        return await _run_tool(
            "git",
            git_tool,
            (project_dir, action, message, files, remote, branch, force),
        )

    @agent.tool_plain
    async def task(
        action: str,
        id: int = 0,
        title: str = "",
        status: str = "",
        description: str = "",
    ) -> str:
        """Manage big work steps (not small details, max 5 active).

        `action` is required (create, list, done, cancel). create needs a
        `title`; done/cancel need an `id`; list takes an optional
        `status` filter.
        """
        return await _run_tool(
            "task", task_tool, (storage, action, id, title, status, description)
        )

    return agent


def _tool_input_chunk(tool_call_id: str, tool_name: str, args: Any) -> bytes:
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except json.JSONDecodeError:
            args = {"_raw": args}
    if not isinstance(args, dict):
        args = {"_raw": args}
    return _sse(
        {
            "type": "tool-input-available",
            "toolCallId": tool_call_id,
            "toolName": tool_name,
            "input": args,
        }
    )


def _tool_result_chunk(tool_call_id: str, event: FunctionToolResultEvent) -> bytes:
    content: Any = event.content
    if content is None and isinstance(event.part, ToolReturnPart):
        content = event.part.content
    if isinstance(content, str):
        output: Any = content
    else:
        try:
            output = json.loads(json.dumps(content, default=str))
        except (TypeError, ValueError):
            output = str(content)
    return _sse(
        {"type": "tool-output-available", "toolCallId": tool_call_id, "output": output}
    )


async def stream_run(
    agent: Agent, prompt: str, history: list[ModelMessage]
) -> AsyncIterator[bytes]:
    """Stream the full agent run (text + tool calls) as UI-message chunks."""
    chunks = 0
    chars = 0
    tools = 0
    start = time.monotonic()
    ttft = -1.0
    # One automatic retry for transient provider failures (our tools are
    # read-only, so re-running is safe). Config errors never retry.
    for attempt in (1, 2):
        try:
            async with agent.iter(prompt, message_history=history) as agent_run:
                async for node in agent_run:
                    if agent.is_model_request_node(node):
                        # Fresh text segment per model turn so the frontend
                        # keeps chronological order: tools, text, tools, text.
                        # Reusing one id would merge all text into the first
                        # part and push every tool card to the bottom.
                        segment_id = f"t_{uuid4().hex[:8]}"
                        segment_started = False
                        async with node.stream(agent_run.ctx) as stream:
                            async for event in stream:
                                if not (
                                    isinstance(event, PartDeltaEvent)
                                    and isinstance(event.delta, TextPartDelta)
                                ):
                                    continue
                                delta = event.delta.content_delta
                                if not delta:
                                    continue
                                if not segment_started:
                                    segment_started = True
                                    if ttft < 0:
                                        ttft = time.monotonic() - start
                                    yield _sse({"type": "text-start", "id": segment_id})
                                chunks += 1
                                chars += len(delta)
                                yield _sse(
                                    {"type": "text-delta", "id": segment_id, "delta": delta}
                                )
                        if segment_started:
                            yield _sse({"type": "text-end", "id": segment_id})
                    elif agent.is_call_tools_node(node):
                        async with node.stream(agent_run.ctx) as stream:
                            async for event in stream:
                                if isinstance(event, FunctionToolCallEvent):
                                    part = event.part
                                    yield _tool_input_chunk(
                                        part.tool_call_id, part.tool_name, part.args
                                    )
                                elif isinstance(event, FunctionToolResultEvent):
                                    if not isinstance(event.part, ToolReturnPart):
                                        continue
                                    tools += 1
                                    yield _tool_result_chunk(event.tool_call_id, event)
            break
        except Exception as exc:
            if attempt >= 2 or not _retryable(exc):
                yield error_chunk(f"stream interrupted: {exc}")
                return
            print(f"[tontoo/agent] transient provider error, retrying: {exc}")
    yield _sse({"type": "finish"})
    total = time.monotonic() - start
    print(
        f"[tontoo/agent] deltas={chunks} chars={chars} tools={tools} "
        f"ttft={ttft:.2f}s total={total:.2f}s"
    )


#: Substrings marking transient provider failures worth one retry.
_RETRYABLE = (
    "empty response",
    "429",
    "502",
    "503",
    "529",
    "overloaded",
    "rate limit",
    "temporarily",
    "timeout",
    "timed out",
    "connection",
)


def _retryable(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _RETRYABLE)
