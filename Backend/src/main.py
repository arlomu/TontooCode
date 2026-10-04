"""Tontoo backend entrypoint.

Starts the FastAPI web server on 127.0.0.1. Default port is 7027
(7=T, 0=O, 2=N, 7=T = TONT — 70270 does not fit into the TCP port
range 0-65535, so the trailing O had to go).

Usage:
    python src/main.py [--port 7027] [--db PATH] [--reload]
"""
from __future__ import annotations

import argparse
import os
import sys

# Allow `python src/main.py` direct runs: resolve sibling modules.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn  # noqa: E402

from storage import Storage, default_db_path  # noqa: E402
from webserver import create_app  # noqa: E402

DEFAULT_PORT = 7027


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tontoo Python backend")
    parser.add_argument(
        "--port", type=int, default=int(os.getenv("TONTOO_BACKEND_PORT", DEFAULT_PORT)),
        help=f"TCP port (default {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--db", type=str, default=os.getenv("TONTOO_SETTINGS_DB", ""),
        help="SQLite path (default ~/.tontcode/db/settings.db)",
    )
    parser.add_argument(
        "--reload", action="store_true",
        help="Auto-reload on code changes (dev only)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    db_path = args.db or None
    storage = Storage(db_path)  # type: ignore[arg-type]
    print(f"[tontoo] settings db: {storage.path}")
    print(f"[tontoo] default db:  {default_db_path()}")
    app = create_app(storage)
    uvicorn.run(app, host="127.0.0.1", port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
