"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ToastViewport } from "./toast-viewport";
import type { Toast, ToastContextValue, ToastVariant } from "./types";

const ToastContext = createContext<ToastContextValue | null>(null);

// Success / info banners auto-dismiss; errors persist until the user
// dismisses them. Errors are rare enough that the slightly extra
// visual cost is worth keeping the message available for re-read
// after the modal closes.
const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  error: 0,
};

/**
 * App-wide toast provider. Wrap `{children}` in the root layout so
 * any page (server or client) can pull `useToast()` from a child
 * client component.
 *
 * The viewport renders inline (not via a portal). Next 16 + React 19
 * handle the fixed-positioned viewport just fine without a portal,
 * and avoiding the portal keeps SSR rendering predictable.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, variant, message }]);
      const ms = AUTO_DISMISS_MS[variant];
      if (ms > 0) {
        window.setTimeout(() => dismiss(id), ms);
      }
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      success: (m: string) => push("success", m),
      error: (m: string) => push("error", m),
      info: (m: string) => push("info", m),
      dismiss,
    }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Returns the toast actions for the current tree. Throws if used
 * outside a `<ToastProvider>` so a missing provider surfaces
 * immediately at the failing component, not as a silent no-op.
 */
export function useToast(): Omit<ToastContextValue, "toasts"> {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  const { success, error, info, dismiss } = ctx;
  return { success, error, info, dismiss };
}
