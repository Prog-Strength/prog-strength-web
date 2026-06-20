/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { PersonalRecord } from "@/lib/api";
import { PRLedger } from "./PRLedger";
import { STANDARD_DISTANCES, type RunningLedgerItem } from "./readiness";

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getMe: vi.fn(async () => {
    throw new Error("no /me");
  }),
}));

const mkLift = (id: string, weight: number | null, est: number | null): PersonalRecord => ({
  exercise_id: id,
  exercise_name: id,
  workout_id: weight === null ? null : "wk",
  weight,
  reps: 3,
  unit: "lb",
  achieved_at: "2026-04-01T00:00:00Z",
  current_estimated_1rm: est,
  estimated_1rm_unit: "lb",
  recent_estimated_1rm_points: null,
});

const lifts = [
  mkLift("Bench", 300, 305),
  mkLift("Squat", 300, 360),
  mkLift("Deadlift", null, null),
];

const runItems: RunningLedgerItem[] = STANDARD_DISTANCES.map((d) => ({
  key: d.key,
  label: d.label,
  best:
    d.key === "5k" || d.key === "10k"
      ? {
          distance_key: d.key,
          distance_label: d.label,
          distance_meters: 1,
          duration_seconds: 1184.7,
          pace_sec_per_km: 236.9,
          activity_id: "a",
          activity_start_time: "2026-04-18T00:00:00Z",
        }
      : null,
}));

const wrap = (ui: React.ReactElement) => render(<DistanceUnitProvider>{ui}</DistanceUnitProvider>);

describe("PRLedger lifts", () => {
  it("ranks the most-due lift to the top row", () => {
    wrap(
      <PRLedger view="lifts" lifts={lifts} state="ready" selectedId="Squat" onSelect={() => {}} />,
    );
    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Squat"); // biggest gap (300→360)
  });

  it("renders the untested lift dimmed and non-selectable", () => {
    wrap(
      <PRLedger view="lifts" lifts={lifts} state="ready" selectedId="Squat" onSelect={() => {}} />,
    );
    expect(screen.getByText("Deadlift").closest("button")).toBeDisabled();
  });

  it("fires onSelect and marks aria-current on the selected row", () => {
    const onSelect = vi.fn();
    wrap(
      <PRLedger view="lifts" lifts={lifts} state="ready" selectedId="Squat" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText("Bench").closest("button")!);
    expect(onSelect).toHaveBeenCalledWith("Bench");
    expect(screen.getByText("Squat").closest("button")).toHaveAttribute("aria-current", "true");
  });

  it("colors status dots by readiness: warning when due, discipline when fresh, faint when untested", () => {
    wrap(
      <PRLedger view="lifts" lifts={lifts} state="ready" selectedId="Squat" onSelect={() => {}} />,
    );
    const dotOf = (name: string) =>
      screen.getByText(name).closest("button")!.querySelector("span.rounded-full") as HTMLElement;
    expect(dotOf("Squat").style.backgroundColor).toBe("var(--warning)");
    expect(dotOf("Bench").style.backgroundColor).toBe("var(--discipline-lift-dot)");
    expect(dotOf("Deadlift").style.backgroundColor).toBe("var(--faint)");
  });

  it("applies accent selection chrome only to the selected row", () => {
    wrap(
      <PRLedger view="lifts" lifts={lifts} state="ready" selectedId="Squat" onSelect={() => {}} />,
    );
    const squat = screen.getByText("Squat").closest("button")!;
    const bench = screen.getByText("Bench").closest("button")!;
    expect(squat.className).toContain("border-[var(--accent)]");
    expect(squat.className).toContain("bg-[var(--accent-soft)]");
    expect(bench.className).not.toContain("bg-[var(--accent-soft)]");
  });

  it("shows the +gap cue on a due lift", () => {
    wrap(
      <PRLedger view="lifts" lifts={lifts} state="ready" selectedId="Squat" onSelect={() => {}} />,
    );
    expect(screen.getByText("+60")).toBeInTheDocument();
  });

  it("shows the empty state when there are no lifts", () => {
    wrap(<PRLedger view="lifts" lifts={[]} state="ready" selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("No headline lifts configured.")).toBeInTheDocument();
  });

  it("shows the error box", () => {
    wrap(
      <PRLedger
        view="lifts"
        state="error"
        errorMessage="boom"
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});

describe("PRLedger running", () => {
  it("ranks 5k first and dims uncovered distances", () => {
    wrap(
      <PRLedger
        view="running"
        running={runItems}
        state="ready"
        selectedId="5k"
        onSelect={() => {}}
      />,
    );
    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveTextContent("5K");
    expect(screen.getByText("Marathon").closest("button")).toBeDisabled();
  });
});
