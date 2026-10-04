import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface ModelMenuProps {
  value: string;
  onChange: (id: string) => void;
}

/** Model picker: search field, provider groups, check on the active model. */
export function ModelMenu({ value, onChange }: ModelMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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

  const active = MODELS.find((m) => m.id === value) ?? MODELS[0]!;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hits = q
      ? MODELS.filter(
          (m) => m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
        )
      : MODELS;
    const byProvider = new Map<string, ModelEntry[]>();
    for (const m of hits) {
      const list = byProvider.get(m.provider) ?? [];
      list.push(m);
      byProvider.set(m.provider, list);
    }
    return [...byProvider.entries()];
  }, [query]);

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
        <div
          className="tt-rise absolute right-0 bottom-[calc(100%+8px)] z-50 w-[300px] overflow-hidden rounded-xl border border-tt-hairline bg-tt-card shadow-[0_12px_40px_rgb(15_23_42/0.16)]"
        >
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
            {groups.length === 0 && (
              <p className="font-mono2 px-2.5 py-4 text-center text-[11.5px] text-tt-ink-3">
                no model matches “{query.trim()}”
              </p>
            )}

            {groups.map(([provider, items]) => (
              <div key={provider} className="pb-1">
                <h3 className="font-mono2 px-2.5 pt-1.5 pb-1 text-[9.5px] tracking-[0.14em] text-tt-ink-3 uppercase">
                  {provider}
                </h3>
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