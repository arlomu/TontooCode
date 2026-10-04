import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ThinkingLevel = (typeof LEVELS)[number];

export const DEFAULT_LEVEL: ThinkingLevel = 'medium';

interface LevelMeta {
  id: ThinkingLevel;
  label: string;
  hint: string;
  /** The tube fill gradient — an intensity ramp from slate to fuchsia. */
  gradient: string;
  dot: string;
}

export const LEVEL_META: Record<ThinkingLevel, LevelMeta> = {
  low: {
    id: 'low',
    label: 'Low',
    hint: 'Fastest, minimal reasoning',
    gradient: 'linear-gradient(100deg,#9CA3AF,#6B7280)',
    dot: '#6B7280',
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    hint: 'Balanced default',
    gradient: 'linear-gradient(100deg,#4a6ef0,#2547dc)',
    dot: '#2547DC',
  },
  high: {
    id: 'high',
    label: 'High',
    hint: 'Deeper planning, slower',
    gradient: 'linear-gradient(100deg,#FACC15,#CA8A04)',
    dot: '#CA8A04',
  },
  xhigh: {
    id: 'xhigh',
    label: 'Xhigh',
    hint: 'Exhaustive reasoning',
    gradient: 'linear-gradient(100deg,#F87171,#DC2626)',
    dot: '#DC2626',
  },
  max: {
    id: 'max',
    label: 'Max',
    hint: 'Slowest, maximum depth',
    gradient: 'linear-gradient(100deg,#4ADE80,#16A34A)',
    dot: '#16A34A',
  },
};

/** Small dense particles drifting inside the tube fill. */
const TUBE_PARTICLES = [
  { x: 11, delay: 0.2, dur: 3.1, size: 1.5 },
  { x: 24, delay: 1.6, dur: 3.9, size: 1 },
  { x: 37, delay: 0.9, dur: 3.4, size: 2 },
  { x: 52, delay: 2.3, dur: 4.2, size: 1 },
  { x: 63, delay: 1.2, dur: 3.6, size: 1.5 },
  { x: 78, delay: 2.8, dur: 3.2, size: 1 },
  { x: 89, delay: 0.5, dur: 3.8, size: 1.5 },
];

/**
 * The tube slider: a thin track with the level gradient filling up to the
 * thumb, tick dots marking the five stops on the empty stretch, and slow
 * particles drifting inside the fill.
 */
function LevelSlider({
  value,
  onChange,
}: {
  value: ThinkingLevel;
  onChange: (level: ThinkingLevel) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const timerRef = useRef<number | null>(null);
  const meta = LEVEL_META[value];
  // Thumb (26px) rides centered on the track and stays fully inside:
  // it travels from 13px to W-13px, and the fill ends at its center.
  const ratio = LEVELS.indexOf(value) / (LEVELS.length - 1);
  const pos = `calc(13px + (100% - 26px) * ${ratio})`;
  const ease = '320ms cubic-bezier(.2,.9,.3,1)';

  // Live mirror so the sweep below always starts from the real level,
  // even if several changes queue up.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const clearSweep = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const reducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /**
   * Sweep through every intermediate stop on the way to the target, so a
   * low → max jump cascades instead of teleporting. ~90ms per stop.
   */
  const animateTo = (target: ThinkingLevel) => {
    clearSweep();
    if (reducedMotion()) {
      onChange(target);
      return;
    }
    const step = () => {
      const cur = LEVELS.indexOf(valueRef.current);
      const dest = LEVELS.indexOf(target);
      if (cur === dest) {
        timerRef.current = null;
        return;
      }
      onChange(LEVELS[cur + (cur < dest ? 1 : -1)]!);
      timerRef.current = window.setTimeout(step, 90);
    };
    step();
  };

  const levelFromClientX = (clientX: number): ThinkingLevel => {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const idx = Math.round(ratio * (LEVELS.length - 1));
    return LEVELS[idx]!;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    // A click sweeps; the following moves (if any) scrub directly.
    animateTo(levelFromClientX(e.clientX));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    clearSweep();
    onChange(levelFromClientX(e.clientX));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Thinking level"
      aria-valuemin={1}
      aria-valuemax={LEVELS.length}
      aria-valuenow={LEVELS.indexOf(value) + 1}
      aria-valuetext={meta.label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            animateTo(LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(value) + 1)]!);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            animateTo(LEVELS[Math.max(0, LEVELS.indexOf(value) - 1)]!);
          } else if (e.key === 'Home') {
            e.preventDefault();
            animateTo(LEVELS[0]!);
          } else if (e.key === 'End') {
            e.preventDefault();
            animateTo(LEVELS[LEVELS.length - 1]!);
          }
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="tt-nodrag relative h-[15px] w-full cursor-ew-resize touch-none rounded-full bg-tt-panel transition-colors duration-150 select-none hover:bg-tt-hairline/70"
      >
      {/* stop ticks — visible only on the empty stretch */}
      <div aria-hidden className="absolute inset-x-[13px] top-1/2 flex -translate-y-1/2 justify-between">
        {LEVELS.map((id) => (
          <span key={id} className="size-[3px] rounded-full bg-tt-ink-3/60" />
        ))}
      </div>

{/* filled portion — ends exactly at the thumb center.
          All five gradients stay stacked so the color cross-fades. */}
        <div
          className="absolute inset-y-0 left-0 overflow-hidden rounded-full"
          style={{ width: pos, transition: dragging ? 'none' : `width ${ease}` }}
        >
          {LEVELS.map((id) => (
            <div
              key={id}
              aria-hidden
              className="absolute inset-0 transition-opacity duration-300 ease-out"
              style={{ background: LEVEL_META[id].gradient, opacity: id === value ? 1 : 0 }}
            />
          ))}
        {TUBE_PARTICLES.map((p, i) => (
          <span
            key={i}
            aria-hidden
            className="tt-particle absolute bottom-[-4px] rounded-full bg-white"
            style={
              {
                left: `${p.x}%`,
                width: `${p.size}px`,
                height: `${p.size * 2.2}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.dur}s`,
                '--tt-travel': '20px',
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* thumb: plain white disc riding on top of the track.
          Scale lives in the inline transform — a Tailwind scale class would
          lose against it, so hover/drag feed the same expression. */}
        <span
          aria-hidden
          className="absolute top-1/2 size-[26px] rounded-full bg-white shadow-[0_1px_5px_rgb(15_23_42/0.4)]"
          style={{
            left: pos,
            transform: `translate(-50%, -50%) scale(${dragging || hovering ? 1.12 : 1})`,
            transition: dragging
              ? 'none'
              : `left ${ease}, transform 160ms ease-out`,
          }}
        />
    </div>
  );
}

interface ThinkingLevelMenuProps {
  value: ThinkingLevel;
  onChange: (level: ThinkingLevel) => void;
}

/**
 * Thinking level control — the whole panel is one compact widget:
 * colored name + reset, one hint line, the tube. Nothing is listed twice.
 */
export function ThinkingLevelMenu({ value, onChange }: ThinkingLevelMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const meta = LEVEL_META[value];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      {/* trigger — color lives in the menu only */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Thinking level"
        className={cn(
          'rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors',
          open ? 'bg-tt-panel text-tt-ink' : 'text-tt-ink-2 hover:bg-tt-panel',
        )}
      >
        {meta.label}
      </button>

      {open && (
        <div
          role="menu"
          className="tt-rise absolute right-0 bottom-[calc(100%+8px)] z-50 w-[248px] rounded-xl border border-tt-hairline bg-tt-card px-4 pt-3 pb-3.5 shadow-[0_12px_40px_rgb(15_23_42/0.16)]"
        >
          <div className="flex items-center justify-between">
            <p key={value} className="tt-swap text-[15px] leading-tight font-semibold" style={{ color: meta.dot }}>
              {meta.label}
            </p>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_LEVEL)}
              disabled={value === DEFAULT_LEVEL}
              title="Reset to Medium"
              aria-label="Reset to Medium"
              className="rounded-full p-1 text-tt-ink-3 transition-colors hover:bg-tt-panel hover:text-tt-ink disabled:cursor-default disabled:opacity-40"
            >
              <RotateCcw size={14} strokeWidth={2.1} />
            </button>
          </div>
          <p key={`hint-${value}`} className="tt-swap mt-0.5 text-[11.5px] leading-tight text-tt-ink-3">{meta.hint}</p>
          <div className="mt-2.5">
            <LevelSlider value={value} onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  );
}