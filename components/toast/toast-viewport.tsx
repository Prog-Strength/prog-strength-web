"use client";

import type { Toast, ToastVariant } from "./types";

/**
 * Fixed top-center stack that renders the active toast queue. The
 * provider passes the queue + a dismiss callback in; this component is
 * purely presentational so the visual choices live in one place.
 *
 * Stacking order: oldest at the top of the stack, newest at the
 * bottom. A user dismissing the oldest banner causes the rest to
 * reflow upward, which matches the natural reading order — the
 * banner that's been visible longest is the one most likely to be
 * dismissed first.
 *
 * Color palette is inline rather than via MACRO_COLORS because the
 * meanings ("success", "error") are semantic, not nutrition-domain;
 * the success green happens to match emerald-300 by visual fit, not
 * by shared reference. Don't refactor to import from macro-colors —
 * the variants will drift independently from the macros over time.
 */
export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-4 z-50 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastBanner key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastBanner({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const palette = TONES[toast.variant];
  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      className="pointer-events-auto flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm shadow-lg"
      style={{ borderLeftWidth: "3px", borderLeftColor: palette.accent }}
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: palette.iconBg, color: palette.accent }}
      >
        {palette.glyph}
      </span>
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        ✕
      </button>
    </div>
  );
}

const TONES: Record<ToastVariant, { accent: string; iconBg: string; glyph: string }> = {
  success: { accent: "#6ee7b7", iconBg: "rgba(110, 231, 183, 0.16)", glyph: "✓" },
  error: { accent: "#f87171", iconBg: "rgba(248, 113, 113, 0.16)", glyph: "!" },
  info: { accent: "#3b82f6", iconBg: "rgba(59, 130, 246, 0.16)", glyph: "i" },
};
