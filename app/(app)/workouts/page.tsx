/**
 * Placeholder. Will eventually show the user's workouts over a chosen
 * time range with metrics (volume, duration, set count, etc.) — see
 * the sidebar conversation for the plan. For now it's a stub so the
 * sidebar link resolves.
 */
export default function WorkoutsPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Workouts</h1>
        <p className="text-sm text-[var(--muted)]">
          Coming soon. This page will list your training sessions with
          duration, volume, and trend metrics.
        </p>
      </div>
    </main>
  );
}
