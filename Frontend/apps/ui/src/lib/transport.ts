import { DefaultChatTransport, type ChatTransport } from 'ai';
import type { TontooMessage } from '@/types';
import { MockChatTransport } from './mock/mockTransport';

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
 * One-line switch between the in-process mock and the real Python backend.
 * Both speak the Vercel AI UI-message stream protocol, so the UI is
 * identical either way.
 */
export function createTransport(): ChatTransport<TontooMessage> {
  const url = getBackendUrl();
  if (url) return new DefaultChatTransport<TontooMessage>({ api: `${url}/api/chat` });
  return new MockChatTransport();
}
