import { useEffect, useRef } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Site-styled confirmation dialog (same look as the admin delete confirmations).
 * Replaces the browser's window.confirm on public pages.
 * - Escape, the close button, "keep" and a click on the backdrop all cancel.
 * - Focus starts on the safe ("keep") button and returns to the opener when closed.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  closeLabel = 'Close',
  busy = false,
  onConfirm,
  onCancel,
  testId = 'confirm-dialog',
}) {
  const keepRef = useRef(null);
  const latest = useRef({ onCancel, busy });
  useEffect(() => { latest.current = { onCancel, busy }; });

  // Runs once per opening: focus the safe button, listen for Escape, give focus back on close.
  useEffect(() => {
    const opener = document.activeElement;
    keepRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !latest.current.busy) latest.current.onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 sm:p-6 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        aria-describedby={`${testId}-body`}
        data-testid={testId}
        className="my-auto w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h2 id={`${testId}-title`} className="text-lg font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
            {title}
          </h2>
          <button type="button" onClick={onCancel} disabled={busy} className="p-1.5 rounded-lg hover:bg-secondary cursor-pointer disabled:opacity-50" aria-label={closeLabel}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <p id={`${testId}-body`} className="text-sm text-foreground leading-relaxed">{body}</p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              ref={keepRef}
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary cursor-pointer disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              data-testid={`${testId}-confirm`}
              className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
