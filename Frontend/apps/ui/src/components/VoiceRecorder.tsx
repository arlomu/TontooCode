import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onConfirm: (seconds: number) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Voice recording view inside the composer.
 *
 * Captures mic audio, draws the live waveform from an AnalyserNode, and
 * reports back the duration on confirm (there is no speech-to-text yet, so
 * the caller inserts a placeholder). X discards, Escape cancels.
 */
export function VoiceRecorder({ onConfirm, onCancel, onError }: VoiceRecorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seconds, setSeconds] = useState(0);
  const stateRef = useRef<{ stream?: MediaStream; ctx?: AudioContext; raf?: number }>({});

  useEffect(() => {
    let dead = false;
    let timer: number | undefined;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (dead) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stateRef.current.stream = stream;

        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) throw new Error('Web Audio unavailable');
        const ctx = new Ctx();
        stateRef.current.ctx = ctx;

        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        src.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const canvas = canvasRef.current;
        const g = canvas?.getContext('2d');

        const signal =
          getComputedStyle(document.documentElement).getPropertyValue('--tt-signal').trim() ||
          '#2547dc';

        const startedAt = Date.now();
        timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 500);

        const draw = () => {
          stateRef.current.raf = requestAnimationFrame(draw);
          if (!canvas || !g) return;
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const w = canvas.clientWidth * dpr;
          const h = canvas.clientHeight * dpr;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          analyser.getByteFrequencyData(data);

          g.clearRect(0, 0, w, h);
          const bars = 56;
          const gap = w / bars;
          const bw = Math.max(2 * dpr, gap * 0.42);
          g.fillStyle = signal;
          for (let i = 0; i < bars; i++) {
            // Lower bins carry speech energy; fold the spectrum for a lively wave.
            const v = (data[Math.floor((i / bars) * data.length * 0.7)] ?? 0) / 255;
            const bh = Math.max(2 * dpr, v * h * 0.92);
            const x = i * gap + (gap - bw) / 2;
            const y = (h - bh) / 2;
            g.beginPath();
            g.roundRect(x, y, bw, bh, bw / 2);
            g.fill();
          }
        };
        draw();
      } catch (err) {
        onError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'microphone blocked — allow access to dictate'
            : 'microphone unavailable',
        );
      }
    })();

    return () => {
      dead = true;
      if (timer !== undefined) window.clearInterval(timer);
      const s = stateRef.current;
      if (s.raf !== undefined) cancelAnimationFrame(s.raf);
      s.stream?.getTracks().forEach((t) => t.stop());
      void s.ctx?.close().catch(() => undefined);
      stateRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div>
      {/* wave + timer */}
      <div className="flex items-center gap-3 px-1 pt-1">
        <span aria-hidden className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tt-err opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-tt-err" />
        </span>
        <canvas ref={canvasRef} className="h-11 min-w-0 flex-1" aria-label="Recording waveform" />
        <span className="font-mono2 shrink-0 text-[13px] text-tt-ink-2 tabular">
          {formatTime(seconds)}
        </span>
      </div>

      {/* actions mirror the composer row: X left, confirm right */}
      <div className="mt-1 flex items-center">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Discard recording"
          title="Discard (Esc)"
          className="flex size-7 items-center justify-center rounded-lg text-tt-ink-3 transition-colors hover:bg-tt-panel hover:text-tt-err"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => onConfirm(seconds)}
            aria-label="Use recording"
            title="Use recording"
            className={cn(
              'flex size-8 items-center justify-center rounded-full bg-tt-ink text-white transition-transform hover:scale-105',
            )}
          >
            <Check size={16} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </div>
  );
}
