import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { backend, BackendOfflineError } from '@/lib/backend';

export interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  badge?: string;
}

export const MODELS: ModelEntry[] = [
  { id: 'opencode/nemotron-3.5-small', name: 'Nemotron 3.5 Small', provider: 'OpenCode', badge: 'Free' },
  { id: 'opencode/nemotron-3.5-lightning', name: 'Nemotron 3.5 Lightning', provider: 'OpenCode', badge: 'Free' },
  { id: 'opencode/space-bunny-free', name: 'Space Bunny', provider: 'OpenCode', badge: 'Free' },
  { id: 'google/gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', provider: 'Google' },
  {
    id: 'google/gemini-3.5-live-translate',
    name: 'Gemini 3.5 Live Translate Preview',
    provider: 'Google',
  },
  { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash', provider: 'Google' },
];

export const DEFAULT_MODEL = MODELS[2]!.id;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Built-in groups win over same-named backend providers (no duplicates). */
const BUILTIN_GROUP_KEYS = new Set(MODELS.map((m) => norm(m.provider)));

interface ExtraGroup {
  provider: string;
  models: ModelEntry[];
  /** True when the provider has no match in the models.dev catalog. */
  missing: boolean;
}

interface ModelMenuProps {
  value: string;
  onChange: (id: string) => void;
}

/**
 * Model picker: search field, provider groups, check on the active model.
 * Backend providers are merged in below the built-ins, with their models
 * resolved from the models.dev catalog.
 */
export function ModelMenu({ value, onChange }: ModelMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [extra, setExtra] = useState<ExtraGroup[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open]);

  // Resolve backend provider models once per menu lifetime.
  useEffect(() => {
    if (!open || extra !== null || loadingModels) return;
    let dead = false;
    setLoadingModels(true);
    (async () => {
      try {
        const providers = await backend.listProviders();
        const groups = await Promise.all(
          providers.map(async (p): Promise<ExtraGroup | null> => {
            if (BUILTIN_GROUP_KEYS.has(norm(p.name))) return null;
            const load = async () => {
              try {
                return await backend.catalogModels(p.id);
              } catch {
                return await backend.catalogModels(p.name);
              }
            };
            try {
              const cat = await load();
              return {
                provider: p.name,
                models: cat.models.map((m) => ({
                  id: `${cat.id}/${m.id}`,
                  name: m.name,
                  provider: p.name,
                })),
                missing: false,
              };
            } catch {
              return { provider: p.name, models: [], missing: true };
            }
          }),
        );
        if (!dead) setExtra(groups.filter((g): g is ExtraGroup => g !== null));
      } catch (err) {
        // Offline: built-ins only. Providers tab surfaces the status.
        if (!dead && !(err instanceof BackendOfflineError)) setExtra([]);
        else if (!dead) setExtra([]);
      } finally {
        if (!dead) setLoadingModels(false);
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  const allBuiltin = MODELS;
  const active =
    allBuiltin.find((m) => m.id === value) ??
    (extra ?? []).flatMap((g) => g.models).find((m) => m.id === value) ?? {
      id: value,
      name: value,
      provider: '',
    };

  const groups = (() => {
    const q = query.trim().toLowerCase();
    const match = (m: ModelEntry) =>
      !q || m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
    const byProvider = new Map<string, ModelEntry[]>();
    for (const m of allBuiltin.filter(match)) {
      const list = byProvider.get(m.provider) ?? [];
      list.push(m);
      byProvider.set(m.provider, list);
    }
    const out: { provider: string; items: ModelEntry[]; missing?: boolean }[] = [
      ...[...byProvider.entries()].map(([provider, items]) => ({ provider, items })),
    ];
    for (const g of extra ?? []) {
      const items = g.models.filter(match);
      if (!q || items.length > 0 || g.provider.toLowerCase().includes(q)) {
        out.push({ provider: g.provider, items, missing: g.missing });
      }
    }
    return out;
  })();

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Model"
        className={cn(
          'flex max-w-[190px] items-center gap-1.5 rounded-full py-1 pr-2 pl-2 text-[12.5px] font-medium transition-colors',
          open ? 'bg-tt-panel text-tt-ink' : 'text-tt-ink-2 hover:bg-tt-panel',
        )}
      >
        <span className="truncate">{active.name}</span>
        <ChevronDown
          size={13}
          className={cn('shrink-0 text-tt-ink-3 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="tt-rise absolute right-0 bottom-[calc(100%+8px)] z-50 w-[300px] overflow-hidden rounded-xl border border-tt-hairline bg-tt-card shadow-[0_12px_40px_rgb(15_23_42/0.16)]">
          {/* search */}
          <div className="flex items-center gap-2 border-b border-tt-hairline px-3 py-2.5">
            <Search size={14} className="shrink-0 text-tt-ink-3" strokeWidth={2.1} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models"
              aria-label="Search models"
              className="w-full bg-transparent text-[13px] text-tt-ink outline-none placeholder:text-tt-ink-3"
            />
          </div>

          {/* grouped list */}
          <div className="tt-scrollblock max-h-[286px] overflow-y-auto overscroll-contain p-1.5">
            {loadingModels && (
              <p className="font-mono2 tt-caret px-2.5 py-3 text-[11.5px] text-tt-ink-3">
                loading provider models
              </p>
            )}
            {!loadingModels && groups.length === 0 && (
              <p className="font-mono2 px-2.5 py-4 text-center text-[11.5px] text-tt-ink-3">
                no model matches “{query.trim()}”
              </p>
            )}

            {groups.map(({ provider, items, missing }) => (
              <div key={provider} className="pb-1">
                <h3 className="font-mono2 px-2.5 pt-1.5 pb-1 text-[9.5px] tracking-[0.14em] text-tt-ink-3 uppercase">
                  {provider}
                </h3>
                {missing && items.length === 0 && (
                  <p className="font-mono2 px-2.5 py-1.5 text-[11px] text-tt-ink-3">
                    no models found in catalog
                  </p>
                )}
                {items.map((m) => {
                  const selected = m.id === value;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                        selected ? 'bg-tt-panel' : 'hover:bg-tt-panel/70',
                      )}
                    >
                      <span
                        className={cn(
                          'flex-1 truncate text-[13px]',
                          selected ? 'font-semibold text-tt-ink' : 'text-tt-ink-2',
                        )}
                      >
                        {m.name}
                      </span>
                      {m.badge && (
                        <span className="shrink-0 rounded border border-tt-hairline bg-tt-ground px-1.5 py-px font-mono2 text-[9.5px] tracking-wide text-tt-ink-3 uppercase">
                          {m.badge}
                        </span>
                      )}
                      {selected && (
                        <Check size={14} className="shrink-0 text-tt-ink-2" strokeWidth={2.6} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
