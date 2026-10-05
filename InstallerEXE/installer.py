"""Installs the pre-built Tontoo Code executables.

The installer carries `payload.zip` with `backend.exe`, `frontend.exe` and
`TontooCode.exe` and only unpacks them into `%USERPROFILE%\\.tontcode\\exe`.
Nothing is compiled while installing — run `build_installer.py` to produce the
payload and freeze this installer into a single executable.
"""

from __future__ import annotations

import shutil
import sys
import zipfile
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from shortcut import install_shortcut

INSTALL_DIR = Path.home() / ".tontcode" / "exe"
PAYLOAD_SUBDIR = "payload"
PAYLOAD_NAME = "payload.zip"
EXECUTABLES = ("backend.exe", "frontend.exe", "TontooCode.exe")
STARTER_EXE = "TontooCode.exe"

Emit = Callable[[str, int, str], None]


class InstallError(RuntimeError):
    """The installation could not be completed."""


def resource_dir() -> Path:
    """Where bundled resources live — the PyInstaller temp dir when frozen."""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parent


def payload_path() -> Path:
    return resource_dir() / PAYLOAD_SUBDIR / PAYLOAD_NAME


@dataclass
class Status:
    label: str
    state: str = "pending"
    detail: str = ""


@dataclass(frozen=True)
class Step:
    label: str
    action: Callable[[Emit], None]


def _human(size: int) -> str:
    return f"{size / (1024 * 1024):.1f} MB"


def _verify(emit: Emit) -> None:
    payload = payload_path()
    if not payload.is_file():
        raise InstallError(
            f"Installation package not found:\n  {payload}\n\n"
            "Run build_installer.py to create it."
        )
    with zipfile.ZipFile(payload) as archive:
        names = set(archive.namelist())
        missing = [name for name in EXECUTABLES if name not in names]
        if missing:
            raise InstallError("Installation package is incomplete:\n  " + "\n  ".join(missing))
        total = sum(info.file_size for info in archive.infolist())
    emit("log", -1, f"Package: {payload}")
    emit("log", -1, f"{len(EXECUTABLES)} executables, {_human(total)}")


def _extract(emit: Emit) -> None:
    payload = payload_path()
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(payload) as archive:
        for name in EXECUTABLES:
            target = INSTALL_DIR / name
            _release(target)
            with archive.open(name) as source, target.open("wb") as destination:
                shutil.copyfileobj(source, destination, length=1024 * 1024)
            emit("log", -1, f"{name:<16} {_human(target.stat().st_size)}")
    emit("log", -1, f"Installed to {INSTALL_DIR}")


def _release(target: Path) -> None:
    """Replace a target that is still running, so reinstalling works."""
    if not target.exists():
        return
    try:
        target.unlink()
    except PermissionError as error:
        raise InstallError(
            f"Cannot replace {target.name} because it is still running.\n"
            "Close Tontoo Code and run the installer again."
        ) from error


def _add_shortcut(emit: Emit) -> None:
    link = install_shortcut(
        target=INSTALL_DIR / STARTER_EXE,
        icon=INSTALL_DIR / STARTER_EXE,
        working_dir=INSTALL_DIR,
    )
    emit("log", -1, f"Start menu entry: {link}")


def steps() -> list[Step]:
    return [
        Step("Reading the installation package", _verify),
        Step("Extracting the application files", _extract),
        Step("Adding the Start menu entry", _add_shortcut),
    ]


def run(statuses: list[Status], emit: Emit) -> None:
    """Run every step, reporting progress through `emit`."""
    for index, step in enumerate(steps()):
        statuses[index].state = "running"
        emit("step", index, step.label)
        try:
            step.action(emit)
        except Exception as error:  # noqa: BLE001 - reported verbatim to the user
            statuses[index].state = "failed"
            statuses[index].detail = str(error)
            emit("failed", index, str(error))
            return
        statuses[index].state = "done"
        emit("done", index, step.label)
    emit("finished", -1, "")


def run_cli() -> int:
    """Headless entry point: `python -m installer`."""
    statuses = [Status(step.label) for step in steps()]

    def emit(kind: str, index: int, text: str) -> None:
        if kind == "step":
            print(f"==> {text}")
        elif kind == "done":
            print(f"    ok: {text}")
        elif kind == "failed":
            print(f"    FAILED: {text}")
        elif kind == "log" and text:
            print(f"    | {text}")

    run(statuses, emit)
    if any(status.state == "failed" for status in statuses):
        return 1
    print(f"\nInstalled to {INSTALL_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run_cli())