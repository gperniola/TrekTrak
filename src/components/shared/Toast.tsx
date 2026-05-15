'use client';

import { useEffect } from 'react';
import { useNotificationStore, type Toast as ToastType, type ToastVariant } from '@/stores/notificationStore';

const VARIANT_STYLES: Record<ToastVariant, { bg: string; text: string; icon: string }> = {
  success: { bg: 'bg-green-900/95 border-green-600', text: 'text-green-100', icon: '✓' },
  info:    { bg: 'bg-gray-800/95 border-gray-600',  text: 'text-gray-100',  icon: 'ⓘ' },
  warning: { bg: 'bg-amber-900/95 border-amber-600', text: 'text-amber-100', icon: '!' },
  error:   { bg: 'bg-red-900/95 border-red-600',    text: 'text-red-100',   icon: '✕' },
};

function ToastItem({ toast }: { toast: ToastType }) {
  const dismissToast = useNotificationStore((s) => s.dismissToast);
  const style = VARIANT_STYLES[toast.variant];

  useEffect(() => {
    if (toast.duration == null) return;
    const timer = setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismissToast]);

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 ${style.bg} ${style.text} border rounded-lg px-3 py-2 shadow-xl pointer-events-auto`}
    >
      <span aria-hidden className="font-bold leading-tight pt-0.5">{style.icon}</span>
      <span className="text-sm leading-snug flex-1 break-words">{toast.message}</span>
      <button
        onClick={() => dismissToast(toast.id)}
        aria-label="Chiudi notifica"
        className="text-current opacity-60 hover:opacity-100 text-xs leading-none px-1"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Container that renders all active toasts. Mount once near the root of the app.
 * Toasts stack bottom-center on mobile, top-right on desktop.
 */
export function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[1400] pointer-events-none flex flex-col gap-2 px-3 max-w-sm w-[calc(100%-1.5rem)]
                 bottom-3 left-1/2 -translate-x-1/2
                 lg:bottom-auto lg:left-auto lg:translate-x-0 lg:top-3 lg:right-3"
      aria-label="Notifiche"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
