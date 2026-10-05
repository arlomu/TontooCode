import { useEffect, useRef, useState } from 'react';
import { KeyRound, Plus, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  backend,
  BackendOfflineError,
  type BackendProvider,
  type CatalogProvider,
} from '@/lib/backend';

export interface ProvidersState {
  providers: BackendProvider[];
  online: boolean;
}

export interface ProvidersProps {
  value: ProvidersState;
  onChange: (state: ProvidersState) => void;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `prov-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function AddDialog({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, apiKey: string, baseUrl: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<CatalogProvider[] | null>(null);
  const [selected, setSelected] = useState<CatalogProvider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setFailed(false);
    try {
      setCatalog(await backend.catalogProviders());
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    void load();
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCreate = selected !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add provider"
        className="tt-rise w-full max-w-[420px] rounded-xl bg-tt-card shadow-[0_24px_80px_rgb(15_23_42/0.25)]"
      >
        <div className="flex items-center justify-between border-b border-tt-hairline px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-tt-ink">Add provider</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-tt-ink-3 transition-colors hover:bg-tt-panel hover:text-tt-ink"
          >
            <X size={16} strokeWidth={2.1} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {/* provider picker: all models.dev providers with search */}
          <div>
            <p className="font-mono2 text-[10px] font-semibold tracking-[0.14em] text-tt-ink-3 uppercase">
              Provider
            </p>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-tt-hairline bg-tt-card px-3 py-2">
              <Search size={14} className="shrink-0 text-tt-ink-3" strokeWidth={2.1} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search providers"
                aria-label="Search providers"
                className="w-full bg-transparent text-[13px] text-tt-ink outline-none placeholder:text-tt-ink-3"
              />
            </div>
            <div className="tt-scrollblock mt-1.5 max-h-[220px] overflow-y-auto overscroll-contain rounded-lg border border-tt-hairline p-1.5">
              {catalog === null && !failed && (
                <p className="font-mono2 tt-caret px-2.5 py-3 text-[11.5px] text-tt-ink-3">
                  loading providers
                </p>
              )}
              {failed && (
                <div className="px-2.5 py-3 text-center">
                  <p className="font-mono2 text-[11.5px] text-tt-err">
                    catalog unavailable — is the backend running?
                  </p>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="font-mono2 mt-2 rounded-md border border-tt-hairline px-2.5 py-1 text-[11px] text-tt-ink-2 transition-colors hover:border-tt-signal/50 hover:text-tt-signal"
                  >
                    retry
                  </button>
                </div>
              )}
              {catalog !== null &&
                catalog
                  .filter((p) => {
                    const q = query.trim().toLowerCase();
                    return !q || p.name.toLowerCase().includes(q) || p.id.includes(q);
                  })
                  .map((p) => {
                    const isSelected = selected?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => setSelected(isSelected ? null : p)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                          isSelected ? 'bg-tt-panel' : 'hover:bg-tt-panel/70',
                        )}
                      >
                        <span
                          className={cn(
                            'flex-1 truncate text-[13px]',
                            isSelected ? 'font-semibold text-tt-ink' : 'text-tt-ink-2',
                          )}
                        >
                          {p.name}
                        </span>
                        <span className="font-mono2 shrink-0 text-[10.5px] text-tt-ink-3 tabular">
                          {p.model_count}
                        </span>
                      </button>
                    );
                  })}
              {catalog !== null &&
                catalog.filter((p) => {
                  const q = query.trim().toLowerCase();
                  return !q || p.name.toLowerCase().includes(q) || p.id.includes(q);
                }).length === 0 && (
                  <p className="font-mono2 px-2.5 py-3 text-center text-[11.5px] text-tt-ink-3">
                    no provider matches “{query.trim()}”
                  </p>
                )}
            </div>
          </div>
          <div>
            <p className="font-mono2 text-[10px] font-semibold tracking-[0.14em] text-tt-ink-3 uppercase">
              API key <span className="normal-case tracking-normal">(optional)</span>
            </p>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              aria-label="API key (optional)"
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="font-mono2 mt-1.5 w-full rounded-lg border border-tt-hairline bg-tt-card px-3 py-2 text-[13px] text-tt-ink outline-none placeholder:text-tt-ink-3 focus:border-tt-signal/50"
            />
            <p className="mt-1.5 text-[12px] leading-relaxed text-tt-ink-3">
              Stored in the local backend database only, never sent anywhere else.
            </p>
          </div>
          <div>
            <p className="font-mono2 text-[10px] font-semibold tracking-[0.14em] text-tt-ink-3 uppercase">
              Base URL <span className="normal-case tracking-normal">(optional)</span>
            </p>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              aria-label="Base URL (optional)"
              autoComplete="off"
              spellCheck={false}
              className="font-mono2 mt-1.5 w-full rounded-lg border border-tt-hairline bg-tt-card px-3 py-2 text-[13px] text-tt-ink outline-none placeholder:text-tt-ink-3 focus:border-tt-signal/50"
            />
            <p className="mt-1.5 text-[12px] leading-relaxed text-tt-ink-3">
              Only needed when the backend does not know this provider&apos;s endpoint.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-tt-hairline px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-tt-hairline bg-tt-card px-4 py-1.5 text-[13px] font-medium text-tt-ink transition-colors hover:border-tt-ink-3"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => selected && onCreate(selected.name, apiKey, baseUrl.trim())}
            className={cn(
              'rounded-lg px-4 py-1.5 text-[13px] font-medium text-tt-ink-invert transition-all',
              canCreate ? 'bg-tt-ink hover:scale-[1.03]' : 'cursor-not-allowed bg-tt-ink-3/60',
            )}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Providers settings. Names list below, Add Provider dialog with optional
 * API key. Persists in the backend; session-only fallback while offline.
 */
export function ProvidersTab({ value, onChange }: ProvidersProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Load once from the backend; stay session-only when offline.
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    backend
      .listProviders()
      .then((providers) => onChange({ providers, online: true }))
      .catch((err) => {
        if (err instanceof BackendOfflineError) onChange({ providers: [], online: false });
        else setError(err instanceof Error ? err.message : 'failed to load providers');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (name: string, apiKey: string, baseUrl: string) => {
    setShowAdd(false);
    setError(null);
    if (value.online) {
      try {
        const created = await backend.addProvider(name, apiKey, baseUrl);
        onChange({ providers: [...value.providers, created], online: true });
        return;
      } catch (err) {
        if (!(err instanceof BackendOfflineError)) {
          setError(err instanceof Error ? err.message : 'failed to add provider');
          return;
        }
        onChange({ ...value, online: false });
      }
    }
    // Offline fallback: session-only entry.
    onChange({
      providers: [...value.providers, { id: newId(), name, has_key: apiKey.length > 0, base_url: baseUrl, created_at: '', updated_at: '' }],
      online: false,
    });
  };

  const remove = async (id: string) => {
    setError(null);
    if (value.online) {
      try {
        await backend.deleteProvider(id);
      } catch (err) {
        if (!(err instanceof BackendOfflineError)) {
          setError(err instanceof Error ? err.message : 'failed to delete provider');
          return;
        }
        onChange({ ...value, online: false });
      }
    }
    onChange({ providers: value.providers.filter((p) => p.id !== id), online: value.online });
  };

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4 px-6 py-6">
      <div>
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-tt-ink">
          Providers
        </h1>
        <p className="mt-1 text-[13px] text-tt-ink-2">
          Model providers with their API keys. Their models show up in the model picker.
        </p>
      </div>

      <section className="rounded-xl border border-tt-hairline bg-tt-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-tt-ink">
            <KeyRound size={15} className="shrink-0 text-tt-ink-2" strokeWidth={1.9} />
            Configured providers
          </h2>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-tt-ink px-3 py-1.5 text-[13px] font-medium text-tt-ink-invert transition-transform hover:scale-[1.03]"
          >
            <Plus size={14} strokeWidth={2.4} />
            Add Provider
          </button>
        </div>

        {!value.online && (
          <p className="font-mono2 mt-3 rounded-lg bg-tt-run-soft/60 px-3 py-2 text-[11.5px] text-tt-run">
            backend offline — changes stay in this session only
          </p>
        )}
        {error && (
          <p className="font-mono2 mt-3 rounded-lg bg-tt-err-soft px-3 py-2 text-[11.5px] text-tt-err">
            {error}
          </p>
        )}

        {value.providers.length === 0 ? (
          <p className="font-mono2 mt-4 rounded-lg bg-tt-panel/60 px-3 py-3 text-center text-[12px] text-tt-ink-3">
            no providers yet — add one above
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-tt-hairline/70 overflow-hidden rounded-lg border border-tt-hairline">
            {value.providers.map((p) => (
              <li key={p.id} className="group relative flex items-center gap-2.5 px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-tt-ink">
                  {p.name}
                </span>
                {p.has_key && (
                  <span className="font-mono2 shrink-0 rounded border border-tt-hairline bg-tt-panel px-1.5 py-px text-[9.5px] tracking-wide text-tt-ink-3 uppercase">
                    key
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void remove(p.id)}
                  aria-label={`Delete ${p.name}`}
                  className="shrink-0 rounded p-1 text-tt-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:bg-tt-err-soft hover:text-tt-err focus-visible:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showAdd && <AddDialog onCreate={(n, k, u) => void create(n, k, u)} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
