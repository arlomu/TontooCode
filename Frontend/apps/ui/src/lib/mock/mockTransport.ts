import type { ChatTransport, UIMessageChunk } from 'ai';
import type { TontooMessage } from '@/types';
import { pickScenario, type MockStep } from './scripts';

type SendOptions = Parameters<ChatTransport<TontooMessage>['sendMessages']>[0];

/**
 * A compiled emission: chunk to send (or `null` for a pure beat of silence,
 * e.g. while a tool "executes"), then pause this long before the next.
 */
interface Emission {
  chunk: UIMessageChunk | null;
  pauseMs: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Splits text into word-ish slices that feel like live token streaming
 * without shredding markdown syntax mid-token.
 */
function sliceText(text: string): string[] {
  const words = text.split(/(\s+)/);
  const out: string[] = [];
  let buf = '';
  for (const w of words) {
    buf += w;
    if (buf.length >= 14 || /[.!?]\s$/.test(buf)) {
      out.push(buf);
      buf = '';
    }
  }
  if (buf) out.push(buf);
  return out;
}

function lastUserText(messages: TontooMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'user' || !m.parts) continue;
    const text = m.parts
      .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('\n');
    if (text.trim()) return text;
  }
  return '';
}

/** Compiles scenario steps into a timed chunk sequence. */
function compile(steps: MockStep[]): Emission[] {
  const out: Emission[] = [];
  let textIdx = 0;
  let reasoningIdx = 0;
  let callIdx = 0;

  for (const step of steps) {
    if (step.kind === 'reasoning') {
      const id = `rsn-${reasoningIdx++}`;
      out.push({ chunk: { type: 'reasoning-start', id }, pauseMs: rand(80, 160) });
      for (const slice of sliceText(step.text)) {
        out.push({ chunk: { type: 'reasoning-delta', id, delta: slice }, pauseMs: rand(8, 22) });
      }
      out.push({ chunk: { type: 'reasoning-end', id }, pauseMs: rand(200, 400) });
    } else if (step.kind === 'tool') {
      const toolCallId = `call-${callIdx++}`;
      const inputJson = JSON.stringify(step.input, null, 2);
      out.push({
        chunk: { type: 'tool-input-start', toolCallId, toolName: step.name },
        pauseMs: rand(120, 220),
      });
      // Stream the input JSON in slices so the card shows "input-streaming".
      for (let i = 0; i < inputJson.length; i += 18) {
        out.push({
          chunk: { type: 'tool-input-delta', toolCallId, inputTextDelta: inputJson.slice(i, i + 18) },
          pauseMs: rand(10, 26),
        });
      }
      out.push({
        chunk: { type: 'tool-input-available', toolCallId, toolName: step.name, input: step.input },
        pauseMs: rand(60, 120),
      });
      // Simulated execution beat — the card shows the running state here.
      const [lo, hi] = step.runMs ?? [700, 1300];
      out.push({ chunk: null, pauseMs: rand(lo, hi) });
      if (step.error !== undefined) {
        out.push({
          chunk: { type: 'tool-output-error', toolCallId, errorText: step.error },
          pauseMs: rand(150, 300),
        });
      } else {
        out.push({
          chunk: { type: 'tool-output-available', toolCallId, output: step.output ?? '' },
          pauseMs: rand(150, 300),
        });
      }
    } else {
      const id = `txt-${textIdx++}`;
      out.push({ chunk: { type: 'text-start', id }, pauseMs: rand(60, 140) });
      for (const slice of sliceText(step.markdown)) {
        out.push({ chunk: { type: 'text-delta', id, delta: slice }, pauseMs: rand(12, 30) });
      }
      out.push({ chunk: { type: 'text-end', id }, pauseMs: rand(100, 200) });
    }
  }

  out.push({ chunk: { type: 'finish' }, pauseMs: 0 });
  return out;
}

/**
 * In-process stand-in for the Python backend.
 *
 * Implements the same `ChatTransport` contract the real HTTP transport will
 * use, so switching backends later is a one-line factory change — the UI
 * never knows the difference.
 */
export class MockChatTransport implements ChatTransport<TontooMessage> {
  async sendMessages(options: SendOptions): Promise<ReadableStream<UIMessageChunk>> {
    const { messages, abortSignal } = options;
    const scenario = pickScenario(lastUserText(messages));
    const emissions = compile(scenario.steps);

    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        const push = (chunk: UIMessageChunk) => {
          try {
            controller.enqueue(chunk);
          } catch {
            /* reader is gone — stop quietly */
          }
        };
        try {
          // Small "thinking" beat before the first chunk, like a real backend.
          await sleep(rand(350, 700), abortSignal);
          for (const e of emissions) {
            if (abortSignal?.aborted) break;
            if (e.chunk) push(e.chunk);
            if (e.pauseMs > 0) await sleep(e.pauseMs, abortSignal);
          }
        } catch {
          /* aborted mid-stream — partial message stays, like a real stop */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      },
    });
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    // Nothing durable to resume in mock mode.
    return null;
  }
}
