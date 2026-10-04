import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Plus, Square } from 'lucide-react';
import type { ChatStatus } from 'ai';
import { cn } from '@/lib/utils';
import {
  DEFAULT_LEVEL,
  ThinkingLevelMenu,
  type ThinkingLevel,
} from '@/components/ThinkingLevelMenu';
import { ModelMenu } from '@/components/ModelMenu';
import { VoiceRecorder } from '@/components/VoiceRecorder';

/** Text grows up to this many lines, then the textarea scrolls. */
const MAX_LINES = 7;
const LINE_HEIGHT = 24;

interface ComposerProps {
  status: ChatStatus;
  model: string;
  onModelChange: (id: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ status, model, onModelChange, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState('');
  const [level, setLevel] = useState<ThinkingLevel>(DEFAULT_LEVEL);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | null>(null);

  const busy = status === 'streaming' || status === 'submitted';
  const canSend = value.trim().length > 0 && !busy;
  const maxHeight = MAX_LINES * LINE_HEIGHT;

  // Auto-grow to MAX_LINES, then keep the box fixed and let it scroll.
  const resize = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxHeight]);

  useLayoutEffect(resize, [value, resize]);

  useEffect(() => {
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, [resize]);

  const flashNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3200);
  };

  const send = () => {
    const text = value.trim();
    if (!text || busy) return;
    setValue('');
    onSend(text);
  };

  /** Inserts text at the cursor and keeps the caret after it. */
  const insertAtCursor = useCallback(
    (text: string) => {
      const el = areaRef.current;
      if (!el) {
        setValue((v) => (v ? `${v}\n${text}` : text));
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      setValue(value.slice(0, start) + text + value.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + text.length;
      });
    },
    [value],
  );

  /**
   * "+" button: native file picker in Electron (real paths), plain file
   * input in the browser (names only — the browser hides real paths).
   * For now the result just lands in the composer as text.
   */
  const pickFiles = useCallback(async () => {
    const bridge = window.tontoo;
    if (bridge?.isElectron && bridge.pickFiles) {
      const paths = await bridge.pickFiles().catch(() => [] as string[]);
      if (paths.length > 0) insertAtCursor(paths.join('\n'));
      return;
    }
    fileRef.current?.click();
  }, [insertAtCursor]);

  return (
    <div className="px-6 pt-2 pb-6">
      <div
        className={cn(
          'mx-auto max-w-[760px] rounded-2xl border bg-tt-card px-4 pt-3.5 pb-2.5 transition-colors',
          'border-tt-hairline shadow-[0_2px_10px_rgb(15_23_42/0.05)] focus-within:border-tt-signal/45',
        )}
      >
        {recording ? (
          <VoiceRecorder
            onConfirm={(seconds) => {
              setRecording(false);
              const m = Math.floor(seconds / 60);
              const s = seconds % 60;
              insertAtCursor(`[voice note · ${m}:${String(s).padStart(2, '0')}]`);
            }}
            onCancel={() => setRecording(false)}
            onError={(message) => {
              setRecording(false);
              flashNotice(message);
            }}
          />
        ) : (
          <>
            <textarea
          ref={areaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message..."
          aria-label="Message"
          className="tt-scrollblock w-full resize-none bg-transparent text-[14.5px] leading-6 text-tt-ink outline-none placeholder:text-tt-ink-3"
        />

        <div className="mt-1 flex items-center gap-1">
          {/* left: attach files */}
          <button
            type="button"
            onClick={() => void pickFiles()}
            aria-label="Attach files"
            title="Attach files"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-tt-ink-3 transition-colors hover:bg-tt-panel hover:text-tt-ink"
          >
            <Plus size={17} strokeWidth={2} />
          </button>
          {/* browser fallback: plain file input (names only, no real paths) */}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const names = [...(e.target.files ?? [])].map((f) => f.name);
              if (names.length > 0) insertAtCursor(names.join('\n'));
              e.target.value = '';
            }}
          />

          <div className="ml-auto flex items-center gap-1.5">
            {/* model */}
            <ModelMenu value={model} onChange={onModelChange} />
            {/* thinking level */}
            <ThinkingLevelMenu value={level} onChange={setLevel} />

            {/* mic → voice mode */}
            <button
              type="button"
              onClick={() => setRecording(true)}
              aria-label="Dictate"
              title="Dictate"
              className="flex size-7 items-center justify-center rounded-lg text-tt-ink-3 transition-colors hover:bg-tt-panel hover:text-tt-ink"
            >
              <Mic size={16} strokeWidth={1.9} />
            </button>

            {notice && (
              <span role="status" className="font-mono2 px-1 text-[11px] text-tt-err">
                {notice}
              </span>
            )}

            {/* send / stop */}
            {busy ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop"
                className="flex size-8 items-center justify-center rounded-full bg-tt-err text-white transition-transform hover:scale-105"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                aria-label="Send"
                className={cn(
                  'flex size-8 items-center justify-center rounded-full transition-all',
                  canSend
                    ? 'bg-tt-ink text-white hover:scale-105'
                    : 'cursor-not-allowed bg-tt-panel text-tt-ink-3',
                )}
              >
                <ArrowUp size={16} strokeWidth={2.6} />
              </button>
            )}
</div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}