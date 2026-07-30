/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { CalendarEvent } from "@/components/calendar/types";
import type { RunningSession } from "@/lib/api";
import { DayCell } from "./day-cell";
import { DayDigest } from "./day-digest";
import { RunDigest } from "./run-digest";

/**
 * A logged HIKE must never read — or route — as a run on the calendar. The
 * unified activity model gives runs and hikes the same `RunningSession`
 * shape, so every calendar surface has to branch on `activity_type` rather
 * than assume "endurance session == run". These tests pin the three ways
 * that assumption used to leak: pill/rail color, click-through target, and
 * the summary copy.
 */

const DAY = new Date(2026, 5, 16);

function makeSession(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    id: "s-1",
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: "src-1",
    name: "Morning Run",
    start_time: "2026-06-16T07:00:00Z",
    distance_meters: 8046.72,
    raw_distance_meters: 8046.72,
    environment: "outdoor",
    duration_seconds: 2520,
    avg_pace_sec_per_km: 313,
    best_pace_sec_per_km: 290,
    avg_heart_rate_bpm: 152,
    max_heart_rate_bpm: 171,
    total_calories: 480,
    elevation_gain_meters: 640,
    elevation_loss_meters: null,
    elevation_high_meters: null,
    elevation_low_meters: null,
    created_at: "2026-06-16T08:00:00Z",
    ...overrides,
  };
}

const hike = makeSession({
  id: "h-1",
  activity_type: "hiking",
  name: "Bear Peak",
  avg_pace_sec_per_km: null,
});

function noop() {}

function renderCell(
  events: CalendarEvent[],
  overrides: Partial<React.ComponentProps<typeof DayCell>> = {},
) {
  return render(
    <DayCell
      day={DAY}
      inMonth
      isToday={false}
      isSelected={false}
      events={events}
      onSelectDay={noop}
      onNavigateWorkout={noop}
      onNavigateActivity={noop}
      onOpenPlanned={noop}
      {...overrides}
    />,
  );
}

function renderDigest(
  events: CalendarEvent[],
  overrides: Partial<React.ComponentProps<typeof DayDigest>> = {},
) {
  return render(
    <DistanceUnitProvider>
      <DayDigest
        date={DAY}
        events={events}
        exerciseMap={new Map()}
        onNavigateWorkout={noop}
        onNavigateActivity={noop}
        {...overrides}
      />
    </DistanceUnitProvider>,
  );
}

describe("month-grid hike pill", () => {
  it("fills with the hike token, not the run token", () => {
    renderCell([{ kind: "run", startMs: 1, run: hike }]);
    const pill = screen.getByRole("button", { name: "Bear Peak" });
    expect(pill.style.borderColor).toContain("discipline-hike-dot");
    expect(pill.style.backgroundColor).toContain("discipline-hike-bg");
    expect(pill.style.color).toContain("discipline-hike-fg");
  });

  it("still fills a run with the run token", () => {
    renderCell([{ kind: "run", startMs: 1, run: makeSession() }]);
    const pill = screen.getByRole("button", { name: "Morning Run" });
    expect(pill.style.borderColor).toContain("discipline-run-dot");
  });

  it("hands the whole session to the navigate callback so the caller can route by type", () => {
    const onNavigateActivity = vi.fn();
    renderCell([{ kind: "run", startMs: 1, run: hike }], { onNavigateActivity });
    fireEvent.click(screen.getByRole("button", { name: "Bear Peak" }));
    expect(onNavigateActivity).toHaveBeenCalledWith(hike);
  });

  it("counts a hike as a hike in the cell's aria label", () => {
    renderCell([{ kind: "run", startMs: 1, run: hike }]);
    expect(screen.getByLabelText(/1 hike$/)).toBeInTheDocument();
  });
});

describe("day-digest hike banner", () => {
  it("rails with the hike token and leads with vertical gain instead of pace", () => {
    const { container } = renderDigest([{ kind: "run", startMs: 1, run: hike }]);
    const rail = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(rail.style.backgroundColor).toContain("discipline-hike-dot");
    // 640 m → 2100 ft of gain; a hike has no pace line.
    expect(screen.getByText(/2,100 ft/)).toBeInTheDocument();
    expect(screen.queryByText(/\/mi/)).not.toBeInTheDocument();
  });

  it("hands the whole session to the navigate callback", () => {
    const onNavigateActivity = vi.fn();
    renderDigest([{ kind: "run", startMs: 1, run: hike }], { onNavigateActivity });
    fireEvent.click(screen.getByRole("button", { name: /Bear Peak/ }));
    expect(onNavigateActivity).toHaveBeenCalledWith(hike);
  });

  it("counts a hike as a hike in the summary line", () => {
    renderDigest([{ kind: "run", startMs: 1, run: hike }]);
    expect(screen.getByText(/1 activity · 1 hike/)).toBeInTheDocument();
  });
});

describe("digest dropdown link", () => {
  it("links a hike to its hike detail page", () => {
    render(
      <DistanceUnitProvider>
        <RunDigest run={hike} />
      </DistanceUnitProvider>,
    );
    const link = screen.getByRole("link", { name: /view full hike details/i });
    expect(link).toHaveAttribute("href", "/hiking/h-1");
  });

  it("links a run to its run detail page", () => {
    render(
      <DistanceUnitProvider>
        <RunDigest run={makeSession({ id: "r-9" })} />
      </DistanceUnitProvider>,
    );
    const link = screen.getByRole("link", { name: /view full run details/i });
    expect(link).toHaveAttribute("href", "/running/r-9");
  });
});
