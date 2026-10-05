"""Agent package: provider resolution, streaming, persistence."""
from .main import build_agent, prepare_run, stream_run
from .provider import AgentError, build_model
from .storage import build_title, create_chat
from .stream import error_chunk
from .systemprompt import build_values, compose, load_parts, substitute

__all__ = [
    "AgentError",
    "build_agent",
    "build_model",
    "build_title",
    "build_values",
    "compose",
    "create_chat",
    "error_chunk",
    "load_parts",
    "prepare_run",
    "stream_run",
    "substitute",
]
