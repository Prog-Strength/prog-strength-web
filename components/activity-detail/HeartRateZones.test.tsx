/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { HeartRateZones as HRZones } from "@/lib/api";
import { HeartRateZones } from "./HeartRateZones";

const CALIBRATING_COPY =
  "Calibrating — zones will sharpen as Prog Strength learns your heart rate.";

function zones(overrides: Partial<HRZones> = {}): HRZones {
  return {
    model: "percent_max_hr",
    max_hr_reference_bpm: 191,
    reference_source: "p99_recent_runs",
    reference_confidence: "calibrated",
    calibrating: false,
    total_hr_seconds: 3170,
    zones: [
      {
        zone: 1,
        name: "Recovery",
        lower_pct: 0.0,
        upper_pct: 0.6,
        min_bpm: 0,
        max_bpm: 114,
        time_seconds: 240,
        time_pct: 0.076,
      },
      {
        zone: 2,
        name: "Aerobic",
        lower_pct: 0.6,
        upper_pct: 0.7,
        min_bpm: 115,
        max_bpm: 133,
        time_seconds: 980,
        time_pct: 0.309,
      },
      {
        zone: 3,
        name: "Tempo",
        lower_pct: 0.7,
        upper_pct: 0.8,
        min_bpm: 134,
        max_bpm: 152,
        time_seconds: 760,
        time_pct: 0.24,
      },
      {
        zone: 4,
        name: "Threshold",
        lower_pct: 0.8,
        upper_pct: 0.9,
        min_bpm: 153,
        max_bpm: 171,
        time_seconds: 690,
        time_pct: 0.218,
      },
      {
        zone: 5,
        name: "VO2max",
        lower_pct: 0.9,
        upper_pct: 1.0,
        min_bpm: 172,
        max_bpm: 191,
        time_seconds: 500,
        time_pct: 0.158,
      },
    ],
    ...overrides,
  };
}

describe("HeartRateZones", () => {
  it("renders one bar row per zone with name, bpm range, time, and percent", () => {
    render(<HeartRateZones zones={zones()} />);

    for (const name of ["Recovery", "Aerobic", "Tempo", "Threshold", "VO2max"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    // bpm ranges render per zone.
    expect(screen.getByText(/0[–-]114 bpm/)).toBeInTheDocument();
    expect(screen.getByText(/172[–-]191 bpm/)).toBeInTheDocument();

    // Time and percent figures render for each zone.
    expect(screen.getByText("4:00")).toBeInTheDocument(); // Recovery 240s
    expect(screen.getByText("8%")).toBeInTheDocument(); // Recovery 0.076
    expect(screen.getByText("16%")).toBeInTheDocument(); // VO2max 0.158
  });

  it("renders rows in descending zone order (VO2max first, Recovery last)", () => {
    render(<HeartRateZones zones={zones()} />);

    const names = screen.getAllByText(/^(Recovery|Aerobic|Tempo|Threshold|VO2max)$/);
    expect(names.map((n) => n.textContent)).toEqual([
      "VO2max",
      "Threshold",
      "Tempo",
      "Aerobic",
      "Recovery",
    ]);
  });

  it("renders each fill with a width from time_pct and its zone color", () => {
    const { container } = render(<HeartRateZones zones={zones()} />);

    const fills = container.querySelectorAll<HTMLElement>('[aria-hidden="true"]');
    // One decorative fill per zone, in descending zone order.
    expect(fills).toHaveLength(5);

    // First fill is VO2max (zone 5): width 15.8%, --zone-5 fill.
    expect(fills[0].style.width).toBe("15.8%");
    expect(fills[0].style.backgroundColor).toBe("var(--zone-5)");
    // Last fill is Recovery (zone 1): width 7.6%, --zone-1 fill.
    expect(fills[4].style.width).toBe("7.6%");
    expect(fills[4].style.backgroundColor).toBe("var(--zone-1)");
  });

  it("renders a zero-time zone's row with an empty fill and 0:00 / 0%", () => {
    const base = zones();
    const { container } = render(
      <HeartRateZones
        zones={zones({
          zones: [{ ...base.zones[0], time_seconds: 0, time_pct: 0 }, ...base.zones.slice(1)],
        })}
      />,
    );

    // The Recovery row still renders.
    expect(screen.getByText("Recovery")).toBeInTheDocument();
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();

    // Its fill is the last one (zone 1) and has zero width.
    const fills = container.querySelectorAll<HTMLElement>('[aria-hidden="true"]');
    expect(fills[4].style.width).toBe("0%");
  });

  it("renders all five rows for an extreme-skew run", () => {
    render(
      <HeartRateZones
        zones={zones({
          total_hr_seconds: 3650,
          zones: [
            { ...zones().zones[0], time_seconds: 37, time_pct: 0.01 }, // Recovery 0:37 / 1%
            { ...zones().zones[1], time_seconds: 24, time_pct: 0.01 }, // Aerobic 0:24 / 1%
            { ...zones().zones[2], time_seconds: 181, time_pct: 0.05 }, // Tempo 3:01 / 5%
            { ...zones().zones[3], time_seconds: 814, time_pct: 0.22 }, // Threshold 13:34 / 22%
            { ...zones().zones[4], time_seconds: 2614, time_pct: 0.71 }, // VO2max 43:34 / 71%
          ],
        })}
      />,
    );

    for (const name of ["Recovery", "Aerobic", "Tempo", "Threshold", "VO2max"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText("0:37")).toBeInTheDocument();
    expect(screen.getByText("0:24")).toBeInTheDocument();
    expect(screen.getByText("3:01")).toBeInTheDocument();
    expect(screen.getByText("13:34")).toBeInTheDocument();
    expect(screen.getByText("43:34")).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
    // Both 1% zones show a present-but-short figure (two occurrences).
    expect(screen.getAllByText("1%")).toHaveLength(2);
  });

  it("shows the calibrating banner copy for a calibrating fixture", () => {
    render(
      <HeartRateZones zones={zones({ reference_confidence: "calibrating", calibrating: true })} />,
    );
    expect(screen.getByText(CALIBRATING_COPY)).toBeInTheDocument();
  });

  it("hides the calibrating banner for a calibrated fixture", () => {
    render(<HeartRateZones zones={zones()} />);
    expect(screen.queryByText(CALIBRATING_COPY)).not.toBeInTheDocument();
  });

  it("renders nothing when zones is null", () => {
    const { container } = render(<HeartRateZones zones={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the zones array is empty", () => {
    const { container } = render(<HeartRateZones zones={zones({ zones: [] })} />);
    expect(container.firstChild).toBeNull();
  });

  it("frames itself with its own card chrome and heading by default", () => {
    const { container } = render(<HeartRateZones zones={zones()} />);
    expect(screen.getByText("Heart rate zones")).toBeInTheDocument();
    expect((container.firstChild as HTMLElement).className).toContain("border");
  });

  // Nesting inside a host card that already owns the border and the section
  // heading (the workout page's "Heart rate & effort" card) must not double up
  // on either — but the bars themselves are identical either way.
  it("drops the card chrome and heading when framed is false", () => {
    const { container } = render(<HeartRateZones zones={zones()} framed={false} />);
    expect(screen.queryByText("Heart rate zones")).not.toBeInTheDocument();
    expect((container.firstChild as HTMLElement).className).not.toContain("border");
    for (const name of ["Recovery", "Aerobic", "Tempo", "Threshold", "VO2max"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("still shows the calibrating banner when unframed", () => {
    render(
      <HeartRateZones
        zones={zones({ reference_confidence: "calibrating", calibrating: true })}
        framed={false}
      />,
    );
    expect(screen.getByText(CALIBRATING_COPY)).toBeInTheDocument();
  });
});
