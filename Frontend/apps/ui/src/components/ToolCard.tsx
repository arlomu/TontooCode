import { useState } from 'react';
import { AlertTriangle, Check, ChevronRight, CircleDashed, Loader2, Split } from 'lucide-react';
import { cn } from '@/lib/utils';
import { describeToolCall, toolDisplayName, toolStatus, type ToolPart } from '@/lib/tools';
import { Markdown } from './Markdown';

function StatusIcon({ part, className }: { part: ToolPart; className?: string }) {
  const s = toolStatus(part);
  if (s === 'running') return <Loader2 size={13} className={cn('animate-spin text-tt-run', className)} />;
  if (s === 'done') return <Check size={13} className={cn('text-tt-ok', className)} strokeWidth={3} />;
  if (s === 'error') return <AlertTriangle size={13} className={cn('text-tt-err', className)} />;
  return <CircleDashed size={13} className={cn('text-tt-ink-3', className)} />;
}

function pretty(input: unknown): string {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

/** Special card for `delegate_task`: a subagent with its own run. */
function DelegateCard({ part, open }: { part: ToolPart; open: boolean }) {
  const input = (part.input ?? {}) as { agent?: string; task?: string };
  const done = part.state === 'output-available';
  const failed = part.state === 'output-error';
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5">
        <span className="font-mono2 inline-flex items-center gap-1.5 rounded bg-tt-signal-soft px-1.5 py-0.5 text-[11px] font-semibold text-tt-signal">
          <Split size={11} />@{input.agent ?? '?'}
        </span>
        <span className="text-[12px] text-tt-ink-2">{done ? 'returned' : failed ? 'failed' : 'working…'}</span>
      </div>
      <p className="px-3 pt-1.5 text-[13px] leading-relaxed text-tt-ink">{input.task ?? ''}</p>
      {open && done && typeof part.output === 'string' && (
        <div className="mx-3 mt-2 mb-3 rounded-md border border-tt-hairline bg-tt-panel/60 px-2.5 py-2">
          <Markdown text={part.output} className="text-[12.5px]" />
        </div>
      )}
      {open && failed && (
        <p className="mx-3 mt-2 mb-3 rounded-md bg-tt-err-soft px-2.5 py-2 font-mono2 text-[12px] text-tt-err">
          {part.errorText}
        </p>
      )}
    </div>
  );
}

interface ToolCardProps {
  part: ToolPart;
}

export function ToolCard({ part }: ToolCardProps) {
  const status = toolStatus(part);
  const running = status === 'running';
  const [open, setOpen] = useState(running || status === 'error');
  const name = toolDisplayName(part);
  const isDelegate = name === 'delegate_task';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-tt-card',
        status === 'error'
          ? 'border-tt-err/50'
          : running
            ? 'border-tt-run/50'
            : 'border-tt-hairline',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <StatusIcon part={part} />
        <span className="font-mono2 text-[12px] font-semibold text-tt-ink">{name}</span>
        {!isDelegate && (
          <span className="font-mono2 min-w-0 flex-1 truncate text-[11.5px] text-tt-ink-3">
            {describeToolCall(name, part.input)}
          </span>
        )}
        <ChevronRight
          size={13}
          className={cn('ml-auto shrink-0 text-tt-ink-3 transition-transform', open && 'rotate-90')}
        />
      </button>

      {isDelegate ? (
        <DelegateCard part={part} open={open || running} />
      ) : (
        open && (
          <div className="space-y-2 border-t border-tt-hairline px-3 py-2.5">
            <div>
              <div className="font-mono2 pb-1 text-[10px] tracking-widest text-tt-ink-3 uppercase">
                input
              </div>
              <pre className="font-mono2 overflow-x-auto rounded-md bg-tt-panel px-2.5 py-2 text-[12px] leading-relaxed text-tt-ink-2">
                {pretty(part.input)}
              </pre>
            </div>
            {part.state === 'output-available' && (
              <div>
                <div className="font-mono2 pb-1 text-[10px] tracking-widest text-tt-ink-3 uppercase">
                  output
                </div>
                <pre className="font-mono2 max-h-64 overflow-auto rounded-md bg-tt-panel px-2.5 py-2 text-[12px] leading-relaxed whitespace-pre-wrap text-tt-ink">
                  {typeof part.output === 'string' ? part.output : pretty(part.output)}
                </pre>
              </div>
            )}
            {part.state === 'output-error' && (
              <p className="font-mono2 rounded-md bg-tt-err-soft px-2.5 py-2 text-[12px] leading-relaxed text-tt-err">
                {part.errorText}
              </p>
            )}
            {running && (
              <p className="font-mono2 text-[11px] text-tt-run">executing…</p>
            )}
          </div>
        )
      )}
    </div>
  );
}
