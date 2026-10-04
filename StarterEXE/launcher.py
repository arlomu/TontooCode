"""Starts and supervises the Tontoo Code backend and frontend executables.

Both executables are spawned detached so they outlive the splash window, and
neither start is awaited — the splash only needs to know when the frontend came
up, which `ProcessProbe` reports without blocking.
"""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

EXE_DIR = Path(os.environ.get("TONTOO_EXE_DIR") or (Path.home() / ".tontcode" / "exe"))
BACKEND_EXE = EXE_DIR / "backend.exe"
FRONTEND_EXE = EXE_DIR / "frontend.exe"

DETACHED_PROCESS = 0x00000008
CREATE_NEW_PROCESS_GROUP = 0x00000200
DETACHED = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP

SETTLE_SECONDS = 0.5

STARTING = "starting"
UP = "up"
HANDED_OFF = "handed-off"


class LaunchError(RuntimeError):
    """A required executable is missing or could not be spawned."""


def _spawn(exe: Path) -> subprocess.Popen:
    if not exe.is_file():
        raise LaunchError(f"Not found: {exe}")
    try:
        return subprocess.Popen(
            [str(exe)],
            cwd=str(exe.parent),
            creationflags=DETACHED,
            close_fds=True,
        )
    except OSError as error:
        raise LaunchError(f"Could not start {exe.name}: {error}") from error


def start() -> tuple[subprocess.Popen, subprocess.Popen]:
    """Spawn backend.exe and frontend.exe without waiting for either."""
    backend = _spawn(BACKEND_EXE)
    frontend = _spawn(FRONTEND_EXE)
    return backend, frontend


class ProcessProbe:
    """Non-blocking liveness probe for a spawned process."""

    def __init__(self, process: subprocess.Popen, settle: float = SETTLE_SECONDS) -> None:
        self.process = process
        self.settle = settle
        self._alive_since: float | None = None

    def poll(self) -> str:
        """Return `STARTING`, `UP`, `HANDED_OFF`, or `failed (<exit code>)`."""
        code = self.process.poll()
        if code is not None:
            # A clean exit right after spawn means the exe handed off elsewhere.
            return HANDED_OFF if code == 0 else f"failed ({code})"
        now = time.monotonic()
        if self._alive_since is None:
            self._alive_since = now
        elif now - self._alive_since >= self.settle:
            return UP
        return STARTING