import { useEffect, useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReasoningBlockProps {
  text: string;
  streaming: boolean;
}

/** Collapsible thinking trace. Open while streaming, collapsed after. */
export function ReasoningBlock({ text, streaming }: ReasoningBlockProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(streaming);
  }, [streaming]);

  const words = text.split(/\s+/).filter(Boolean).length;

  return (
    <div className="overflow-hidden rounded-lg border border-tt-thought/25 bg-tt-thought-soft/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <Brain size={13} className="shrink-0 text-tt-thought" strokeWidth={2.2} />
        <span className="font-mono2 text-[11px] tracking-wide text-tt-thought">
          {streaming ? 'thinking…' : `thought · ${words} words`}
        </span>
        <ChevronRight
          size={13}
          className={cn('ml-auto shrink-0 text-tt-ink-3 transition-transform', open && 'rotate-90')}
        />
      </button>
      {open && (
        <div
          className={cn(
            'font-mono2 max-h-56 overflow-y-auto border-t border-tt-thought/15 px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap text-tt-ink-2',
            streaming && 'tt-caret',
          )}
        >
          {text}
        </div>
      )}
    </div>
  );
}
