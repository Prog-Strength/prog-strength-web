"use client";

import { useState } from "react";
import { getToken } from "@/lib/auth";
import { addTimelineReaction, removeTimelineReaction, type ReactionSummary } from "@/lib/api";
import { useToast } from "@/components/toast";
import { REACTIONS } from "./reactions";
import type { ReactionType } from "@/lib/api";

/**
 * The four reaction buttons (👍 💪 🔥 🎉) with live counts and an active
 * state derived from the post's `reactions.summary` + `reactions.mine`.
 *
 * Toggling is OPTIMISTIC: the local count/active state flips immediately on
 * click, then the PUT/DELETE fires. On API rejection we roll the local
 * state back to what it was before the click and surface a toast. The API
 * is idempotent, so a quick double-toggle can't corrupt the count — but we
 * guard per-type with an in-flight set so a button can't fire two competing
 * requests at once.
 */
export function ReactionBar({ postId, reactions }: { postId: string; reactions: ReactionSummary }) {
  const toast = useToast();
  const [state, setState] = useState<ReactionSummary>(reactions);
  const [pending, setPending] = useState<Set<ReactionType>>(new Set());

  // Flip one reaction `type` on a given state snapshot: toggle `mine` and
  // bump/drop its count, pruning the type from `summary` when it hits zero
  // (the API omits zero-count types). Pure, so it composes cleanly inside a
  // functional setState and can be reused to compute the rollback inverse.
  const flip = (s: ReactionSummary, type: ReactionType): ReactionSummary => {
    const wasActive = s.mine.includes(type);
    const nextMine = wasActive ? s.mine.filter((t) => t !== type) : [...s.mine, type];
    const currentCount = s.summary[type] ?? 0;
    const nextSummary = { ...s.summary, [type]: currentCount + (wasActive ? -1 : 1) };
    if (nextSummary[type] <= 0) delete nextSummary[type];
    return { summary: nextSummary, mine: nextMine };
  };

  const toggle = async (type: ReactionType) => {
    if (pending.has(type)) return;
    const token = getToken();
    if (!token) return;

    // Read `wasActive` from the live state at click time to choose the
    // request (add vs remove). The optimistic write itself is functional —
    // derived from `s` (the current state) — so a concurrent toggle of a
    // DIFFERENT type can't be clobbered by a stale render-closure snapshot.
    const wasActive = state.mine.includes(type);
    setState((s) => flip(s, type));

    setPending((p) => new Set(p).add(type));
    try {
      if (wasActive) {
        await removeTimelineReaction(token, postId, type);
      } else {
        // PUT returns the authoritative summary for the whole post;
        // reconcile to it so our optimistic count can't drift from the
        // server's truth. The echo is post-wide, so it's safe to apply.
        const fresh = await addTimelineReaction(token, postId, type);
        setState(fresh);
      }
    } catch (err: unknown) {
      // Roll back functionally by re-toggling ONLY this type against the
      // current state, so a concurrent successful/optimistic toggle of
      // another type isn't discarded.
      setState((s) => flip(s, type));
      toast.error(err instanceof Error ? err.message : "Could not update reaction");
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(type);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REACTIONS.map(({ type, emoji, label }) => {
        const count = state.summary[type] ?? 0;
        const active = state.mine.includes(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
              active
                ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
