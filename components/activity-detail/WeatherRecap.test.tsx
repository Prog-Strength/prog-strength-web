/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { ActivityWeather } from "@/lib/api";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import { WeatherRecap } from "./WeatherRecap";

// The real provider (not a mocked hook) so the unit-flip assertions exercise
// the shipped formatters. It seeds synchronously from localStorage, and with
// no auth token it never reaches for GET /me — so a render is provider-only.
function renderRecap(
  props: Parameters<typeof WeatherRecap>[0],
  unit: "mi" | "km" = "km",
): ReturnType<typeof render> {
  window.localStorage.setItem("ps_distance_unit", unit);
  return render(
    <DistanceUnitProvider>
      <WeatherRecap {...props} />
    </DistanceUnitProvider>,
  );
}

/** A full `ok` reading — the SOW's example row, metric on the wire. */
function okWeather(overrides: Partial<ActivityWeather> = {}): ActivityWeather {
  return {
    status: "ok",
    observed_at: "2025-07-12T18:00:00Z",
    temp_c: 31.1,
    feels_like_c: 36.4,
    dew_point_c: 21.7,
    humidity: 58,
    wind_kmh: 14.5,
    wind_deg: 210,
    precip_mm: 0,
    condition: "Clear",
    icon: "01d",
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
});

describe("WeatherRecap — absent by omission", () => {
  it("renders nothing when the activity carries no weather key", () => {
    const { container } = renderRecap({ environment: "outdoor" });
    expect(container.firstChild).toBeNull();
  });

  // The fixture carries a FULL set of readings on purpose: a bare `{ status }`
  // row would render nothing anyway via the "no headline and no cells" guard,
  // so the case could never fail. With every field present, the status check
  // is the only thing standing between this row and a rendered beat.
  it.each(["no_coordinates", "unavailable"] as const)(
    "renders nothing for the %s status even with a full set of readings",
    (status) => {
      const { container } = renderRecap({
        weather: okWeather({ status }),
        environment: "outdoor",
      });
      expect(container.firstChild).toBeNull();
    },
  );

  // The row survives an outdoor → indoor retag on purpose; hiding is the
  // client's job, so a full `ok` reading must still render nothing here.
  it("renders nothing for an indoor activity even with a full ok reading", () => {
    const { container } = renderRecap({ weather: okWeather(), environment: "indoor" });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for an ok row stripped of every reading", () => {
    const { container } = renderRecap({ weather: { status: "ok" }, environment: "outdoor" });
    expect(container.firstChild).toBeNull();
  });
});

describe("WeatherRecap — headline and metric strip", () => {
  it("renders the kicker, the glyph, the temperature, and the condition", () => {
    const { container } = renderRecap({ weather: okWeather(), environment: "outdoor" });

    expect(screen.getByText("Conditions")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("31°C")).toBeInTheDocument();
    expect(screen.getByText(/Clear/)).toBeInTheDocument();
  });

  it("renders every present metric in the strip", () => {
    renderRecap({ weather: okWeather({ precip_mm: 1.2 }), environment: "outdoor" });

    expect(screen.getByText("Feels like")).toBeInTheDocument();
    expect(screen.getByText("36°C")).toBeInTheDocument();
    expect(screen.getByText("Dew point")).toBeInTheDocument();
    expect(screen.getByText("22°C")).toBeInTheDocument();
    expect(screen.getByText("Humidity")).toBeInTheDocument();
    expect(screen.getByText("58%")).toBeInTheDocument();
    expect(screen.getByText("Wind")).toBeInTheDocument();
    expect(screen.getByText("Precip")).toBeInTheDocument();
    expect(screen.getByText("1.2 mm")).toBeInTheDocument();
  });

  it("names the direction the wind comes from — 210° is SSW", () => {
    renderRecap({ weather: okWeather(), environment: "outdoor" });
    expect(screen.getByText("15 km/h SSW")).toBeInTheDocument();
  });

  // The 16-entry table is indexed by a rounded 22.5° sector, so the top
  // sector — which opens at 348.75° — rounds to index 16 and would read off
  // the end of the array without the `% COMPASS.length` wrap.
  it.each([348.75, 350, 0, 360, -10, -360])(
    "normalizes a %p° bearing into the N sector",
    (wind_deg) => {
      renderRecap({ weather: okWeather({ wind_deg }), environment: "outdoor" });
      expect(screen.getByText("15 km/h N")).toBeInTheDocument();
    },
  );

  // A negative bearing that does NOT land on north is what actually pins the
  // `((deg % 360) + 360) % 360` normalization: JS `%` keeps the sign, so a
  // negative index would be `undefined` — and every negative that wraps TO
  // north hides that, rounding to `-0`, which reads COMPASS[0] anyway.
  it("wraps a negative bearing forward — -30° is the same wind as 330°, NNW", () => {
    renderRecap({ weather: okWeather({ wind_deg: -30 }), environment: "outdoor" });
    expect(screen.getByText("15 km/h NNW")).toBeInTheDocument();
  });

  it("drops the direction when wind_deg is absent but keeps the speed", () => {
    const weather = okWeather();
    delete weather.wind_deg;
    renderRecap({ weather, environment: "outdoor" });
    expect(screen.getByText("15 km/h")).toBeInTheDocument();
  });

  it("omits a dry hour rather than rendering 0 mm", () => {
    renderRecap({ weather: okWeather(), environment: "outdoor" });
    expect(screen.queryByText("Precip")).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.0 mm/)).not.toBeInTheDocument();
  });

  // HTML requires the term before its description, and assistive tech pairs
  // them by document order — so a value-first group is announced as
  // "36°C, Feels like". The strip's reversed VISUAL order (value on top) is a
  // `flex-col-reverse` concern and must not leak back into the DOM.
  it("puts each dt before its dd in document order", () => {
    const { container } = renderRecap({
      weather: okWeather({ precip_mm: 1.2 }),
      environment: "outdoor",
    });

    const groups = container.querySelectorAll("dl > div");
    expect(groups).toHaveLength(5);
    for (const group of groups) {
      const dt = group.querySelector("dt");
      const dd = group.querySelector("dd");
      expect(dt).not.toBeNull();
      expect(dd).not.toBeNull();
      expect(dt!.compareDocumentPosition(dd!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  // Individual absent fields drop their own cell — never a dash placeholder.
  it("drops the cells of absent fields instead of rendering an em-dash", () => {
    const weather = okWeather();
    delete weather.dew_point_c;
    delete weather.humidity;
    const { container } = renderRecap({ weather, environment: "outdoor" });

    expect(screen.queryByText("Dew point")).not.toBeInTheDocument();
    expect(screen.queryByText("Humidity")).not.toBeInTheDocument();
    expect(screen.getByText("Feels like")).toBeInTheDocument();
    expect(container.textContent).not.toContain("—");
  });
});

describe("WeatherRecap — units follow the distance-unit preference", () => {
  it("renders Celsius and km/h under the metric unit", () => {
    renderRecap({ weather: okWeather(), environment: "outdoor" }, "km");
    expect(screen.getByText("31°C")).toBeInTheDocument();
    expect(screen.getByText("36°C")).toBeInTheDocument();
    expect(screen.getByText("15 km/h SSW")).toBeInTheDocument();
  });

  it("renders Fahrenheit and mph under the imperial unit", () => {
    renderRecap({ weather: okWeather(), environment: "outdoor" }, "mi");
    // 31.1 °C → 88 °F, 36.4 °C → 98 °F, 14.5 km/h → 9 mph.
    expect(screen.getByText("88°F")).toBeInTheDocument();
    expect(screen.getByText("98°F")).toBeInTheDocument();
    expect(screen.getByText("9 mph SSW")).toBeInTheDocument();
  });
});
