import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ConversationMeta } from '@/lib/store';
import { LiveBubble } from '@/components/LiveBubble';
import { ChatContextMenu } from '@/components/ChatContextMenu';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RenameProjectDialog } from '@/components/RenameProjectDialog';

/** Mirrors TITLEBAR_HEIGHT in apps/desktop/src/main.js */
export const TITLEBAR_HEIGHT = 38;

/** Native caption buttons Electron draws over our strip, per platform. */
const CAPTION_W = { win32: 138, darwin: 78 } as const;

/** How many recent chats surface as tabs. */
export const RECENT_TAB_COUNT = 5;

interface TitleBarProps {
  recent: ConversationMeta[];
  activeId: string;
  /** Conversations with a live agent stream. */
  liveIds: string[];
  /** Conversations whose agent finished while in the background (unread). */
  doneIds: string[];
  onSelect: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
}

/**
 * Custom window decoration strip.
 *
 * A drag region that carries the newest chats as tabs on the right, just
 * left of the native caption buttons Electron overlays via titleBarOverlay.
 */
export function TitleBar({ recent, activeId, liveIds, doneIds, onSelect, onDeleteChat, onRenameChat }: TitleBarProps) {
  const platform = window.tontoo?.platform;
  const caption = platform === 'darwin' ? CAPTION_W.darwin : CAPTION_W.win32;
  const [tabMenu, setTabMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [tabRenameId, setTabRenameId] = useState<string | null>(null);
  const [tabDeleteId, setTabDeleteId] = useState<string | null>(null);
  const tabTargetId = tabMenu?.id ?? tabRenameId ?? tabDeleteId ?? null;
  const tabTarget = tabTargetId !== null ? recent.find((c) => c.id === tabTargetId) : undefined;

  return (
    <header
      style={{ height: TITLEBAR_HEIGHT }}
      className="tt-drag relative z-20 flex shrink-0 items-stretch gap-1 border-b border-tt-hairline bg-tt-panel pr-2 pl-2 select-none"
    >
      {/* recent chats — stretched across the whole strip, equal shares */}
      {recent.length > 0 && (
        <nav aria-label="Recent chats" className="tt-nodrag flex min-w-0 flex-1 items-stretch gap-1">
          {recent.slice(0, RECENT_TAB_COUNT).map((c, i) => {
            const active = c.id === activeId;
            const live = liveIds.includes(c.id);
            const done = !live && doneIds.includes(c.id);
            return (
              <div key={c.id} className="flex min-w-0 flex-1 items-stretch">
                {i > 0 && (
                  <span aria-hidden className="mx-0.5 my-auto h-4 w-px shrink-0 bg-tt-hairline" />
                )}
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setTabMenu({ id: c.id, x: e.clientX, y: e.clientY });
                  }}
                  title={c.title}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'my-[5px] min-w-0 flex-1 truncate rounded-md px-3 text-center text-[12px] transition-colors',
                    active
                      ? 'bg-tt-card font-medium text-tt-ink shadow-[0_1px_2px_rgb(15_23_42/0.08)]'
                      : 'text-tt-ink-2 hover:bg-tt-card/60 hover:text-tt-ink',
                  )}
                >
                  <span className="flex min-w-0 items-center justify-center gap-1.5">
                    {live ? (
                      <LiveBubble tone="live" label={`Agent running in ${c.title}`} />
                    ) : (
                      done && <LiveBubble tone="done" label={`Agent finished in ${c.title}`} />
                    )}
                    <span className="min-w-0 truncate">{c.title}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </nav>
      )}

      {/* room for the native caption buttons */}
      <div aria-hidden className="shrink-0 self-center" style={{ width: caption }} />

      {/* tab right-click menu + dialogs (all custom, no native popups) */}
      {tabMenu && tabTarget && (
        <ChatContextMenu
          x={tabMenu.x}
          y={tabMenu.y}
          onRename={() => {
            setTabMenu(null);
            setTabRenameId(tabTarget.id);
          }}
          onDelete={() => {
            setTabMenu(null);
            setTabDeleteId(tabTarget.id);
          }}
          onClose={() => setTabMenu(null)}
        />
      )}
      {tabTarget && tabRenameId === tabTarget.id && (
        <RenameProjectDialog
          title="Rename chat"
          currentName={tabTarget.title}
          onRename={(title) => {
            setTabRenameId(null);
            onRenameChat(tabTarget.id, title);
          }}
          onClose={() => setTabRenameId(null)}
        />
      )}
      {tabTarget && tabDeleteId === tabTarget.id && (
        <ConfirmDialog
          title="Delete chat"
          message={
            <>
              Delete <span className="font-semibold text-tt-ink">{tabTarget.title}</span>?
              This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          onConfirm={() => {
            setTabDeleteId(null);
            onDeleteChat(tabTarget.id);
          }}
          onClose={() => setTabDeleteId(null)}
        />
      )}
    </header>
  );
}
