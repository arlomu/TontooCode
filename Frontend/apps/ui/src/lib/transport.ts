import { DefaultChatTransport, type ChatTransport } from 'ai';
import type { TontooMessage } from '@/types';

/** Backend base URL: explicit build-time config first, local default second. */
export function getBackendUrl(): string | null {
  const fromEnv = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, '');
  return null;
}

/**
 * Real backend transport: streams plain-text replies from POST /api/agent
 * using the UI-message stream protocol. The active model rides along in
 * the request body so the backend knows what to call.
 */
export function createTransport(opts?: { model?: string }): ChatTransport<TontooMessage> {
  const url = getBackendUrl() ?? 'http://127.0.0.1:7027';
  return new DefaultChatTransport<TontooMessage>({
    api: `${url}/api/agent`,
    body: opts?.model ? { model: opts.model } : undefined,
  });
}
