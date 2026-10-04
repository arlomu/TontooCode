import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Folder, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectPickerProps {
  projects: { id: string; name: string; mainFolder?: string }[];
  value: string;
  onChange: (id: string) => void;
}

/** Project picker for the new-chat view: search field + project rows. */
export function ProjectPicker({ projects, value, onChange }: ProjectPickerProps) {
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

  const active = projects.find((p) => p.id === value) ?? projects[0]!;
  const q = query.trim().toLowerCase();
  const hits = q
    ? projects.filter((p) => p.name.toLowerCase().includes(q))
    : projects;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Project for this chat"
        className={cn(
          'flex items-center gap-2 rounded-lg border border-tt-hairline bg-tt-card px-3 py-2 text-left shadow-[0_1px_2px_rgb(15_23_42/0.06)] transition-shadow hover:shadow-[0_2px_6px_rgb(15_23_42/0.09)]',
        )}
      >
        <Folder size={15} className="shrink-0 text-tt-ink-2" strokeWidth={1.8} />
        <span className="max-w-[180px] truncate text-[13px] font-medium text-tt-ink">
          {active.name}
        </span>
        <ChevronDown
          size={13}
          className={cn('shrink-0 text-tt-ink-3 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="tt-rise absolute top-[calc(100%+8px)] left-0 z-50 w-[264px] overflow-hidden rounded-xl border border-tt-hairline bg-tt-card shadow-[0_12px_40px_rgb(15_23_42/0.16)]">
          {/* search */}
          <div className="flex items-center gap-2 border-b border-tt-hairline px-3 py-2.5">
            <Search size={14} className="shrink-0 text-tt-ink-3" strokeWidth={2.1} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="w-full bg-transparent text-[13px] text-tt-ink outline-none placeholder:text-tt-ink-3"
            />
          </div>

          {/* projects */}
          <div className="p-1.5">
            {hits.length === 0 && (
              <p className="font-mono2 px-2.5 py-4 text-center text-[11.5px] text-tt-ink-3">
                no project matches “{query.trim()}”
              </p>
            )}
            {hits.map((p) => {
              const selected = p.id === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                    selected ? 'bg-tt-panel' : 'hover:bg-tt-panel/70',
                  )}
                >
                  <Folder
                    size={14}
                    className={cn('shrink-0 self-start pt-0.5', selected ? 'text-tt-ink' : 'text-tt-ink-3')}
                    strokeWidth={1.8}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-[13px]',
                        selected ? 'font-semibold text-tt-ink' : 'text-tt-ink-2',
                      )}
                    >
                      {p.name}
                    </span>
                    {p.mainFolder && (
                      <span className="font-mono2 block truncate text-[10.5px] text-tt-ink-3">
                        {p.mainFolder}
                      </span>
                    )}
                  </span>
                  {selected && (
                    <Check size={14} className="shrink-0 text-tt-ink-2" strokeWidth={2.6} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
