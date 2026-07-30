/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { RunningSession } from "@/lib/api";

const calibrateRunningSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  calibrateRunningSession: calibrateRunningSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: toastSuccessMock, error: toastErrorMock }),
}));

// Mock the unit context with the REAL "mi" formatters + the real conversion
// constants so unit→meters math in the modal is exercised end to end. The
// factory is hoisted, so the constants are inlined as literals here; the
// top-level `METERS_PER_MILE` below is only for the test assertions.
const METERS_PER_MILE = 1609.344;
vi.mock("@/lib/distance-unit-context", () => ({
  METERS_PER_MILE: 1609.344,
  METERS_PER_KM: 1000,
  formatDistanceValue: (m: number) => (m / METERS_PER_MILE).toFixed(1),
  formatPaceValue: (s: number | null) =>
    s == null || !Number.isFinite(s) || s <= 0
      ? "—"
      : `${Math.floor(Math.round(s * 1.609344) / 60)}:${String(
          Math.round(s * 1.609344) % 60,
        ).padStart(2, "0")}`,
  useDistanceUnit: () => ({ unit: "mi", unitLabel: "mi" }),
}));

import { CalibrateDistanceModal } from "./CalibrateDistanceModal";

function makeSession(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    id: "run-1",
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: "src-1",
    name: "Treadmill Run",
    start_time: "2026-06-18T13:00:00Z",
    distance_meters: 5000,
    raw_distance_meters: 5000,
    environment: "indoor",
    duration_seconds: 1500,
    avg_pace_sec_per_km: 300,
    best_pace_sec_per_km: 240,
    avg_heart_rate_bpm: 150,
    max_heart_rate_bpm: 178,
    total_calories: 420,
    elevation_gain_meters: 30,
    elevation_loss_meters: null,
    elevation_high_meters: null,
    elevation_low_meters: null,
    created_at: "2026-06-18T13:30:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CalibrateDistanceModal", () => {
  it("pre-fills the current distance in the user's unit", () => {
    render(
      <CalibrateDistanceModal session={makeSession()} onClose={vi.fn()} onCalibrated={vi.fn()} />,
    );
    // 5000 m / 1609.344 ≈ 3.1 mi.
    expect(screen.getByLabelText(/Corrected distance/)).toHaveValue(3.1);
  });

  it("does not call the API for an empty, zero, or negative value", async () => {
    render(
      <CalibrateDistanceModal session={makeSession()} onClose={vi.fn()} onCalibrated={vi.fn()} />,
    );
    const input = screen.getByLabelText(/Corrected distance/);

    for (const bad of ["", "0", "-2"]) {
      fireEvent.change(input, { target: { value: bad } });
      // The Calibrate button is disabled, so clicking is a no-op.
      const btn = screen.getByRole("button", { name: "Calibrate" });
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
    }
    expect(calibrateRunningSessionMock).not.toHaveBeenCalled();
  });

  it("converts the entered miles to meters and reports the calibrated session", async () => {
    const updated = makeSession({ distance_meters: 4828.03, raw_distance_meters: 5000 });
    calibrateRunningSessionMock.mockResolvedValue(updated);
    const onCalibrated = vi.fn();

    render(
      <CalibrateDistanceModal
        session={makeSession()}
        onClose={vi.fn()}
        onCalibrated={onCalibrated}
      />,
    );
    const input = screen.getByLabelText(/Corrected distance/);
    fireEvent.change(input, { target: { value: "3.0" } });
    fireEvent.click(screen.getByRole("button", { name: "Calibrate" }));

    await waitFor(() => {
      expect(calibrateRunningSessionMock).toHaveBeenCalledWith(
        "test-token",
        "run-1",
        3.0 * METERS_PER_MILE,
        "mi", // the active unit rides along so the response's derived blocks match
      );
    });
    expect(onCalibrated).toHaveBeenCalledWith(updated);
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it("surfaces the API error message on failure", async () => {
    calibrateRunningSessionMock.mockRejectedValue(
      new Error("tag the run as indoor before calibrating its distance"),
    );
    render(
      <CalibrateDistanceModal session={makeSession()} onClose={vi.fn()} onCalibrated={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/Corrected distance/), { target: { value: "3.0" } });
    fireEvent.click(screen.getByRole("button", { name: "Calibrate" }));

    expect(await screen.findByText(/tag the run as indoor/)).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalled();
  });
});
