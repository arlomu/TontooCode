"""Builds everything Tontoo Code needs, then freezes the installer.

Run this once from the repository root:

    python InstallerEXE/build_installer.py

It builds `backend.exe`, `frontend.exe` and `TontooCode.exe`, packs them into
`InstallerEXE/payload/payload.zip`, and freezes
`InstallerEXE/dist/TontooCodeSetup.exe` around that payload. Installing then only
extracts files.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
BACKEND_DIR = REPO_ROOT / "Backend"
FRONTEND_DIR = REPO_ROOT / "Frontend"
DESKTOP_DIR = FRONTEND_DIR / "apps" / "desktop"
STARTER_DIR = REPO_ROOT / "StarterEXE"
ICON = FRONTEND_DIR / "assets" / "icon.png"

PAYLOAD_DIR = HERE / "payload"
PAYLOAD_ZIP = PAYLOAD_DIR / "payload.zip"
DIST_DIR = HERE / "dist"
WORK_DIR = HERE / "build"

INSTALLER_NAME = "TontooCodeSetup"
PAYLOAD_MEMBERS = (
    BACKEND_DIR / "dist" / "backend.exe",
    DESKTOP_DIR / "dist" / "frontend.exe",
    STARTER_DIR / "dist" / "TontooCode.exe",
)

CREATE_NO_WINDOW = 0x08000000


def _tool(name: str) -> str:
    """Resolve a command to a runnable path (pnpm is a .cmd shim on Windows)."""
    resolved = shutil.which(name)
    if resolved is None:
        raise SystemExit(f"Required tool not found on PATH: {name}")
    return resolved


def _run(argv: list[str], cwd: Path) -> None:
    argv = [_tool(argv[0]), *argv[1:]]
    print(f"==> {' '.join(argv[:4])} {'…' if len(argv) > 4 else ''}")
    result = subprocess.run(argv, cwd=str(cwd))
    if result.returncode != 0:
        raise SystemExit(f"Failed ({result.returncode}): {' '.join(argv)}")


def _pyinstaller(name: str, entry: Path, source_dir: Path, extra: list[str]) -> None:
    _run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--onefile",
            "--windowed",
            "--name",
            name,
            "--icon",
            str(ICON),
            "--paths",
            str(source_dir),
            "--distpath",
            str(source_dir.parent / "dist"),
            "--workpath",
            str(source_dir.parent / "build"),
            "--specpath",
            str(source_dir.parent),
            *extra,
            str(entry),
        ],
        REPO_ROOT,
    )


def build_executables() -> None:
    print("--- building executables ---")
    _run(["pnpm", "install"], FRONTEND_DIR)
    _run(["pnpm", "build"], FRONTEND_DIR)
    _run(["pnpm", "build"], DESKTOP_DIR)
    _pyinstaller("backend", BACKEND_DIR / "src" / "main.py", BACKEND_DIR / "src", [])
    _pyinstaller(
        "TontooCode",
        STARTER_DIR / "main.py",
        STARTER_DIR,
        [
            "--add-data",
            f"{STARTER_DIR / 'assets' / 'icon.png'};assets",
            "--hidden-import",
            "PIL.Image",
        ],
    )


def build_payload() -> None:
    print("--- packing payload ---")
    missing = [str(path) for path in PAYLOAD_MEMBERS if not path.is_file()]
    if missing:
        raise SystemExit("Missing build output:\n  " + "\n  ".join(missing))

    if PAYLOAD_DIR.exists():
        shutil.rmtree(PAYLOAD_DIR)
    PAYLOAD_DIR.mkdir(parents=True)

    # ZIP_STORED: the executables are already packed, so deflating them again
    # only burns CPU. PyInstaller compresses the payload once while freezing.
    with zipfile.ZipFile(PAYLOAD_ZIP, "w", compression=zipfile.ZIP_STORED) as archive:
        for path in PAYLOAD_MEMBERS:
            archive.write(path, arcname=path.name)
            print(f"    {path.name:<16} {path.stat().st_size / (1024 * 1024):.1f} MB")
    print(f"    -> {PAYLOAD_ZIP}")


def freeze_installer() -> None:
    print("--- freezing installer ---")
    _run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--onefile",
            "--windowed",
            "--name",
            INSTALLER_NAME,
            "--icon",
            str(HERE / "assets" / "icon.png"),
            "--add-data",
            f"{PAYLOAD_ZIP};.",
            "--hidden-import",
            "PIL.Image",
            "--distpath",
            str(DIST_DIR),
            "--workpath",
            str(WORK_DIR),
            "--specpath",
            str(WORK_DIR),
            str(HERE / "main.py"),
        ],
        HERE,
    )
    print(f"    -> {DIST_DIR / (INSTALLER_NAME + '.exe')}")


def main() -> int:
    build_executables()
    build_payload()
    freeze_installer()
    print(f"\nInstaller ready: {DIST_DIR / (INSTALLER_NAME + '.exe')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())