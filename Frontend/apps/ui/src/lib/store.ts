import { isToolUIPart } from 'ai';
import type { TontooMessage } from '@/types';

/**
 * Minimal IndexedDB persistence for conversations.
 *
 * No dependency on purpose: the schema is two stores and the access pattern
 * is load-all-meta / load-one / save-one / delete-one. When the Python
 * backend arrives, this becomes a cache in front of the server-side history.
 */

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  toolCount: number;
  projectId: string;
}

export interface Conversation extends ConversationMeta {
  messages: TontooMessage[];
}

export interface Project {
  id: string;
  name: string;
}

export const PROJECTS: Project[] = [
  { id: 'default', name: 'Default' },
  { id: 'example-1', name: 'Example project 1' },
  { id: 'example-2', name: 'Example project 2' },
];

export const DEFAULT_PROJECT_ID = 'default';

const DB_NAME = 'tontoocode';
const DB_VERSION = 1;
const STORE = 'conversations';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexeddb open failed'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => {
          resolve(req.result);
          db.close();
        };
        req.onerror = () => {
          reject(req.error ?? new Error('indexeddb request failed'));
          db.close();
        };
      }),
  );
}

export async function listConversations(): Promise<ConversationMeta[]> {
  const all = await tx<Conversation[]>('readonly', (s) => s.getAll());
  return all
    // Conversations stored before projects existed belong to Default.
    .map(({ messages: _drop, ...meta }) => ({ ...meta, projectId: meta.projectId ?? DEFAULT_PROJECT_ID }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  const found = await tx<Conversation | undefined>('readonly', (s) => s.get(id));
  if (!found) return null;
  return { ...found, projectId: found.projectId ?? DEFAULT_PROJECT_ID };
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await tx('readwrite', (s) => s.put(conv));
}

export async function deleteConversation(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

/** Derives list-view metadata from a full message list. */
export function summarize(id: string, messages: TontooMessage[], projectId: string): Conversation {
  const firstUser = messages.find((m) => m.role === 'user');
  const firstText =
    firstUser?.parts
      .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join(' ')
      .trim() ?? '';
  const toolCount = messages.reduce(
    (n, m) => n + (m.parts?.filter((p) => isToolUIPart(p)).length ?? 0),
    0,
  );
  return {
    id,
    title: firstText ? firstText.slice(0, 48) + (firstText.length > 48 ? '…' : '') : 'New chat',
    updatedAt: Date.now(),
    messageCount: messages.length,
    toolCount,
    projectId,
    messages,
  };
}
