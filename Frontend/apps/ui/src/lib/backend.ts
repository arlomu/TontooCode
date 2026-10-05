import { getBackendUrl } from './transport';

/** Backend base URL: explicit config first, local default second. */
export function backendUrl(): string {
  return getBackendUrl() ?? 'http://127.0.0.1:7027';
}

export class BackendOfflineError extends Error {
  constructor() {
    super('backend unreachable');
    this.name = 'BackendOfflineError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${backendUrl()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new BackendOfflineError();
  }
  if (!res.ok) {
    if (res.status >= 500) throw new BackendOfflineError();
    const detail = await res
      .json()
      .then((b) => (b as { detail?: string }).detail ?? res.statusText)
      .catch(() => res.statusText);
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface BackendProvider {
  id: string;
  name: string;
  has_key: boolean;
  base_url: string;
  created_at: string;
  updated_at: string;
}

export interface BackendProject {
  id: string;
  name: string;
  main_folder: string;
  subfolders: string[];
  created_at: string;
  updated_at: string;
}

export interface BackendChat {
  id: number;
  name: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

export interface CatalogProvider {
  id: string;
  name: string;
  model_count: number;
}

export interface CatalogModels {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

export const backend = {
  health: () => request<{ status: string }>('/api/health'),
  getSettings: () => request<Record<string, unknown>>('/api/settings'),
  putSettings: (patch: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  listProviders: () => request<BackendProvider[]>('/api/providers'),
  listProjects: () => request<BackendProject[]>('/api/projects'),
  createProject: (name: string, main_folder: string, subfolders: string[]) =>
    request<BackendProject>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, main_folder, subfolders }),
    }),
  updateProject: (
    id: string,
    patch: { name?: string; main_folder?: string; subfolders?: string[] },
  ) =>
    request<BackendProject>(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteProject: (id: string) =>
    request<void>(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createChat: (name: string, project_id: string) =>
    request<BackendChat>('/api/chat/create', {
      method: 'POST',
      body: JSON.stringify({ name, project_id }),
    }),
  addProvider: (name: string, api_key: string, base_url = '') =>
    request<BackendProvider>('/api/providers', {
      method: 'POST',
      body: JSON.stringify({ name, api_key, base_url }),
    }),
  deleteProvider: (id: string) =>
    request<void>(`/api/providers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  catalogProviders: (q = '') =>
    request<CatalogProvider[]>(`/api/catalog/providers?q=${encodeURIComponent(q)}`),
  catalogModels: (id: string) =>
    request<CatalogModels>(`/api/catalog/providers/${encodeURIComponent(id)}`),
};
