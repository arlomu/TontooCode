import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Custom destructive-confirm modal. No native confirm() involved. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="tt-rise w-full max-w-[400px] rounded-xl bg-tt-card shadow-[0_24px_80px_rgb(15_23_42/0.25)]"
      >
        <div className="px-5 pt-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tt-err-soft text-tt-err">
              <TriangleAlert size={16} strokeWidth={2.1} />
            </span>
            <h2 className="text-[15px] font-bold text-tt-ink">{title}</h2>
          </div>
          <div className="mt-3 text-[13px] leading-relaxed text-tt-ink-2">{message}</div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="rounded-lg border border-tt-hairline bg-tt-card px-4 py-1.5 text-[13px] font-medium text-tt-ink transition-colors hover:border-tt-ink-3"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'rounded-lg bg-tt-err px-4 py-1.5 text-[13px] font-medium text-white transition-all hover:scale-[1.03]',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
