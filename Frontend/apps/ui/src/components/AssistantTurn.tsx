import type { TontooMessage } from '@/types';
import { asToolPart } from '@/lib/tools';
import { ToolCard } from './ToolCard';
import { Markdown } from './Markdown';

interface AssistantTurnProps {
  message: TontooMessage;
  /** True while this turn is the live one being streamed. */
  live: boolean;
}

/**
 * One assistant turn, deliberately plain: answer text full-width, tool
 * cards inline when tools ran. Reasoning parts are never rendered — while
 * the first visible content is still on its way, a quiet indicator holds
 * the turn's place.
 */
export function AssistantTurn({ message, live }: AssistantTurnProps) {
  const parts = message.parts ?? [];
  const lastTextIdx = parts.map((p) => p.type).lastIndexOf('text');
  const hasVisible = parts.some(
    (p) => (p.type === 'text' && p.text) || asToolPart(p) !== null,
  );

  return (
    <div className="tt-rise min-w-0 space-y-2.5">
      {live && !hasVisible && (
        <p className="font-mono2 tt-caret text-[12px] text-tt-ink-3">thinking</p>
      )}
      {parts.map((part, i) => {
        if (part.type === 'text') {
          if (!part.text) return null;
          return (
            <Markdown
              key={`${message.id}-t${i}`}
              text={part.text}
              streaming={live && i === lastTextIdx}
            />
          );
        }
        const tool = asToolPart(part);
        if (tool) return <ToolCard key={tool.toolCallId} part={tool} />;
        return null;
      })}
    </div>
  );
}
