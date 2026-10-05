import { useState } from 'react';
import { ChevronRight, Folder, Pencil, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_PROJECT_ID, type ConversationMeta } from '@/lib/store';
import { ProjectContextMenu } from '@/components/ProjectContextMenu';
import { ChatContextMenu } from '@/components/ChatContextMenu';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RenameProjectDialog } from '@/components/RenameProjectDialog';
import { EditSubfoldersDialog } from '@/components/EditSubfoldersDialog';
import { LiveBubble } from '@/components/LiveBubble';

export const PAGE_SIZE = 10;
export const PAGE_STEP = 15;

interface SidebarProps {
  projects: { id: string; name: string; subfolders?: string[] }[];
  chatsByProject: Record<string, ConversationMeta[]>;
  activeId: string;
  /** Conversations with a live agent stream. */
  liveIds: string[];
  /** Conversations whose agent finished while in the background (unread). */
  doneIds: string[];
  expandedIds: Set<string>;
  onToggleProject: (id: string) => void;
  limits: Record<string, number>;
  onShowMore: (projectId: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onOpenSettings: () => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onEditSubfolders: (id: string, subfolders: string[]) => void;
}

export function Sidebar({
  projects,
  chatsByProject,
  activeId,
  liveIds,
  doneIds,
  expandedIds,
  onToggleProject,
  limits,
  onShowMore,
  onSelect,
  onNew,
  onDelete,
  onRenameChat,
  onOpenSettings,
  onRenameProject,
  onDeleteProject,
  onEditSubfolders,
}: SidebarProps) {
  // Right-click menu anchor + open dialogs (ids into `projects`).
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [subfoldersId, setSubfoldersId] = useState<string | null>(null);
  // Chat right-click menu + dialogs (chat lives in chatsByProject).
  const [chatMenu, setChatMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [chatRenameId, setChatRenameId] = useState<string | null>(null);
  const [chatDeleteId, setChatDeleteId] = useState<string | null>(null);

  const menuProject = menu ? projects.find((p) => p.id === menu.id) : undefined;
  const renameProject = renameId ? projects.find((p) => p.id === renameId) : undefined;
  const deleteProject = deleteId ? projects.find((p) => p.id === deleteId) : undefined;
  const subfoldersProject = subfoldersId ? projects.find((p) => p.id === subfoldersId) : undefined;
  const chatTargetId = chatMenu?.id ?? chatRenameId ?? chatDeleteId ?? null;
  const chatTarget =
    chatTargetId !== null
      ? Object.values(chatsByProject)
          .flat()
          .find((c) => c.id === chatTargetId)
      : undefined;

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
          // Bubbles on the project row only while collapsed; expanded rows
          // show them on the exact chat(s) below. Live and done show together.
          const projectLive = !open && chats.some((c) => liveIds.includes(c.id));
          const projectDone =
            !open &&
            chats.some((c) => !liveIds.includes(c.id) && doneIds.includes(c.id));

          return (
            <div key={p.id}>
              <button
                type="button"
                onClick={() => onToggleProject(p.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ id: p.id, x: e.clientX, y: e.clientY });
                }}
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
                {projectLive && <LiveBubble tone="live" label={`Agent running in ${p.name}`} />}
                {projectDone && <LiveBubble tone="done" label={`Agent finished in ${p.name}`} />}
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
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => onSelect(c.id)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setChatMenu({ id: c.id, x: e.clientX, y: e.clientY });
                              }}
                              aria-current={active ? 'true' : undefined}
                              className={cn(
                                'block w-full py-[7px] pr-4 pl-[42px] text-left transition-colors',
                                active
                                  ? 'bg-tt-card font-medium text-tt-ink'
                                  : 'text-tt-ink-2 hover:bg-tt-card/60',
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 truncate text-[13px]">{c.title}</span>
                                {liveIds.includes(c.id) ? (
                                  <LiveBubble tone="live" label={`Agent running in ${c.title}`} />
                                ) : (
                                  doneIds.includes(c.id) && (
                                    <LiveBubble tone="done" label={`Agent finished in ${c.title}`} />
                                  )
                                )}
                              </span>
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

      {/* right-click menu + dialogs (all custom, no native popups) */}
      {menu && menuProject && (
        <ProjectContextMenu
          x={menu.x}
          y={menu.y}
          canDelete={menuProject.id !== DEFAULT_PROJECT_ID}
          onRename={() => {
            setMenu(null);
            setRenameId(menuProject.id);
          }}
          onEditSubfolders={() => {
            setMenu(null);
            setSubfoldersId(menuProject.id);
          }}
          onDelete={() => {
            setMenu(null);
            setDeleteId(menuProject.id);
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {renameProject && (
        <RenameProjectDialog
          currentName={renameProject.name}
          onRename={(name) => {
            setRenameId(null);
            onRenameProject(renameProject.id, name);
          }}
          onClose={() => setRenameId(null)}
        />
      )}
      {subfoldersProject && (
        <EditSubfoldersDialog
          projectName={subfoldersProject.name}
          subfolders={subfoldersProject.subfolders ?? []}
          onSave={(subs) => {
            setSubfoldersId(null);
            onEditSubfolders(subfoldersProject.id, subs);
          }}
          onClose={() => setSubfoldersId(null)}
        />
      )}
      {deleteProject && (
        <ConfirmDialog
          title="Delete project"
          message={
            <>
              Delete <span className="font-semibold text-tt-ink">{deleteProject.name}</span>?
              Its chats stay and move to the Default project.
            </>
          }
          confirmLabel="Delete"
          onConfirm={() => {
            setDeleteId(null);
            onDeleteProject(deleteProject.id);
          }}
          onClose={() => setDeleteId(null)}
        />
      )}

      {/* chat right-click menu + dialogs (all custom, no native popups) */}
      {chatMenu && chatTarget && (
        <ChatContextMenu
          x={chatMenu.x}
          y={chatMenu.y}
          onRename={() => {
            setChatMenu(null);
            setChatRenameId(chatTarget.id);
          }}
          onDelete={() => {
            setChatMenu(null);
            setChatDeleteId(chatTarget.id);
          }}
          onClose={() => setChatMenu(null)}
        />
      )}
      {chatTarget && chatRenameId === chatTarget.id && (
        <RenameProjectDialog
          title="Rename chat"
          currentName={chatTarget.title}
          onRename={(title) => {
            setChatRenameId(null);
            onRenameChat(chatTarget.id, title);
          }}
          onClose={() => setChatRenameId(null)}
        />
      )}
      {chatTarget && chatDeleteId === chatTarget.id && (
        <ConfirmDialog
          title="Delete chat"
          message={
            <>
              Delete <span className="font-semibold text-tt-ink">{chatTarget.title}</span>?
              This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          onConfirm={() => {
            setChatDeleteId(null);
            onDelete(chatTarget.id);
          }}
          onClose={() => setChatDeleteId(null)}
        />
      )}
    </aside>
  );
}
