import { useEffect, useState } from 'react';
import { Folder, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NewProject {
  name: string;
  /** Empty = auto-create under the tasks folder. */
  mainFolder: string;
  subfolders: string[];
}

interface AddProjectDialogProps {
  onCreate: (project: NewProject) => void;
  onClose: () => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono2 text-[10px] font-semibold tracking-[0.14em] text-tt-ink-3 uppercase">
      {children}
    </p>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[12.5px] leading-relaxed text-tt-ink-2">{children}</p>;
}

/** Add-project dialog. Created projects are persisted via the backend. */
export function AddProjectDialog({ onCreate, onClose }: AddProjectDialogProps) {
  const [name, setName] = useState('');
  const [mainFolder, setMainFolder] = useState('');
  const [subfolders, setSubfolders] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const browseMain = async () => {
    const picked = await window.tontoo?.pickFolder?.().catch(() => [] as string[]);
    if (picked && picked.length > 0) setMainFolder(picked[0]!);
  };

  const addSubfolders = async () => {
    const picked = await window.tontoo?.pickFolders?.().catch(() => [] as string[]);
    if (!picked || picked.length === 0) return;
    setSubfolders((prev) => [...prev, ...picked.filter((p) => !prev.includes(p))]);
  };

  const canCreate = name.trim().length > 0 && mainFolder.trim().length > 0;

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
        aria-label="Add project"
        className="tt-rise max-h-[calc(100%-32px)] w-full max-w-[520px] overflow-y-auto rounded-xl bg-tt-card shadow-[0_24px_80px_rgb(15_23_42/0.25)]"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-tt-hairline px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-tt-ink">Add project</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-tt-ink-3 transition-colors hover:bg-tt-panel hover:text-tt-ink"
          >
            <X size={16} strokeWidth={2.1} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* name */}
          <div>
            <Label>Name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              aria-label="Project name"
              autoFocus
              className="mt-1.5 w-full rounded-lg border border-tt-hairline bg-tt-card px-3 py-2 text-[13.5px] text-tt-ink outline-none placeholder:text-tt-ink-3 focus:border-tt-signal/50"
            />
          </div>

          {/* main folder */}
          <div>
            <Label>Main folder — 1 folder</Label>
            <Hint>Single main folder for the project. Required.</Hint>
            <div className="mt-2 rounded-lg border border-tt-hairline bg-tt-panel/60 p-3">
              <div className="flex items-center gap-2">
                <Folder size={14} className="shrink-0 text-tt-ink-3" strokeWidth={1.9} />
                <span className="flex-1 text-[13px] font-medium text-tt-ink">Main folder</span>
                <button
                  type="button"
                  onClick={() => void browseMain()}
                  className="shrink-0 rounded-md border border-tt-hairline bg-tt-card px-3 py-1 text-[12.5px] font-medium text-tt-ink transition-colors hover:border-tt-signal/50 hover:text-tt-signal"
                >
                  Browse
                </button>
              </div>
              <input
                value={mainFolder}
                onChange={(e) => setMainFolder(e.target.value)}
                placeholder="C:\path\to\project"
                aria-label="Main folder path"
                className="font-mono2 mt-2 w-full rounded-md border border-tt-hairline bg-tt-card px-2.5 py-1.5 text-[12px] text-tt-ink outline-none placeholder:text-tt-ink-3 focus:border-tt-signal/50"
              />
            </div>
          </div>

          {/* subfolders */}
          <div>
            <Label>Subfolders — many allowed</Label>
            <Hint>Add multiple subfolders that belong to this project.</Hint>
            <div className="mt-2 rounded-lg border border-tt-hairline bg-tt-panel/60 p-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[13px] font-medium text-tt-ink">
                  Subfolders ({subfolders.length})
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
              {subfolders.length === 0 ? (
                <p className="mt-2 rounded-md bg-tt-card px-2.5 py-2 text-[12.5px] text-tt-ink-3">
                  No subfolders — click Add to pick folders (multi-select allowed).
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {subfolders.map((s) => (
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
                        onClick={() => setSubfolders((prev) => prev.filter((p) => p !== s))}
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
            disabled={!canCreate}
            onClick={() =>
              onCreate({ name: name.trim(), mainFolder: mainFolder.trim(), subfolders })
            }
            className={cn(
              'rounded-lg px-4 py-1.5 text-[13px] font-medium text-tt-ink-invert transition-all',
              canCreate ? 'bg-tt-ink hover:scale-[1.03]' : 'cursor-not-allowed bg-tt-ink-3/60',
            )}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
