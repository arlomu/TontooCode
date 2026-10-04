import { cn } from '@/lib/utils';
import type { ConversationMeta } from '@/lib/store';

/** Mirrors TITLEBAR_HEIGHT in apps/desktop/src/main.js */
export const TITLEBAR_HEIGHT = 38;

/** Native caption buttons Electron draws over our strip, per platform. */
const CAPTION_W = { win32: 138, darwin: 78 } as const;

/** How many recent chats surface as tabs. */
export const RECENT_TAB_COUNT = 5;

interface TitleBarProps {
  recent: ConversationMeta[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Custom window decoration strip.
 *
 * A drag region that carries the newest chats as tabs on the right, just
 * left of the native caption buttons Electron overlays via titleBarOverlay.
 */
export function TitleBar({ recent, activeId, onSelect }: TitleBarProps) {
  const platform = window.tontoo?.platform;
  const caption = platform === 'darwin' ? CAPTION_W.darwin : CAPTION_W.win32;

  return (
    <header
      style={{ height: TITLEBAR_HEIGHT }}
      className="tt-drag relative z-20 flex shrink-0 items-stretch gap-1 border-b border-tt-hairline bg-tt-panel pr-2 pl-2 select-none"
    >
      {/* recent chats — stretched across the whole strip, equal shares */}
      {recent.length > 0 && (
        <nav aria-label="Recent chats" className="tt-nodrag flex min-w-0 flex-1 items-stretch gap-1">
          {recent.slice(0, RECENT_TAB_COUNT).map((c) => {
            const active = c.id === activeId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                title={c.title}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'my-[5px] min-w-0 flex-1 truncate rounded-md px-3 text-center text-[12px] transition-colors',
                  active
                    ? 'bg-tt-card font-medium text-tt-ink shadow-[0_1px_2px_rgb(15_23_42/0.08)]'
                    : 'text-tt-ink-2 hover:bg-tt-card/60 hover:text-tt-ink',
                )}
              >
                {c.title}
              </button>
            );
          })}
        </nav>
      )}

      {/* room for the native caption buttons */}
      <div aria-hidden className="shrink-0 self-center" style={{ width: caption }} />
    </header>
  );
}
