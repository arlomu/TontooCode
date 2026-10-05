import { DefaultChatTransport, type ChatTransport } from 'ai';
import type { TontooMessage } from '@/types';

const STORAGE_KEY = 'tontoo:backend-url';

/** Explicit backend URL from env (build time) or localStorage (runtime). */
export function getBackendUrl(): string | null {
  const fromEnv = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, '');
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim().replace(/\/$/, '');
  } catch {
    /* storage unavailable */
  }
  return null;
}

export function setBackendUrl(url: string | null): void {
  try {
    if (url && url.trim()) localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ''));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export type BackendMode = 'mock' | 'http';

export function backendMode(): BackendMode {
  return getBackendUrl() ? 'http' : 'mock';
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
