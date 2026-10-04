"""Tontoo Code installer.

Asks for a quick confirmation, then builds `backend.exe`, `frontend.exe` and
`TontooCode.exe`, installs them into `%USERPROFILE%\\.tontcode\\exe` and adds the
Start menu entry that launches the starter.
"""

from __future__ import annotations

import atexit
import io
import queue
import shutil
import tempfile
import threading
from pathlib import Path
from tkinter import Button, Frame, Label, PhotoImage, Scrollbar, Text, Tk
from tkinter import font as tkfont

import installer
from installer import Status

ASSETS_DIR = Path(__file__).resolve().parent / "assets"
ICON_PATH = ASSETS_DIR / "icon.png"

WINDOW_WIDTH = 660
WINDOW_HEIGHT = 580
PAD = 30

ICON_SIZE = 56
WORDMARK_PX = 26
CODE_PX = 14

SURFACE = "#f5f6f8"
CARD = "#ffffff"
INK = "#14181d"
INK_2 = "#55606d"
INK_3 = "#8a93a0"
HAIRLINE = "#d8dde4"
SIGNAL = "#2547dc"
OK = "#0c7a57"
ERR = "#b3261e"
PRIMARY = "#14181d"

DISPLAY_FONT = "Segoe UI, Arial, Helvetica"
MONO_FONT = "Consolas, Cascadia Mono, Courier New"

STATE_COLORS = {"pending": INK_3, "running": SIGNAL, "done": OK, "failed": ERR}
STATE_LABELS = {
    "pending": "waiting",
    "running": "working",
    "done": "done",
    "failed": "failed",
}

POLL_MS = 80


def _icon_photo(master: Tk, size: int):
    if not ICON_PATH.is_file():
        return None
    try:
        from PIL import Image
    except ImportError:
        return None

    with Image.open(ICON_PATH) as image:
        image = image.convert("RGBA")
        image.thumbnail((size, size), Image.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")

    workdir = Path(tempfile.mkdtemp(prefix="tontoo-installer-"))
    atexit.register(shutil.rmtree, workdir, True)
    target = workdir / f"icon-{size}.png"
    target.write_bytes(buffer.getvalue())

    return PhotoImage(master=master, file=str(target))


class InstallerApp:
    def __init__(self) -> None:
        self.statuses: list[Status] = [Status(step.label) for step in installer.steps()]
        self._queue: queue.Queue[tuple[str, int, str] | None] = queue.Queue()
        self._icon = None
        self._step_labels: list[Label] = []
        self._log: Text | None = None
        self._close_button: Button | None = None
        self._summary: Label | None = None
        self._running = False

        self.root = Tk()
        self.root.title("Tontoo Code Installer")
        self.root.configure(background=SURFACE)
        self.root.resizable(False, False)
        self.root.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")

        self._icon = _icon_photo(self.root, ICON_SIZE)
        self._build_confirm()
        self._build_progress()

    def run(self) -> None:
        self.root.mainloop()

    def _wordmark(self, parent: Frame) -> None:
        icon = self._icon
        if icon is not None:
            Label(parent, image=icon, background=SURFACE, borderwidth=0).pack(side="left")

        marks = Frame(parent, background=SURFACE)
        offset = 14 if icon is not None else 0
        marks.pack(side="left", padx=(offset, 0))

        row = Frame(marks, background=SURFACE)
        row.pack(anchor="w")
        Label(
            row,
            text="Tontoo",
            font=tkfont.Font(family=DISPLAY_FONT, size=-WORDMARK_PX, weight="bold"),
            background=SURFACE,
            foreground=INK,
        ).pack(side="left")
        Label(
            row,
            text="CODE",
            font=tkfont.Font(family=MONO_FONT, size=-CODE_PX, weight="bold"),
            background=SURFACE,
            foreground=SIGNAL,
        ).pack(side="left", padx=(8, 0))

    def _build_confirm(self) -> None:
        self.confirm = Frame(self.root, background=SURFACE)
        self.confirm.pack(fill="both", expand=True)

        head = Frame(self.confirm, background=SURFACE)
        head.pack(fill="x", padx=PAD, pady=(PAD, 0))
        self._wordmark(head)

        body = Frame(self.confirm, background=SURFACE)
        body.pack(fill="both", expand=True, padx=PAD, pady=(26, 0))

        Label(
            body,
            text="Install Tontoo Code on this computer?",
            font=tkfont.Font(family=DISPLAY_FONT, size=-19, weight="bold"),
            background=SURFACE,
            foreground=INK,
            anchor="w",
            justify="left",
        ).pack(fill="x")

        Label(
            body,
            text=(
                "This builds three executables and installs them into\n"
                f"{installer.INSTALL_DIR}\n\n"
                "A Start menu entry named TontooCode is added so you can\n"
                "launch the app by searching for it."
            ),
            font=tkfont.Font(family=MONO_FONT, size=-13),
            background=SURFACE,
            foreground=INK_2,
            anchor="w",
            justify="left",
        ).pack(fill="x", pady=(14, 0))

        buttons = Frame(self.confirm, background=SURFACE)
        buttons.pack(fill="x", side="bottom", padx=PAD, pady=(0, PAD))

        Button(
            buttons,
            text="No, cancel",
            font=tkfont.Font(family=DISPLAY_FONT, size=-14),
            background=SURFACE,
            foreground=INK_2,
            activebackground=HAIRLINE,
            relief="solid",
            borderwidth=1,
            padx=20,
            pady=10,
            cursor="hand2",
            command=self.root.destroy,
        ).pack(side="right")

        Button(
            buttons,
            text="Yes, install",
            font=tkfont.Font(family=DISPLAY_FONT, size=-14, weight="bold"),
            background=PRIMARY,
            foreground="#ffffff",
            activebackground="#2b323b",
            activeforeground="#ffffff",
            relief="flat",
            borderwidth=0,
            padx=24,
            pady=11,
            cursor="hand2",
            command=self.start,
        ).pack(side="right", padx=(0, 10))

    def _build_progress(self) -> None:
        self.progress = Frame(self.root, background=SURFACE)

        head = Frame(self.progress, background=SURFACE)
        head.pack(fill="x", padx=PAD, pady=(PAD, 0))
        self._wordmark(head)

        self._summary = Label(
            self.progress,
            text="Installing…",
            font=tkfont.Font(family=DISPLAY_FONT, size=-19, weight="bold"),
            background=SURFACE,
            foreground=INK,
            anchor="w",
        )
        self._summary.pack(fill="x", padx=PAD, pady=(22, 0))

        steps = Frame(self.progress, background=SURFACE)
        steps.pack(fill="x", padx=PAD, pady=(18, 0))
        for status in self.statuses:
            row = Frame(steps, background=SURFACE)
            row.pack(fill="x", pady=3)
            Label(
                row,
                text=status.label,
                font=tkfont.Font(family=DISPLAY_FONT, size=-14),
                background=SURFACE,
                foreground=INK,
                anchor="w",
            ).pack(side="left")
            Label(
                row,
                text=STATE_LABELS[status.state],
                font=tkfont.Font(family=MONO_FONT, size=-12),
                background=SURFACE,
                foreground=STATE_COLORS[status.state],
                anchor="e",
            ).pack(side="right")
            self._step_labels.append(row.winfo_children()[-1])

        log_frame = Frame(self.progress, background=SURFACE)
        log_frame.pack(fill="both", expand=True, padx=PAD, pady=(18, 0))

        self._log = Text(
            log_frame,
            height=9,
            wrap="none",
            font=tkfont.Font(family=MONO_FONT, size=-12),
            background=CARD,
            foreground=INK_2,
            relief="solid",
            borderwidth=1,
            highlightthickness=0,
            padx=12,
            pady=10,
            state="disabled",
        )
        scrollbar = Scrollbar(log_frame, orient="vertical", command=self._log.yview)
        self._log.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        self._log.pack(side="left", fill="both", expand=True)

        footer = Frame(self.progress, background=SURFACE)
        footer.pack(fill="x", side="bottom", padx=PAD, pady=(20, PAD))
        self._close_button = Button(
            footer,
            text="Close",
            state="disabled",
            font=tkfont.Font(family=DISPLAY_FONT, size=-14, weight="bold"),
            background=PRIMARY,
            foreground="#ffffff",
            activebackground="#2b323b",
            relief="flat",
            borderwidth=0,
            padx=26,
            pady=11,
            cursor="hand2",
            command=self.root.destroy,
        )
        self._close_button.pack(side="right")

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self.confirm.destroy()
        self.progress.pack(fill="both", expand=True)
        self.root.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")

        thread = threading.Thread(target=self._worker, daemon=True)
        thread.start()
        self.root.after(POLL_MS, self._drain)

    def _worker(self) -> None:
        try:
            installer.run(self.statuses, self._queue.put)
        finally:
            self._queue.put(None)

    def _drain(self) -> None:
        finished = False
        while True:
            try:
                event = self._queue.get_nowait()
            except queue.Empty:
                break
            if event is None:
                finished = True
                break
            kind, index, text = event
            if kind == "log":
                self._append_log(text)
            elif kind in ("done", "failed") and 0 <= index < len(self._step_labels):
                self._step_labels[index].configure(
                    text=STATE_LABELS[self.statuses[index].state],
                    foreground=STATE_COLORS[self.statuses[index].state],
                )
            elif kind == "finished":
                finished = True

        if finished:
            self._finish()
        else:
            self.root.after(POLL_MS, self._drain)

    def _append_log(self, line: str) -> None:
        if self._log is None or not line:
            return
        self._log.configure(state="normal")
        self._log.insert("end", line + "\n")
        self._log.see("end")
        self._log.configure(state="disabled")

    def _finish(self) -> None:
        failed = next((s for s in self.statuses if s.state == "failed"), None)
        if failed is None:
            if self._summary is not None:
                self._summary.configure(text="Installation complete", foreground=OK)
            self._append_log("")
            self._append_log(f"Installed to {installer.INSTALL_DIR}")
            self._append_log("Search for TontooCode in the Start menu to launch it.")
        else:
            if self._summary is not None:
                self._summary.configure(text="Installation failed", foreground=ERR)
            self._append_log("")
            self._append_log(failed.detail)
        if self._close_button is not None:
            self._close_button.configure(state="normal")


def main() -> None:
    InstallerApp().run()


if __name__ == "__main__":
    main()