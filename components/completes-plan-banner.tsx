"use client";

import { useState } from "react";
import type { PlannedWorkout } from "@/lib/api";
import { unlinkPlannedWorkout } from "@/lib/api";
import { getToken } from "@/lib/auth";

/**
 * On a logged session's detail page, surfaces the plan it fulfilled:
 * "✓ Completes your planned {name}". The Unlink button severs the
 * reconciliation (the plan reverts to merely planned) and dismisses the
 * banner. A best-effort enhancement — the parent only renders it once the
 * plan lookup succeeds.
 */
export function CompletesPlanBanner({
  plan,
  onUnlinked,
}: {
  plan: PlannedWorkout;
  onUnlinked?: () => void;
}) {
  const [unlinking, setUnlinking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  const label = plan.name?.trim()
    ? `your planned ${plan.name.trim()}`
    : plan.activity_kind === "run"
      ? "your planned run"
      : "your planned workout";

  const handleUnlink = async () => {
    const token = getToken();
    if (!token) return;
    setUnlinking(true);
    setError(null);
    try {
      await unlinkPlannedWorkout(token, plan.id);
      setDismissed(true);
      onUnlinked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlink failed");
      setUnlinking(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
      <span className="text-[var(--foreground)]">✓ Completes {label}</span>
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
        <button
          type="button"
          onClick={handleUnlink}
          disabled={unlinking}
          className="text-xs font-medium text-[var(--muted)] transition hover:text-[var(--danger)] disabled:opacity-50"
        >
          {unlinking ? "Unlinking…" : "Unlink"}
        </button>
      </div>
    </div>
  );
}
