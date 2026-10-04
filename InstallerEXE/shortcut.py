"""Creates the Windows Start menu entry that launches the Tontoo Code starter."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

APP_NAME = "TontooCode"
DESCRIPTION = "Start Tontoo Code"

CREATE_NO_WINDOW = 0x08000000


def programs_dir() -> Path:
    appdata = os.environ.get("APPDATA")
    if not appdata:
        raise RuntimeError("APPDATA is not set")
    return Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs"


def shortcut_path() -> Path:
    return programs_dir() / f"{APP_NAME}.lnk"


def _quote(value: str) -> str:
    return value.replace('"', '""')


def install_shortcut(target: Path, icon: Path, working_dir: Path) -> Path:
    """Write a .lnk for `target` into the per-user Start menu."""
    if not target.is_file():
        raise FileNotFoundError(f"Starter executable not found: {target}")

    link = shortcut_path()
    link.parent.mkdir(parents=True, exist_ok=True)

    script = "\n".join(
        [
            "$ErrorActionPreference = 'Stop'",
            "$shell = New-Object -ComObject WScript.Shell",
            f"$link = $shell.CreateShortcut('{_quote(str(link))}')",
            f"$link.TargetPath = '{_quote(str(target))}'",
            f"$link.WorkingDirectory = '{_quote(str(working_dir))}'",
            f"$link.IconLocation = '{_quote(str(icon))}'",
            f"$link.Description = '{DESCRIPTION}'",
            "$link.Save()",
        ]
    )

    result = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
        capture_output=True,
        text=True,
        creationflags=CREATE_NO_WINDOW,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Could not create the Start menu entry:\n{result.stderr.strip()}")
    if not link.is_file():
        raise RuntimeError(f"Start menu entry was not written: {link}")
    return link