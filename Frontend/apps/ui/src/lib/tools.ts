import { getToolName, isToolUIPart } from 'ai';
import type { TontooMessage } from '@/types';

export type ToolPart = Extract<
  TontooMessage['parts'][number],
  { type: `tool-${string}` } | { type: 'dynamic-tool' }
>;

export function asToolPart(part: TontooMessage['parts'][number]): ToolPart | null {
  return isToolUIPart(part) ? (part as ToolPart) : null;
}

export type ToolStatus = 'running' | 'approval' | 'done' | 'error' | 'denied';

export function toolStatus(part: ToolPart): ToolStatus {
  switch (part.state) {
    case 'input-streaming':
    case 'input-available':
      return 'running';
    case 'approval-requested':
    case 'approval-responded':
      return 'approval';
    case 'output-available':
      return 'done';
    case 'output-error':
      return 'error';
    case 'output-denied':
      return 'denied';
  }
}

export function toolDisplayName(part: ToolPart): string {
  return getToolName(part);
}

/** One-line human summary of a tool call, used in the trace and card headers. */
export function describeToolCall(name: string, input: unknown): string {
  const rec = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  switch (name) {
    case 'read_file':
      return str(rec.path) || '…';
    case 'grep':
      return `${str(rec.pattern) ? `“${str(rec.pattern)}”` : '…'}${str(rec.path) ? ` in ${str(rec.path)}` : ''}`;
    case 'run_terminal':
      return str(rec.command) || '…';
    case 'web_search':
      return str(rec.query) || '…';
    case 'delegate_task':
      return `@${str(rec.agent) || '?'} — ${str(rec.task).slice(0, 60)}${str(rec.task).length > 60 ? '…' : ''}`;
    default: {
      try {
        const json = JSON.stringify(input);
        return json.length > 72 ? `${json.slice(0, 72)}…` : json;
      } catch {
        return '…';
      }
    }
  }
}

/** Total elapsed "work" marker text for a finished tool: input length → output length. */
export function toolSizeLine(part: ToolPart): string | null {
  if (part.state !== 'output-available' && part.state !== 'output-error') return null;
  if (part.state === 'output-error') return part.errorText.split('\n')[0]?.slice(0, 90) ?? null;
  const out = typeof part.output === 'string' ? part.output : JSON.stringify(part.output ?? '');
  const lines = out.split('\n').length;
  return `${out.length} chars · ${lines} lines`;
}
