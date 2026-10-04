import { ChevronRight, Folder, Pencil, Settings, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationMeta } from '@/lib/store';

export const PAGE_SIZE = 10;
export const PAGE_STEP = 15;

interface SidebarProps {
  projects: { id: string; name: string }[];
  chatsByProject: Record<string, ConversationMeta[]>;
  activeId: string;
  expandedIds: Set<string>;
  onToggleProject: (id: string) => void;
  limits: Record<string, number>;
  onShowMore: (projectId: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  projects,
  chatsByProject,
  activeId,
  expandedIds,
  onToggleProject,
  limits,
  onShowMore,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-tt-hairline bg-tt-panel">
      {/* wordmark — also the window drag handle for the top-left corner */}
      <div className="tt-drag px-4 pt-3 pb-3.5">
        <div className="flex items-baseline gap-[7px]">
          <span className="font-display text-[19px] leading-none font-extrabold tracking-tight text-tt-ink">
            Tontoo
          </span>
          <span className="font-mono2 text-[11.5px] leading-none font-semibold tracking-[0.16em] text-tt-signal">
            CODE
          </span>
        </div>
      </div>

      {/* new chat */}
      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center gap-2.5 rounded-lg bg-tt-card px-3 py-2 text-left text-[13.5px] font-medium text-tt-ink shadow-[0_1px_2px_rgb(15_23_42/0.06)] transition-shadow hover:shadow-[0_2px_6px_rgb(15_23_42/0.09)]"
        >
          <Pencil size={15} className="shrink-0 text-tt-signal" strokeWidth={2.2} />
          New Chat
        </button>
      </div>

      {/* projects — full-bleed rows so the active chat reads as one band */}
      <nav className="tt-scroll mt-5 min-h-0 flex-1 overflow-y-auto pb-3" aria-label="Projects">
        <h2 className="font-mono2 px-4 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-tt-ink-3 uppercase">
          Projects
        </h2>

        {projects.map((p) => {
          const open = expandedIds.has(p.id);
          const chats = chatsByProject[p.id] ?? [];
          const limit = limits[p.id] ?? PAGE_SIZE;
          const visible = chats.slice(0, limit);
          const remaining = chats.length - visible.length;

          return (
            <div key={p.id}>
              <button
                type="button"
                onClick={() => onToggleProject(p.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-1.5 px-4 py-[7px] text-left transition-colors hover:bg-tt-card/60"
              >
                <ChevronRight
                  size={13}
                  className={cn(
                    'shrink-0 text-tt-ink-3 transition-transform duration-200',
                    open && 'rotate-90',
                  )}
                />
                <Folder size={15} className="shrink-0 text-tt-ink-2" strokeWidth={1.8} />
                <span className="truncate text-[13.5px] text-tt-ink">{p.name}</span>
              </button>

              {/* expand / collapse with a height animation */}
              <div
                className={cn(
                  'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                  open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  {visible.length === 0 ? (
                    <p className="font-mono2 py-1.5 pr-2 pl-[42px] text-[11px] text-tt-ink-3">
                      no chats yet
                    </p>
                  ) : (
                    <ul>
                      {visible.map((c) => {
                        const active = c.id === activeId;
                        return (
                          <li key={c.id} className="group relative">
                            <button
                              type="button"
                              onClick={() => onSelect(c.id)}
                              aria-current={active ? 'true' : undefined}
                              className={cn(
                                'block w-full py-[7px] pr-8 pl-[42px] text-left transition-colors',
                                active
                                  ? 'bg-tt-card font-medium text-tt-ink'
                                  : 'text-tt-ink-2 hover:bg-tt-card/60',
                              )}
                            >
                              <span className="block truncate text-[13px]">{c.title}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(c.id)}
                              aria-label={`Delete ${c.title}`}
                              className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded p-1 text-tt-ink-3 group-hover:block hover:bg-tt-err-soft hover:text-tt-err"
                            >
                              <Trash2 size={13} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {remaining > 0 && (
                    <button
                      type="button"
                      onClick={() => onShowMore(p.id)}
                      className="font-mono2 block w-full py-[7px] pr-2 pl-[42px] text-left text-[11.5px] text-tt-ink-3 transition-colors hover:text-tt-signal"
                    >
                      + show more ({remaining})
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* settings */}
      <div className="border-t border-tt-hairline px-3 py-2.5">
        <button
          type="button"
          onClick={onOpenSettings}
          className="font-mono2 flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left text-[10.5px] tracking-[0.14em] text-tt-ink-3 uppercase transition-colors hover:bg-tt-card/60 hover:text-tt-ink"
        >
          <Settings size={15} className="shrink-0 text-tt-ink-2" strokeWidth={1.8} />
          Settings
        </button>
      </div>
    </aside>
  );
}
