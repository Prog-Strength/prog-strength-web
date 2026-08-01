"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  getDashboardSummary,
  getMe,
  putDashboardLayout,
  type DashboardSummary,
  type ResolvedProfile,
} from "@/lib/api";
import { adaptDashboard, type DashboardData } from "@/lib/dashboard";
import type { TileId } from "@/lib/dashboard-tiles";
import { CommandBar } from "./_components/command-bar";
import { MiniCardSkeleton } from "./_components/mini-card";
import { TileGrid } from "./_components/tile-grid";
import { EditBar } from "./_components/edit-bar";
import { AddTileTray } from "./_components/add-tile-tray";
import { removeTile, addTile } from "./_components/layout-ops";

/**
 * Dashboard — the command-center surface.
 *
 * A single GET /dashboard/summary feeds a grid of customizable, per-domain
 * mini-tiles, each deep-linking into its full page. The persisted layout (an
 * ordered TileId[]) drives which tiles render and in what order; an edit-mode
 * state machine lets the user reorder (drag), remove, and add tiles against a
 * local `draft`, persisting on Done (PUT /dashboard/layout) and discarding on
 * Cancel. The command bar stays pinned above the grid — it is chrome, not a
 * tile — and is never draggable or removable.
 *
 * Data flow mirrors the bodyweight page's fetch+useState pattern: a token
 * guard up front (missing → /login), then getMe → getDashboardSummary keyed on
 * the BROWSER's IANA timezone (the same source the nutrition/chat/running
 * surfaces use — the saved profile tz can be stale and made the dashboard's
 * "today" window disagree with the nutrition page), with a 401 clearing the
 * token and routing to /login. The same fetch runs on mount and again after a
 * successful save so newly-added tiles pick up their data. While the fetch is
 * in flight the grid renders as skeletons rather than a page spinner. Every
 * null section degrades independently to an inviting empty CTA, and an empty
 * layout offers a calm CTA into edit mode so the user can add their first tile.
 */

/** The browser's wall-clock IANA zone — the window anchor for "today"/"this week". */
function browserTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<TileId[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The resolved profile is captured once at load and reused to re-adapt the
  // summary on refetch (units/display copy come from the profile).
  const meRef = useRef<ResolvedProfile | null>(null);

  const handleAuthError = useCallback(
    (err: Error) => {
      if (err.message.toLowerCase().includes("401")) {
        clearToken();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router],
  );

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe(token);
        if (cancelled) return;
        meRef.current = me;
        const summary: DashboardSummary | null = await getDashboardSummary(token, browserTz());
        if (cancelled) return;
        setData(adaptDashboard(summary, me));
      } catch (err) {
        if (cancelled) return;
        if (handleAuthError(err as Error)) return;
        setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, handleAuthError]);

  const handleCommand = useCallback(
    (value: string) => {
      router.push(`/chat?prompt=${encodeURIComponent(value)}`);
    },
    [router],
  );

  const onCustomize = useCallback(() => {
    if (!data) return;
    setDraft(data.layout);
    setSaveError(null);
    setMode("edit");
  }, [data]);

  const onReorder = useCallback((next: TileId[]) => {
    setDraft(next);
  }, []);

  const onRemove = useCallback((id: TileId) => {
    setDraft((d) => removeTile(d, id));
  }, []);

  const onAdd = useCallback((id: TileId) => {
    setDraft((d) => addTile(d, id));
  }, []);

  const onCancel = useCallback(() => {
    setMode("view");
    setSaveError(null);
  }, []);

  const onDone = useCallback(async () => {
    const token = getToken();
    const me = meRef.current;
    if (!token || !me) return;
    setSaving(true);
    setSaveError(null);
    try {
      await putDashboardLayout(token, draft);
      // Refetch so newly-added tiles pick up their (previously unloaded) data.
      const summary: DashboardSummary | null = await getDashboardSummary(token, browserTz());
      setData(adaptDashboard(summary, me));
      setMode("view");
    } catch (err) {
      if (handleAuthError(err as Error)) return;
      // Stay in edit mode with the draft intact; surface the error inline.
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [draft, handleAuthError]);

  const loading = data === null && error === null;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-1 border-b border-[var(--border)] px-3 py-4 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-xs text-[var(--muted)]">
          Your training at a glance — every tile opens the full view.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {loading ? (
            <>
              <CommandBar onSubmit={handleCommand} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <MiniCardSkeleton key={i} />
                ))}
              </div>
            </>
          ) : data ? (
            <>
              <CommandBar onSubmit={handleCommand} />
              <EditBar
                mode={mode}
                saving={saving}
                saveError={saveError}
                onCustomize={onCustomize}
                onCancel={onCancel}
                onDone={onDone}
              />
              {mode === "view" && data.layout.length === 0 ? (
                <EmptyDashboard onCustomize={onCustomize} />
              ) : (
                <>
                  <TileGrid
                    layout={mode === "edit" ? draft : data.layout}
                    data={data}
                    mode={mode}
                    onReorder={onReorder}
                    onRemove={onRemove}
                  />
                  {mode === "edit" && <AddTileTray draft={draft} onAdd={onAdd} />}
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

/**
 * EmptyDashboard — the calm view-mode CTA shown when the persisted layout has
 * no tiles. It routes the user straight into edit mode, where the add-tile tray
 * lists every available tile.
 */
function EmptyDashboard({ onCustomize }: { onCustomize: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--foreground)]">Your dashboard is empty</p>
      <p className="max-w-sm text-xs text-[var(--muted)]">
        Add tiles to track your running, lifting, steps, nutrition, and more — each opens its full
        view.
      </p>
      <button
        type="button"
        onClick={onCustomize}
        className="mt-1 rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90"
      >
        Add tiles
      </button>
    </div>
  );
}
