"""Tontoo Code starter.

Shows the splash window, immediately spawns backend.exe and frontend.exe from
`%USERPROFILE%\.tontcode\exe` without waiting for them, then closes the window as
soon as the frontend is up. The spawned processes are detached, so they stay
online after this process exits. Any failure is reported in its own error
window.
"""

from __future__ import annotations

from pathlib import Path

import launcher
from error_window import ErrorWindow
from splash import Splash

MIN_VISIBLE_MS = 1_200
POLL_MS = 150


def _launch_failure(error: Exception) -> tuple[str, str, str]:
    return (
        "Tontoo Code could not start",
        f"{error}\n\nLooked in:\n  {launcher.EXE_DIR}",
        "backend.exe and frontend.exe are expected in this folder",
    )


def _process_failure(exe: Path, state: str) -> tuple[str, str, str]:
    code = state.removeprefix("failed (")[:-1]
    return (
        f"{exe.stem} stopped unexpectedly",
        f"{exe.name} exited with code {code} right after it was started.\n\n"
        f"Path:\n  {exe}",
        "The process is no longer running",
    )


def main() -> None:
    splash = Splash()
    splash.build()
    splash.show()
    splash.play_sequence()

    probes: dict[str, launcher.ProcessProbe] = {}
    error_window: ErrorWindow | None = None

    def report(heading: str, message: str, hint: str) -> None:
        nonlocal error_window
        splash.hide()
        error_window = ErrorWindow(splash.root, heading, message, hint)
        error_window.show()

    def launch() -> None:
        try:
            backend, frontend = launcher.start()
        except launcher.LaunchError as error:
            report(*_launch_failure(error))
            return
        probes["backend"] = launcher.ProcessProbe(backend)
        probes["frontend"] = launcher.ProcessProbe(frontend)
        splash.after(MIN_VISIBLE_MS, check)

    def check() -> None:
        if splash.closed or "frontend" not in probes:
            return

        frontend_state = probes["frontend"].poll()
        if frontend_state in (launcher.UP, launcher.HANDED_OFF):
            splash.close()
            return
        if frontend_state != launcher.STARTING:
            report(*_process_failure(launcher.FRONTEND_EXE, frontend_state))
            return

        backend_state = probes["backend"].poll()
        if backend_state.startswith("failed"):
            report(*_process_failure(launcher.BACKEND_EXE, backend_state))
            return

        splash.after(POLL_MS, check)

    splash.after(0, launch)
    splash.mainloop()


if __name__ == "__main__":
    main()