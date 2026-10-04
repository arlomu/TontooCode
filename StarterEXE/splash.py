"""Tontoo Code splash screen.

A borderless, taskbar-free window that shows the app wordmark next to the
bundled icon and plays a short startup sequence, then minimizes itself so the
real application window can take over.
"""

from __future__ import annotations

import atexit
import shutil
import tempfile
from pathlib import Path
from tkinter import PhotoImage, Tk, font as tkfont
from tkinter import Canvas

BASE_DIR = Path(__file__).resolve().parent
ASSETS_DIR = BASE_DIR / "assets"
ICON_PATH = ASSETS_DIR / "icon.png"

WINDOW_WIDTH = 540
WINDOW_HEIGHT = 360
MARGIN = 30

ICON_SIZE = 52
WORDMARK_PX = 24
CODE_PX = 13
STATUS_PX = 14
WORDMARK_GAP = 11
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


def _paint_gradient(master, width: int, height: int) -> PhotoImage:
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

    workdir = tempfile.mkdtemp(prefix="tontoo-splash-")
    atexit.register(shutil.rmtree, workdir, True)
    target = Path(workdir) / f"icon-{size}.png"
    target.write_bytes(buffer.getvalue())
    return target


class Splash:
    """Borderless splash window that plays the startup sequence."""

    def __init__(self, width: int = WINDOW_WIDTH, height: int = WINDOW_HEIGHT) -> None:
        self.width = width
        self.height = height
        self._timers: list[str] = []
        self._assets: list[PhotoImage] = []
        self._status_item: int | None = None
        self._closed = False

        self.root = Tk()
        self.root.withdraw()
        self.root.title("Tontoo")
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

        gradient = _paint_gradient(self.root, self.width, self.height)
        self._assets.append(gradient)
        canvas.create_image(0, 0, image=gradient, anchor="nw")

        canvas.create_rectangle(
            0.5, 0.5, self.width - 0.5, self.height - 0.5, outline=HAIRLINE
        )
        self._draw_wordmark(canvas)
        self._status_item = canvas.create_text(
            MARGIN,
            self.height - MARGIN - 9,
            text="",
            font=tkfont.Font(family=MONO_FONT, size=-STATUS_PX),
            fill=STATUS_INK,
            anchor="ls",
        )

    def _draw_wordmark(self, canvas: Canvas) -> None:
        icon_y = MARGIN
        icon_center_y = icon_y + ICON_SIZE / 2

        icon_path = _resized_icon(ICON_PATH, ICON_SIZE) if ICON_PATH.is_file() else None
        if icon_path is not None:
            icon = PhotoImage(master=self.root, file=str(icon_path))
        elif ICON_PATH.is_file():
            icon = PhotoImage(master=self.root, file=str(ICON_PATH))
        else:
            icon = None
        if icon is not None:
            self._assets.append(icon)
            canvas.create_image(MARGIN, icon_y, image=icon, anchor="nw")

        text_x = MARGIN + (ICON_SIZE if icon is not None else 0) + WORDMARK_GAP
        baseline = icon_center_y + 9

        wordmark_font = tkfont.Font(family=DISPLAY_FONT, size=-WORDMARK_PX, weight="bold")
        canvas.create_text(
            text_x, baseline, text="Tontoo", font=wordmark_font, fill=INK, anchor="ls"
        )

        code_font = tkfont.Font(family=MONO_FONT, size=-CODE_PX, weight="bold")
        x = text_x + wordmark_font.measure("Tontoo") + WORDMARK_GAP
        tracking = round(CODE_PX * CODE_TRACKING_EM)
        for char in "CODE":
            canvas.create_text(x, baseline, text=char, font=code_font, fill=SIGNAL, anchor="ls")
            x += code_font.measure(char) + tracking

    def play(self) -> None:
        """Show the window and run the startup sequence."""
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        x = (screen_w - self.width) // 2
        y = (screen_h - self.height) // 2
        self.root.geometry(f"{self.width}x{self.height}+{x}+{y}")
        self.root.deiconify()
        self.root.update_idletasks()
        self.root.lift()

        delay = 0
        for text, duration in STARTUP_SEQUENCE:
            self._timers.append(self.root.after(delay, self._set_status, text))
            delay += duration
        self._timers.append(self.root.after(delay, self.minimize))

    def _set_status(self, text: str) -> None:
        if self._status_item is not None:
            self.root.itemconfigure(self._status_item, text=text)

    def minimize(self) -> None:
        """Minimize out of the way; tool windows have no taskbar button to click."""
        self._clear_timers()
        if self._closed:
            return
        try:
            self.root.iconify()
        except Exception:
            self.root.withdraw()
        else:
            # Override-redirect windows cannot always represent a minimized state.
            self.root.after(200, self._hide_if_still_visible)

    def _hide_if_still_visible(self) -> None:
        if not self._closed and self.root.winfo_viewable():
            self.root.withdraw()

    def restore(self) -> None:
        if self._closed:
            return
        self.root.deiconify()
        self.root.lift()
        self.root.attributes("-topmost", True)

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

    def run(self) -> None:
        self.build()
        self.play()
        self.root.mainloop()


def main() -> None:
    splash = Splash()
    splash.run()


if __name__ == "__main__":
    main()