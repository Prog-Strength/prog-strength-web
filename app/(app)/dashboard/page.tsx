"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  getDashboardSummary,
  getMe,
  putDashboardLayout,
  type DashboardSection,
  type DashboardSummary,
  type ResolvedProfile,
} from "@/lib/api";
import { adaptDashboard, type DashboardData } from "@/lib/dashboard";
import type { TileId } from "@/lib/dashboard-tiles";
import { CommandBar } from "@/components/command-bar";
import { MiniCardSkeleton } from "./_components/mini-card";
import { SectionList } from "./_components/section-list";
import { EditBar } from "./_components/edit-bar";
import { AddTileTray } from "./_components/add-tile-tray";
import {
  MAX_SECTIONS,
  addTile,
  allTileIds,
  createSection,
  deleteSection,
  removeTile,
  renameSection,
  toggleCollapsed,
} from "./_components/layout-ops";

/**
 * Dashboard — the command-center surface.
 *
 * A single GET /dashboard/summary feeds a grid of customizable, per-domain
 * mini-tiles, each deep-linking into its full page. The persisted layout is an
 * ordered list of SECTIONS, each owning its ordered tiles; a section renders as
 * a header over a hairline rule with its tiles beneath, and an UNTITLED section
 * renders as a bare grid with no header at all (which is what every layout
 * predating sections was migrated into, so an untouched dashboard looks exactly
 * as it did). An edit-mode state machine lets the user create/rename/reorder/
 * delete sections, and reorder, remove, add, and drag tiles BETWEEN sections,
 * all against a local `draft`, persisting on Done (PUT /dashboard/layout) and
 * discarding on Cancel. The command bar stays pinned above the sections — it is
 * chrome, not a tile — and is never draggable or removable.
 *
 * Collapse/expand is the one mutation that happens in VIEW mode, outside that
 * draft machine: it applies optimistically and writes immediately, reverting if
 * the write fails. See onToggleCollapsedInView.
 *
 * Data flow mirrors the bodyweight page's fetch+useState pattern: a token
 * guard up front (missing → /login), then getMe → getDashboardSummary keyed on
 * the BROWSER's IANA timezone (the same source the nutrition/chat/running
 * surfaces use — the saved profile tz can be stale and made the dashboard's
 * "today" window disagree with the nutrition page), with a 401 clearing the
 * token and routing to /login. The same fetch runs on mount and again after a
 * successful save so newly-added tiles pick up their data. While the fetch is
 * in flight the grid renders as skeletons rather than a page spinner. Every
 * null section degrades independently to an inviting empty CTA, and a layout
 * with no tiles at all offers a calm CTA into edit mode.
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
  const [draft, setDraft] = useState<DashboardSection[]>([]);
  const [addTarget, setAddTarget] = useState<string>("");
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
    const sections = data.sections;
    setDraft(sections);
    setAddTarget(sections[sections.length - 1]?.id ?? "");
    setSaveError(null);
    setMode("edit");
  }, [data]);

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

  // --- Edit-mode draft mutations -------------------------------------------

  const onDraftChange = useCallback((next: DashboardSection[]) => setDraft(next), []);

  const onCreateSection = useCallback(() => {
    setDraft((d) => {
      const next = createSection(d);
      // Point the tray at the section the user just made — it is almost
      // certainly what they want to fill.
      const created = next[next.length - 1];
      if (created && next.length > d.length) setAddTarget(created.id);
      return next;
    });
  }, []);

  const onRenameSection = useCallback((id: string, title: string) => {
    setDraft((d) => renameSection(d, id, title));
  }, []);

  /**
   * Deleting a section takes its tiles with it, so it is guarded by a confirm.
   * A section with no tiles has nothing to lose and deletes straight away.
   */
  const onDeleteSection = useCallback((id: string) => {
    setDraft((d) => {
      const section = d.find((s) => s.id === id);
      if (!section) return d;
      if (section.tile_ids.length > 0) {
        const name = section.title || "this section";
        const count = section.tile_ids.length;
        const ok = window.confirm(
          `Delete ${name}? Its ${count} ${count === 1 ? "tile" : "tiles"} will be removed from your dashboard. You can add them back from the tile list.`,
        );
        if (!ok) return d;
      }
      const next = deleteSection(d, id);
      setAddTarget((t) => (next.some((s) => s.id === t) ? t : (next[next.length - 1]?.id ?? "")));
      return next;
    });
  }, []);

  const onAddTileTo = useCallback((sectionId: string) => setAddTarget(sectionId), []);

  const onAdd = useCallback((id: TileId, sectionId: string) => {
    setDraft((d) => addTile(d, id, sectionId));
  }, []);

  const onRemoveTile = useCallback((id: TileId) => {
    setDraft((d) => removeTile(d, id));
  }, []);

  const onToggleCollapsedInDraft = useCallback((id: string) => {
    setDraft((d) => toggleCollapsed(d, id));
  }, []);

  // --- The view-mode write path --------------------------------------------

  /**
   * Collapse/expand in view mode is the only mutation outside the draft
   * machine, so it writes on its own: apply optimistically, PUT, and put the
   * old sections back if the write fails. A failed collapse is a cosmetic
   * problem, so it reuses the same inline error slot rather than blocking.
   */
  const onToggleCollapsedInView = useCallback(
    async (id: string) => {
      const token = getToken();
      const me = meRef.current;
      if (!token || !me || !data) return;
      const before = data.sections;
      const next = toggleCollapsed(before, id);
      setData({ ...data, sections: next });
      setSaveError(null);
      try {
        await putDashboardLayout(token, next);
      } catch (err) {
        if (handleAuthError(err as Error)) return;
        setData((d) => (d ? { ...d, sections: before } : d));
        setSaveError((err as Error).message);
      }
    },
    [data, handleAuthError],
  );

  const sections = mode === "edit" ? draft : (data?.sections ?? []);
  // Flattening 19 tiles at most — not worth a useMemo, which would anyway
  // recompute every render since `sections` is a fresh conditional each time.
  const tileCount = allTileIds(sections).length;
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
              {mode === "view" && tileCount === 0 ? (
                <EmptyDashboard onCustomize={onCustomize} />
              ) : (
                <>
                  <SectionList
                    sections={sections}
                    data={data}
                    mode={mode}
                    onChange={onDraftChange}
                    onRenameSection={onRenameSection}
                    onDeleteSection={onDeleteSection}
                    onAddTileTo={onAddTileTo}
                    onToggleCollapsed={
                      mode === "edit" ? onToggleCollapsedInDraft : onToggleCollapsedInView
                    }
                    onRemoveTile={onRemoveTile}
                  />
                  {mode === "edit" && (
                    <>
                      <button
                        type="button"
                        onClick={onCreateSection}
                        disabled={draft.length >= MAX_SECTIONS}
                        className="self-start rounded-full border border-dashed border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add section
                      </button>
                      <AddTileTray
                        sections={draft}
                        targetSectionId={addTarget}
                        onTargetChange={setAddTarget}
                        onAdd={onAdd}
                      />
                    </>
                  )}
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
 * no tiles in any section. It routes the user straight into edit mode, where
 * the add-tile tray lists every available tile.
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
