import { useEffect, useState } from 'react';
import { Folder, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditSubfoldersDialogProps {
  projectName: string;
  subfolders: string[];
  onSave: (subfolders: string[]) => void;
  onClose: () => void;
}

/**
 * Custom subfolder editor. Same list interaction as the add-project dialog,
 * but without the main-folder section — that one is immutable here.
 */
export function EditSubfoldersDialog({
  projectName,
  subfolders,
  onSave,
  onClose,
}: EditSubfoldersDialogProps) {
  const [subs, setSubs] = useState<string[]>(() => [...subfolders]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addSubfolders = async () => {
    const picked = await window.tontoo?.pickFolders?.().catch(() => [] as string[]);
    if (!picked || picked.length === 0) return;
    setSubs((prev) => [...prev, ...picked.filter((p) => !prev.includes(p))]);
  };

  const changed = JSON.stringify(subs) !== JSON.stringify(subfolders);

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
        aria-label={`Change subfolders of ${projectName}`}
        className="tt-rise max-h-[calc(100%-32px)] w-full max-w-[520px] overflow-y-auto rounded-xl bg-tt-card shadow-[0_24px_80px_rgb(15_23_42/0.25)]"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-tt-hairline px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-tt-ink">Change subfolders</h2>
            <p className="font-mono2 mt-0.5 truncate text-[11px] text-tt-ink-3">{projectName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-tt-ink-3 transition-colors hover:bg-tt-panel hover:text-tt-ink"
          >
            <X size={16} strokeWidth={2.1} />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="rounded-lg border border-tt-hairline bg-tt-panel/60 p-3">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[13px] font-medium text-tt-ink">
                Subfolders ({subs.length})
              </span>
              <button
                type="button"
                onClick={() => void addSubfolders()}
                className="flex shrink-0 items-center gap-1 rounded-md border border-tt-hairline bg-tt-card px-2.5 py-1 text-[12.5px] font-medium text-tt-ink transition-colors hover:border-tt-signal/50 hover:text-tt-signal"
              >
                <Plus size={13} strokeWidth={2.2} />
                Add subfolders
              </button>
            </div>
            {subs.length === 0 ? (
              <p className="mt-2 rounded-md bg-tt-card px-2.5 py-2 text-[12.5px] text-tt-ink-3">
                No subfolders — click Add to pick folders (multi-select allowed).
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {subs.map((s) => (
                  <li
                    key={s}
                    className="flex items-center gap-2 rounded-md bg-tt-card px-2.5 py-1.5"
                  >
                    <Folder size={13} className="shrink-0 text-tt-ink-3" strokeWidth={1.9} />
                    <span className="font-mono2 min-w-0 flex-1 truncate text-[12px] text-tt-ink">
                      {s}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubs((prev) => prev.filter((p) => p !== s))}
                      aria-label={`Remove ${s}`}
                      className="shrink-0 rounded p-0.5 text-tt-ink-3 transition-colors hover:bg-tt-err-soft hover:text-tt-err"
                    >
                      <X size={13} strokeWidth={2.2} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* footer */}
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
            disabled={!changed}
            onClick={() => onSave(subs)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-[13px] font-medium text-tt-ink-invert transition-all',
              changed ? 'bg-tt-ink hover:scale-[1.03]' : 'cursor-not-allowed bg-tt-ink-3/60',
            )}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
