import { useEffect, useRef } from 'react';
import { FolderCog, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectContextMenuProps {
  x: number;
  y: number;
  canDelete: boolean;
  onRename: () => void;
  onEditSubfolders: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Custom right-click menu for sidebar projects. No native menus involved. */
export function ProjectContextMenu({
  x,
  y,
  canDelete,
  onRename,
  onEditSubfolders,
  onDelete,
  onClose,
}: ProjectContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Keep the menu inside the viewport.
  const left = Math.max(8, Math.min(x, window.innerWidth - 232));
  const top = Math.max(8, Math.min(y, window.innerHeight - 170));

  const itemCls =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-tt-ink transition-colors hover:bg-tt-panel';

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Project actions"
      onContextMenu={(e) => e.preventDefault()}
      style={{ left, top }}
      className="tt-rise fixed z-50 w-[224px] rounded-xl border border-tt-hairline bg-tt-card p-1.5 shadow-[0_12px_40px_rgb(15_23_42/0.16)]"
    >
      <button type="button" role="menuitem" onClick={onRename} className={itemCls}>
        <Pencil size={14} className="shrink-0 text-tt-ink-3" strokeWidth={2} />
        Rename
      </button>
      <button type="button" role="menuitem" onClick={onEditSubfolders} className={itemCls}>
        <FolderCog size={14} className="shrink-0 text-tt-ink-3" strokeWidth={2} />
        Change subfolders
      </button>
      <div className="mx-2 my-1 border-t border-tt-hairline" />
      <button
        type="button"
        role="menuitem"
        onClick={onDelete}
        disabled={!canDelete}
        title={canDelete ? undefined : 'The default project cannot be deleted'}
        className={cn(
          itemCls,
          'text-tt-err hover:bg-tt-err-soft',
          !canDelete && 'cursor-not-allowed opacity-40 hover:bg-transparent',
        )}
      >
        <Trash2 size={14} className="shrink-0" strokeWidth={2} />
        Delete
      </button>
    </div>
  );
}
