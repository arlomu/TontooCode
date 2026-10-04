"""Standalone error window shown when the Tontoo Code starter cannot start the app.

Opens as its own top-level window with the failure rendered as selectable,
copyable text, so the user can paste it into a bug report.
"""

from __future__ import annotations

from tkinter import Button, Frame, Label, Scrollbar, Text, Toplevel
from tkinter import font as tkfont

from splash import DISPLAY_FONT, MONO_FONT

WINDOW_WIDTH = 680
WINDOW_HEIGHT = 440
MIN_WIDTH = 460
MIN_HEIGHT = 300
PAD = 28

SURFACE = "#f5f6f8"
CARD = "#ffffff"
ACCENT = "#b3261e"
ACCENT_SOFT = "#fbeae9"
INK = "#14181d"
INK_2 = "#55606d"
INK_3 = "#8a93a0"

HEADING_PX = 21
LABEL_PX = 13
BODY_PX = 13
BUTTON_PX = 13


class ErrorWindow:
    """A normal top-level window presenting one startup failure."""

    def __init__(self, master: Toplevel, heading: str, message: str, hint: str = "") -> None:
        self.master = master
        self.heading = heading
        self.message = message
        self.hint = hint
        self._copy_button: Button | None = None

        self.window = Toplevel(master)
        self.window.title("Tontoo Code - Startup Error")
        self.window.configure(background=SURFACE)
        self.window.resizable(True, True)
        self.window.minsize(MIN_WIDTH, MIN_HEIGHT)
        self.window.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")
        self.window.protocol("WM_DELETE_WINDOW", self.close)
        self.window.bind("<Escape>", lambda _event: self.close())

    def show(self) -> None:
        self._center()
        self._build_header()
        self._build_body()
        self._build_footer()
        self.window.deiconify()
        self.window.attributes("-topmost", True)
        self.window.lift()
        self.window.focus_force()

    def _center(self) -> None:
        screen_w = self.window.winfo_screenwidth()
        screen_h = self.window.winfo_screenheight()
        x = (screen_w - WINDOW_WIDTH) // 2
        y = (screen_h - WINDOW_HEIGHT) // 2
        self.window.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}+{x}+{y}")

    def _build_header(self) -> None:
        row = Frame(self.window, background=SURFACE)
        row.pack(fill="x", padx=PAD, pady=(PAD, 0))

        Label(
            row,
            text="!",
            font=tkfont.Font(family=DISPLAY_FONT, size=-15, weight="bold"),
            background=ACCENT,
            foreground="#ffffff",
            width=2,
        ).pack(side="left")

        labels = Frame(row, background=SURFACE)
        labels.pack(side="left", fill="x", expand=True, padx=(14, 0))

        Label(
            labels,
            text=self.heading,
            font=tkfont.Font(family=DISPLAY_FONT, size=-HEADING_PX, weight="bold"),
            background=SURFACE,
            foreground=ACCENT,
            anchor="w",
        ).pack(fill="x")

        if self.hint:
            Label(
                labels,
                text=self.hint,
                font=tkfont.Font(family=MONO_FONT, size=-LABEL_PX),
                background=SURFACE,
                foreground=INK_3,
                anchor="w",
            ).pack(fill="x", pady=(5, 0))

    def _build_body(self) -> None:
        frame = Frame(self.window, background=SURFACE)
        frame.pack(fill="both", expand=True, padx=PAD, pady=(20, 0))

        text = Text(
            frame,
            wrap="word",
            font=tkfont.Font(family=MONO_FONT, size=-BODY_PX),
            background=CARD,
            foreground=INK,
            relief="solid",
            borderwidth=1,
            highlightthickness=0,
            padx=14,
            pady=12,
            spacing1=2,
            spacing3=4,
            cursor="arrow",
        )
        scrollbar = Scrollbar(frame, orient="vertical", command=text.yview)
        text.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        text.pack(side="left", fill="both", expand=True)

        text.insert("1.0", self.message)
        text.configure(state="disabled")

    def _build_footer(self) -> None:
        row = Frame(self.window, background=SURFACE)
        row.pack(fill="x", side="bottom", padx=PAD, pady=(20, PAD))

        Button(
            row,
            text="Close",
            font=tkfont.Font(family=DISPLAY_FONT, size=-BUTTON_PX, weight="bold"),
            background=ACCENT,
            foreground="#ffffff",
            activebackground="#8f1e18",
            activeforeground="#ffffff",
            relief="flat",
            borderwidth=0,
            padx=22,
            pady=9,
            cursor="hand2",
            command=self.close,
        ).pack(side="right")

        self._copy_button = Button(
            row,
            text="Copy details",
            font=tkfont.Font(family=DISPLAY_FONT, size=-BUTTON_PX),
            background=SURFACE,
            foreground=INK_2,
            activebackground=ACCENT_SOFT,
            activeforeground=ACCENT,
            relief="solid",
            borderwidth=1,
            padx=18,
            pady=8,
            cursor="hand2",
            command=self.copy,
        )
        self._copy_button.pack(side="right", padx=(0, 10))

    def copy(self) -> None:
        self.window.clipboard_clear()
        self.window.clipboard_append(self.message)
        if self._copy_button is not None:
            self._copy_button.configure(text="Copied", foreground=ACCENT)

    def close(self) -> None:
        try:
            self.window.destroy()
        except Exception:
            pass
        self.master.destroy()