import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RenameProjectDialogProps {
  title?: string;
  currentName: string;
  onRename: (name: string) => void;
  onClose: () => void;
}

/** Custom rename modal. No native prompt() involved. */
export function RenameProjectDialog({ title = 'Rename project', currentName, onRename, onClose }: RenameProjectDialogProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== currentName;

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
        aria-label={title}
        className="tt-rise w-full max-w-[400px] rounded-xl bg-tt-card shadow-[0_24px_80px_rgb(15_23_42/0.25)]"
      >
        <div className="flex items-center justify-between border-b border-tt-hairline px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-tt-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-tt-ink-3 transition-colors hover:bg-tt-panel hover:text-tt-ink"
          >
            <X size={16} strokeWidth={2.1} />
          </button>
        </div>

        <form
          className="px-5 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onRename(trimmed);
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Name"
            autoFocus
            onFocus={(e) => e.target.select()}
            placeholder="Name"
            className="w-full rounded-lg border border-tt-hairline bg-tt-card px-3 py-2 text-[13.5px] text-tt-ink outline-none placeholder:text-tt-ink-3 focus:border-tt-signal/50"
          />

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-tt-hairline bg-tt-card px-4 py-1.5 text-[13px] font-medium text-tt-ink transition-colors hover:border-tt-ink-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className={cn(
                'rounded-lg px-4 py-1.5 text-[13px] font-medium text-tt-ink-invert transition-all',
                canSave ? 'bg-tt-ink hover:scale-[1.03]' : 'cursor-not-allowed bg-tt-ink-3/60',
              )}
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
