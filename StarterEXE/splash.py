"""Tontoo Code splash window.

A borderless, taskbar-free window that shows the app wordmark next to the
bundled icon plus a status line in the bottom-left corner. The window itself
holds no process logic; see `launcher.py` and `main.py`.
"""

from __future__ import annotations

import atexit
import shutil
import sys
import tempfile
from collections.abc import Callable
from pathlib import Path
from tkinter import Canvas, PhotoImage, Tk
from tkinter import font as tkfont


def _base_dir() -> Path:
    """Where bundled assets live — the PyInstaller temp dir when frozen."""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parent


ASSETS_DIR = _base_dir() / "assets"
ICON_PATH = ASSETS_DIR / "icon.png"

WINDOW_WIDTH = 560
WINDOW_HEIGHT = 360
MARGIN = 30

ICON_SIZE = 84
WORDMARK_PX = 42
CODE_PX = 22
STATUS_PX = 20
WORDMARK_GAP = 14
CODE_TRACKING_EM = 0.16

GRADIENT_TOP = (0x24, 0x28, 0x2E)
GRADIENT_BOTTOM = (0xDD, 0xE1, 0xE7)
GRADIENT_DIAGONAL = 0.4

INK = "#e9ebf0"
SIGNAL = "#647dff"
STATUS_INK = "#4b5563"
HAIRLINE = "#c6ccd4"

DISPLAY_FONT = "Segoe UI, Arial, Helvetica"
MONO_FONT = "Consolas, Cascadia Mono, Courier New"

STARTUP_SEQUENCE: tuple[tuple[str, int], ...] = (
    ("Starting...", 1_000),
    ("Starting Backend...", 3_000),
    ("Starting Frontend...", 2_000),
)


def _blend(start: tuple[int, int, int], end: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        round(start[0] + (end[0] - start[0]) * t),
        round(start[1] + (end[1] - start[1]) * t),
        round(start[2] + (end[2] - start[2]) * t),
    )


_GRADIENT_STEPS = 256
_GRADIENT_COLORS = [
    "#%02x%02x%02x" % _blend(GRADIENT_TOP, GRADIENT_BOTTOM, i / (_GRADIENT_STEPS - 1))
    for i in range(_GRADIENT_STEPS)
]


def _gradient_row(width: int, height: int, y: int) -> str:
    """Build one horizontal band of the diagonal gradient as a Tk color list."""
    top = _GRADIENT_STEPS - 1
    span = GRADIENT_DIAGONAL * top
    base = y / (height - 1) * top
    columns = (width - 1) or 1
    indices = bytes(min(int(base + x / columns * span), top) for x in range(width))
    return "{" + " ".join([_GRADIENT_COLORS[i] for i in indices]) + "}"


def _paint_gradient(master: Tk, width: int, height: int) -> PhotoImage:
    """Render the dark-to-light gradient into a PhotoImage, band by band."""
    photo = PhotoImage(master=master, width=width, height=height)
    for y in range(height):
        photo.put(_gradient_row(width, height, y), to=(0, y, width, y + 1))
    return photo


def _resized_icon(path: Path, size: int) -> Path | None:
    """Downscale the icon to `size` px and write it to a temp file for Tk."""
    try:
        import io

        from PIL import Image
    except ImportError:
        return None

    with Image.open(path) as image:
        image = image.convert("RGBA")
        image.thumbnail((size, size), Image.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")

    workdir = Path(tempfile.mkdtemp(prefix="tontoo-splash-"))
    atexit.register(shutil.rmtree, workdir, True)
    target = workdir / f"icon-{size}.png"
    target.write_bytes(buffer.getvalue())
    return target


class Splash:
    """Borderless splash window with a wordmark and a status line."""

    def __init__(self, width: int = WINDOW_WIDTH, height: int = WINDOW_HEIGHT) -> None:
        self.width = width
        self.height = height
        self._timers: list[str] = []
        self._assets: list[PhotoImage] = []
        self._canvas: Canvas | None = None
        self._status_item: int | None = None
        self._closed = False

        self.root = Tk()
        self.root.withdraw()
        self.root.title("Tontoo Code")
        self.root.overrideredirect(True)
        self.root.attributes("-toolwindow", True)
        self.root.attributes("-topmost", True)
        self.root.bind("<Escape>", lambda _event: self.destroy())

    def build(self) -> None:
        canvas = Canvas(
            self.root,
            width=self.width,
            height=self.height,
            highlightthickness=0,
            borderwidth=0,
            background=HAIRLINE,
        )
        canvas.pack(fill="both", expand=True)
        self._canvas = canvas

        gradient = _paint_gradient(self.root, self.width, self.height)
        self._assets.append(gradient)
        canvas.create_image(0, 0, image=gradient, anchor="nw")

        canvas.create_rectangle(
            0.5, 0.5, self.width - 0.5, self.height - 0.5, outline=HAIRLINE
        )
        self._draw_wordmark(canvas)

        self._status_item = canvas.create_text(
            MARGIN,
            self.height - MARGIN + 5,
            text="",
            font=tkfont.Font(family=MONO_FONT, size=-STATUS_PX),
            fill=STATUS_INK,
            anchor="sw",
        )

    def _draw_wordmark(self, canvas: Canvas) -> None:
        icon_center_y = MARGIN + ICON_SIZE / 2

        icon_path = _resized_icon(ICON_PATH, ICON_SIZE) if ICON_PATH.is_file() else None
        icon = None
        if icon_path is not None:
            icon = PhotoImage(master=self.root, file=str(icon_path))
        elif ICON_PATH.is_file():
            icon = PhotoImage(master=self.root, file=str(ICON_PATH))
        if icon is not None:
            self._assets.append(icon)
            canvas.create_image(MARGIN, MARGIN, image=icon, anchor="nw")

        text_x = MARGIN + (ICON_SIZE if icon is not None else 0) + WORDMARK_GAP

        wordmark_font = tkfont.Font(family=DISPLAY_FONT, size=-WORDMARK_PX, weight="bold")
        line_bottom = icon_center_y + wordmark_font.metrics("linespace") / 2
        canvas.create_text(
            text_x, line_bottom, text="Tontoo", font=wordmark_font, fill=INK, anchor="sw"
        )

        code_font = tkfont.Font(family=MONO_FONT, size=-CODE_PX, weight="bold")
        x = text_x + wordmark_font.measure("Tontoo") + WORDMARK_GAP
        tracking = round(CODE_PX * CODE_TRACKING_EM)
        for char in "CODE":
            canvas.create_text(x, line_bottom, text=char, font=code_font, fill=SIGNAL, anchor="sw")
            x += code_font.measure(char) + tracking

    def show(self) -> None:
        """Center the window on the primary screen and map it without decorations."""
        x = (self.root.winfo_screenwidth() - self.width) // 2
        y = (self.root.winfo_screenheight() - self.height) // 2
        self.root.geometry(f"{self.width}x{self.height}+{x}+{y}")
        self.root.deiconify()
        self.root.update_idletasks()
        self.root.lift()

    def play_sequence(self, on_done: Callable[[], None] | None = None) -> None:
        """Walk the startup status texts. The last one stays until told otherwise."""
        self.set_status(STARTUP_SEQUENCE[0][0])
        delay = 0
        for text, duration in STARTUP_SEQUENCE:
            delay += duration
            self.after(delay, self.set_status, text)
        if on_done is not None:
            self.after(delay, on_done)

    def set_status(self, text: str) -> None:
        if self._canvas is not None and self._status_item is not None:
            self._canvas.itemconfigure(self._status_item, text=text)

    def hide(self) -> None:
        """Withdraw the splash without tearing down the root, so a Toplevel
        error window can take over."""
        self._clear_timers()
        if not self._closed:
            self.root.withdraw()

    def after(self, delay_ms: int, func: Callable[..., None], *args: object) -> str:
        timer = self.root.after(delay_ms, func, *args)
        self._timers.append(timer)
        return timer

    def close(self) -> None:
        """Tear the window down; spawned processes are detached and keep running."""
        self.destroy()

    def destroy(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._clear_timers()
        try:
            self.root.destroy()
        except Exception:
            pass

    def _clear_timers(self) -> None:
        for timer in self._timers:
            try:
                self.root.after_cancel(timer)
            except Exception:
                pass
        self._timers.clear()

    def mainloop(self) -> None:
        self.root.mainloop()

    @property
    def closed(self) -> bool:
        return self._closed