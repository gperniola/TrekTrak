'use client';

import { useEffect, useRef } from 'react';
import { useNotificationStore, type ConfirmRequest } from '@/stores/notificationStore';

const VARIANT_STYLES: Record<ConfirmRequest['variant'], { confirmBtn: string; icon: string; iconColor: string }> = {
  confirm: { confirmBtn: 'bg-green-600 hover:bg-green-500 text-white', icon: '?', iconColor: 'text-green-400' },
  info:    { confirmBtn: 'bg-blue-600 hover:bg-blue-500 text-white',  icon: 'ⓘ', iconColor: 'text-blue-400' },
  error:   { confirmBtn: 'bg-red-600 hover:bg-red-500 text-white',    icon: '!', iconColor: 'text-red-400' },
};

function ConfirmDialog({ request }: { request: ConfirmRequest }) {
  const resolveConfirm = useNotificationStore((s) => s.resolveConfirm);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const style = VARIANT_STYLES[request.variant];

  const accept = () => resolveConfirm(request.id, true);
  const dismiss = () => resolveConfirm(request.id, false);

  useEffect(() => {
    // For destructive actions (error variant), focus the Cancel button so
    // accidental Enter doesn't trigger an irreversible action.
    if (request.variant === 'error') cancelBtnRef.current?.focus();
    else confirmBtnRef.current?.focus();
  }, [request.variant]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[1500] bg-black/60 flex items-center justify-center px-3"
      onClick={dismiss}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={request.title ? `confirm-title-${request.id}` : undefined}
        aria-describedby={`confirm-body-${request.id}`}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-5 outline-none"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className={`text-2xl ${style.iconColor} font-bold leading-none mt-0.5`} aria-hidden>{style.icon}</div>
          <div className="flex-1">
            {request.title && (
              <h2 id={`confirm-title-${request.id}`} className="text-base font-bold text-white mb-1">
                {request.title}
              </h2>
            )}
            <p id={`confirm-body-${request.id}`} className="text-sm text-gray-300 leading-relaxed">
              {request.message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            ref={cancelBtnRef}
            onClick={dismiss}
            className="px-4 py-2 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-100"
          >
            {request.cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={accept}
            className={`px-4 py-2 rounded text-sm font-medium ${style.confirmBtn}`}
          >
            {request.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Container that renders the topmost active confirm dialog. Mount once near the root of the app.
 * Multiple pending confirms stack (last one shown first).
 */
export function ConfirmModalContainer() {
  const confirms = useNotificationStore((s) => s.confirms);
  if (confirms.length === 0) return null;
  const top = confirms[confirms.length - 1];
  return <ConfirmDialog request={top} />;
}
