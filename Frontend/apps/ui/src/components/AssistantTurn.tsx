import { Fragment } from 'react';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TontooMessage } from '@/types';
import { asToolPart, toolStatus } from '@/lib/tools';
import { ReasoningBlock } from './ReasoningBlock';
import { ToolCard } from './ToolCard';
import { Markdown } from './Markdown';

/** Glyph on the trace spine for one track row. */
function Marker({
  kind,
  tone,
}: {
  kind: 'run' | 'thought' | 'tool' | 'text';
  tone?: 'run' | 'ok' | 'err' | 'dim';
}) {
  if (kind === 'run') {
    return <span className="mt-[7px] block size-[9px] rounded-[2px] bg-tt-signal" aria-hidden />;
  }
  if (kind === 'thought') {
    return (
      <span
        className="mt-[9px] block size-[7px] rounded-full border-[1.5px] border-tt-thought"
        aria-hidden
      />
    );
  }
  if (kind === 'tool') {
    return (
      <span
        aria-hidden
        className={cn(
          'mt-[7px] block size-[9px] rounded-full border-2',
          tone === 'run' && 'tt-beacon border-tt-run bg-tt-run',
          tone === 'ok' && 'border-tt-ok bg-tt-ok',
          tone === 'err' && 'border-tt-err bg-tt-err',
          (!tone || tone === 'dim') && 'border-tt-ink-3',
        )}
      />
    );
  }
  return (
    <span aria-hidden className="font-mono2 mt-[2px] text-[12px] leading-none text-tt-ink-3">
      ›
    </span>
  );
}

interface AssistantTurnProps {
  message: TontooMessage;
  /** True while this turn is the live one being streamed. */
  live: boolean;
  runLabel: string;
}

function partKey(messageId: string, part: TontooMessage['parts'][number], i: number): string {
  const tool = asToolPart(part);
  if (tool) return tool.toolCallId;
  return `${messageId}-${part.type}-${i}`;
}

/**
 * One assistant turn rendered as a process trace: a vertical spine connects
 * the origin marker, thinking blocks, tool cards and answer text — the
 * signature element of the workstation.
 *
 * Marker cell and content cell are sibling grid items, so they always share
 * the same implicit row — alignment is structural, not nudged.
 */
export function AssistantTurn({ message, live, runLabel }: AssistantTurnProps) {
  const parts = message.parts ?? [];
  const lastTextIdx = parts.map((p) => p.type).lastIndexOf('text');

  return (
    <div className="tt-rise flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-tt-hairline bg-tt-card">
        <Bot size={15} className="text-tt-signal" strokeWidth={2.2} />
      </div>

      <div className="relative min-w-0 flex-1">
        {/* the spine — out of flow, so grid placement stays trivial */}
        <div aria-hidden className="absolute top-2 bottom-2 left-[11px] w-px bg-tt-hairline" />

        <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-y-2">
          <div className="flex justify-center">
            <Marker kind="run" />
          </div>
          <div className="font-mono2 truncate pt-[3px] text-[11px] tracking-wide text-tt-ink-3">
            {runLabel}
          </div>

          {parts.map((part, i) => (
            <Fragment key={partKey(message.id, part, i)}>
              <div className="flex justify-center">
                {part.type === 'reasoning' ? (
                  <Marker kind="thought" />
                ) : part.type === 'text' ? (
                  <Marker kind="text" />
                ) : (
                  (() => {
                    const tool = asToolPart(part);
                    if (!tool) return <Marker kind="text" />;
                    const s = toolStatus(tool);
                    return (
                      <Marker
                        kind="tool"
                        tone={s === 'running' ? 'run' : s === 'done' ? 'ok' : s === 'error' ? 'err' : 'dim'}
                      />
                    );
                  })()
                )}
              </div>
              <div className="min-w-0">
                {part.type === 'reasoning' ? (
                  <ReasoningBlock text={part.text} streaming={live} />
                ) : part.type === 'text' ? (
                  part.text ? (
                    <Markdown text={part.text} streaming={live && i === lastTextIdx} />
                  ) : null
                ) : (
                  (() => {
                    const tool = asToolPart(part);
                    return tool ? <ToolCard part={tool} /> : null;
                  })()
                )}
              </div>
            </Fragment>
          ))}

          {parts.length === 0 && live && (
            <Fragment>
              <div className="flex justify-center">
                <Marker kind="thought" />
              </div>
              <p className="font-mono2 tt-caret pt-[2px] text-[12px] text-tt-ink-3">working</p>
            </Fragment>
          )}
        </div>
      </div>
    </div>
  );
}
