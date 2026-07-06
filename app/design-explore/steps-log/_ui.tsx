/**
 * DX steps-log — shared design-system ATOMS only.
 *
 * These are the small, already-shipped visual atoms (the per-day mini-ring, the
 * edit/delete icon buttons, the Log-steps toolbar) that every variant reuses so
 * the five variants diverge on *layout / structure / density* — not on
 * re-drawing a pencil icon or re-deciding the ring. Anything bigger than an atom
 * (how weeks/months are grouped, paginated, and summarised) lives inside each
 * variant, duplicated on purpose.
 */
"use client";

import { dayPct, fmtSteps } from "./_data";

// --- per-day mini-ring (from the shipped ring-row) ------------------------

export function MiniRing({
  steps,
  goal,
  size = 24,
}: {
  steps: number;
  goal: number | null;
  size?: number;
}) {
  const pct = dayPct(steps, goal);
  const hit = goal !== null && steps >= goal;
  const r = 8;
  const c = 2 * Math.PI * r;
  const frac = pct === null ? 0 : Math.min(pct, 100) / 100;
  return (
    <svg
      viewBox="0 0 22 22"
      className="-rotate-90 shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3" />
      {pct !== null && (
        <circle
          cx="11"
          cy="11"
          r={r}
          fill="none"
          stroke={hit ? "var(--success)" : "var(--accent)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      )}
    </svg>
  );
}

/** A larger summary ring used by week/month headers that lean on a ring. */
export function SummaryRing({
  pct,
  center,
  cleared,
  size = 56,
  stroke = 6,
}: {
  pct: number | null;
  center: string;
  cleared: boolean;
  size?: number;
  stroke?: number;
}) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const frac = pct === null ? 0 : Math.min(pct, 100) / 100;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {pct !== null && (
          <circle
            cx="26"
            cy="26"
            r={r}
            fill="none"
            stroke={cleared ? "var(--success)" : "var(--accent)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
          />
        )}
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums tracking-[-0.03em]">
        {center}
      </span>
    </div>
  );
}

// --- day-row edit/delete cluster ------------------------------------------

export function DayActions() {
  return (
    <div className="inline-flex items-center gap-0.5">
      <IconButton aria-label="Edit steps" tone="muted">
        <PencilIcon />
      </IconButton>
      <IconButton aria-label="Delete steps" tone="danger">
        <TrashIcon />
      </IconButton>
    </div>
  );
}

export function IconButton({
  tone,
  "aria-label": ariaLabel,
  children,
}: {
  tone: "muted" | "danger";
  "aria-label": string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "text-[var(--danger)]"
      : "text-[var(--muted)] hover:text-[var(--foreground)]";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center rounded p-1 transition hover:bg-white/5 ${toneClass}`}
    >
      {children}
    </button>
  );
}

// --- log toolbar (identical across variants — the write affordance must
//     never get buried behind collapsed chrome) ---------------------------

export function LogToolbar({ goal }: { goal: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)] transition hover:opacity-70"
      >
        <PencilIcon />
        Log steps
      </button>
      <button
        type="button"
        aria-label={goal ? `Goal ${fmtSteps(goal)} steps — tap to edit` : "Set steps goal"}
        className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-sm transition hover:bg-white/5"
      >
        <TargetIcon />
        <span className="hidden text-[var(--muted)] sm:inline">Goal:</span>
        {goal ? (
          <span className="font-semibold tabular-nums">{fmtSteps(goal)}</span>
        ) : (
          <span className="italic text-[var(--muted)]">Set steps goal</span>
        )}
      </button>
    </div>
  );
}

// --- icons ----------------------------------------------------------------

export function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function TargetIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-[var(--success)]"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
