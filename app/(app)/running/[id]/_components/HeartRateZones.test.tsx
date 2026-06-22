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
  it("renders a legend row per zone for a calibrated fixture, with no calibrating banner", () => {
    render(<HeartRateZones zones={zones()} />);

    for (const name of ["Recovery", "Aerobic", "Tempo", "Threshold", "VO2max"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    // bpm ranges render per zone.
    expect(screen.getByText(/0[–-]114 bpm/)).toBeInTheDocument();
    expect(screen.getByText(/172[–-]191 bpm/)).toBeInTheDocument();

    expect(screen.queryByText(CALIBRATING_COPY)).not.toBeInTheDocument();
  });

  it("shows the calibrating banner copy for a calibrating fixture", () => {
    render(
      <HeartRateZones zones={zones({ reference_confidence: "calibrating", calibrating: true })} />,
    );
    expect(screen.getByText(CALIBRATING_COPY)).toBeInTheDocument();
  });

  it("renders nothing when zones is null", () => {
    const { container } = render(<HeartRateZones zones={null} />);
    expect(container.firstChild).toBeNull();
  });
});
