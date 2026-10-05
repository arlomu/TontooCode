"""Agent package: provider resolution, streaming, persistence."""
from .main import prepare_run, stream_run
from .provider import AgentError, build_model
from .storage import build_title, create_chat
from .stream import error_chunk, iter_ui_chunks
from .systemprompt import build_values, compose, load_parts, substitute

__all__ = [
    "AgentError",
    "build_model",
    "build_title",
    "build_values",
    "compose",
    "create_chat",
    "error_chunk",
    "iter_ui_chunks",
    "load_parts",
    "prepare_run",
    "stream_run",
    "substitute",
]
