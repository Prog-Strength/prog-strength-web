/**
 * Placeholder. Will eventually render a month/week calendar with
 * workout days marked, so the user can see streaks and recovery gaps
 * at a glance. For now it's a stub so the sidebar link resolves.
 */
export default function CalendarPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-[var(--muted)]">
          Coming soon. This page will plot your workouts on a calendar so
          training frequency and rest days are visible at a glance.
        </p>
      </div>
    </main>
  );
}
