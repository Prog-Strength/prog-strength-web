"use client";

/**
 * Running max-effort estimate detail. For one standard distance, this
 * view projects the time the user could run today (with a confidence
 * band), compares it to their actual best, charts how the estimate has
 * moved as they logged efforts, and lists the attempts behind it.
 *
 * URL-driven: the `[distanceKey]` route param selects the distance (the
 * DistanceSwitcher navigates between the six standard keys via
 * `router.replace`). A non-standard key renders a not-found message.
 *
 * Data comes from a single TanStack Query against
 * `getRunningMaxEffort(token, distanceKey)`. When the estimate is null
 * (basis "insufficient_data"), we render an empty state instead of the
 * tiles/chart so the page never shows a phantom projection.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { clearToken, getToken } from "@/lib/auth";
import { getRunningMaxEffort } from "@/lib/api";
import { DistanceSwitcher } from "./_components/DistanceSwitcher";
import { EstimateStatTiles } from "./_components/EstimateStatTiles";
import { EstimateChart } from "./_components/EstimateChart";
import { AttemptsTable } from "./_components/AttemptsTable";
import { distanceLabel, isStandardDistance } from "./_components/distances";

function isUnauthorized(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes("401");
}

export default function RunningMaxEffortPage() {
  const router = useRouter();
  const params = useParams<{ distanceKey: string }>();
  const distanceKey = params.distanceKey;
  const valid = isStandardDistance(distanceKey);

  const query = useQuery({
    queryKey: ["running-max-effort", distanceKey],
    enabled: valid,
    queryFn: () => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return Promise.reject(new Error("not authenticated"));
      }
      return getRunningMaxEffort(token, distanceKey);
    },
    staleTime: 60_000,
  });

  // 401 bounces to /login, clearing the dead token first. Run as an effect
  // so navigation/token mutation stays out of the render phase.
  const queryError = query.error;
  useEffect(() => {
    if (queryError && isUnauthorized(queryError)) {
      clearToken();
      router.replace("/login");
    }
  }, [queryError, router]);

  if (!valid) {
    return (
      <main className="flex flex-1 flex-col overflow-hidden">
        <Header distanceKey={distanceKey} label="Unknown distance" showSwitcher={false} />
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-5xl">
            <EmptyHint
              title="Unknown distance"
              body="That isn't one of the standard distances we estimate. Pick one from the Progress page."
            />
          </div>
        </div>
      </main>
    );
  }

  const detail = query.data;
  const label = detail?.distance_label || distanceLabel(distanceKey);
  const errorMessage =
    queryError && !isUnauthorized(queryError) && queryError instanceof Error
      ? queryError.message
      : null;

  // The estimate is absent when there isn't enough data to fit a model.
  // basis "insufficient_data" is the canonical signal; a null estimate is
  // the same thing defensively.
  const insufficient =
    !!detail && (detail.estimate === null || detail.estimate.basis === "insufficient_data");

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <Header distanceKey={distanceKey} label={label} showSwitcher />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {errorMessage && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {errorMessage}
            </div>
          )}

          {query.isPending && <p className="text-sm text-[var(--muted)]">Loading estimate…</p>}

          {detail && insufficient && (
            <EmptyHint
              title="Not enough data yet"
              body={`Log a run at this distance to see an estimate for the ${label}. Once you've covered it — or run efforts at nearby distances — we'll project your max-effort time here.`}
            />
          )}

          {detail && !insufficient && (
            <div className="flex flex-col gap-4">
              <EstimateStatTiles detail={detail} />
              <EstimateChart history={detail.estimate_history} attempts={detail.attempts} />
              <AttemptsTable attempts={detail.attempts} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Header({
  distanceKey,
  label,
  showSwitcher,
}: {
  distanceKey: string;
  label: string;
  showSwitcher: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-4">
      <div className="flex flex-col gap-1">
        <Link href="/progress" className="text-xs text-[var(--accent)] hover:underline">
          ← Progress
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">
          Max-Effort Estimate
          <span className="ml-2 text-base font-normal text-[var(--muted)]">{label}</span>
        </h1>
      </div>
      {showSwitcher && <DistanceSwitcher distanceKey={distanceKey} />}
    </header>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{body}</p>
    </div>
  );
}
