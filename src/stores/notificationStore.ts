'use client';

import { create } from 'zustand';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Duration in ms before auto-dismiss. null = sticky. Default 3000. */
  duration: number | null;
}

export interface ConfirmRequest {
  id: string;
  title?: string;
  message: string;
  variant: 'confirm' | 'info' | 'error';
  confirmText: string;
  cancelText: string;
  resolve: (value: boolean) => void;
}

interface NotificationState {
  toasts: Toast[];
  confirms: ConfirmRequest[];

  pushToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;

  /** Push a confirm dialog and return a Promise that resolves to true (Conferma) or false (Annulla). */
  requestConfirm: (req: Omit<ConfirmRequest, 'id' | 'resolve'>) => Promise<boolean>;
  /** Called by the confirm modal UI when the user clicks Conferma or Annulla, or dismisses. */
  resolveConfirm: (id: string, value: boolean) => void;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  confirms: [],

  pushToast: (toast) => {
    const id = makeId();
    set((s) => ({ toasts: [...s.toasts, { id, ...toast, duration: toast.duration ?? 3000 }] }));
    return id;
  },
  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  requestConfirm: (req) => {
    return new Promise<boolean>((resolve) => {
      const id = makeId();
      set((s) => ({ confirms: [...s.confirms, { id, resolve, ...req }] }));
    });
  },
  resolveConfirm: (id, value) => {
    const entry = get().confirms.find((c) => c.id === id);
    if (entry) entry.resolve(value);
    set((s) => ({ confirms: s.confirms.filter((c) => c.id !== id) }));
  },
}));

/**
 * Convenience helpers. Use these from any callsite (UI or library) without React hooks.
 *
 * Example:
 *   import { toast, confirm } from '@/stores/notificationStore';
 *   toast.success('Itinerario salvato');
 *   if (await confirm({ message: 'Eliminare?' })) deleteIt();
 */
export const toast = {
  success: (message: string, duration?: number) =>
    useNotificationStore.getState().pushToast({ message, variant: 'success', duration: duration ?? 3000 }),
  info: (message: string, duration?: number) =>
    useNotificationStore.getState().pushToast({ message, variant: 'info', duration: duration ?? 3000 }),
  warning: (message: string, duration?: number) =>
    useNotificationStore.getState().pushToast({ message, variant: 'warning', duration: duration ?? 4000 }),
  error: (message: string, duration?: number) =>
    useNotificationStore.getState().pushToast({ message, variant: 'error', duration: duration ?? 5000 }),
};

export function confirm(opts: {
  title?: string;
  message: string;
  variant?: 'confirm' | 'info' | 'error';
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  return useNotificationStore.getState().requestConfirm({
    title: opts.title,
    message: opts.message,
    variant: opts.variant ?? 'confirm',
    confirmText: opts.confirmText ?? 'Conferma',
    cancelText: opts.cancelText ?? 'Annulla',
  });
}
