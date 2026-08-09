/// <reference types="vitest/globals" />

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WeatherLocation, WeatherReading, WeatherSettings } from "@/lib/api";
import { WeatherCard, formatAge } from "./weather-tile";

const getWeatherMock = vi.hoisted(() => vi.fn());
const getWeatherLocationsMock = vi.hoisted(() => vi.fn());
const putWeatherLocationsMock = vi.hoisted(() => vi.fn());
const searchWeatherLocationsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getWeather: getWeatherMock,
  getWeatherLocations: getWeatherLocationsMock,
  putWeatherLocations: putWeatherLocationsMock,
  searchWeatherLocations: searchWeatherLocationsMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

const kyoto: WeatherLocation = {
  id: "loc-kyoto",
  label: "Kyoto",
  country: "JP",
  lat: 35.0116,
  lon: 135.7681,
};

const lisbon: WeatherLocation = {
  id: "loc-lisbon",
  label: "Lisbon",
  country: "PT",
  lat: 38.7223,
  lon: -9.1393,
};

function settings(overrides: Partial<WeatherSettings> = {}): WeatherSettings {
  return { enabled: true, max_locations: 5, eager_load_all_locations: false, ...overrides };
}

// Six hourly entries served; the tile must render exactly five. Temps are
// kept clear of the current/feels/high/low values so text assertions are
// unambiguous.
function reading(overrides: Partial<WeatherReading> = {}): WeatherReading {
  return {
    status: "ok",
    location: { id: "loc-kyoto", label: "Kyoto", country: "JP" },
    fetched_at: new Date().toISOString(),
    units: { temp: "F", wind: "mph" },
    current: {
      temp: 72.4,
      feels_like: 70.2,
      humidity: 55,
      wind_speed: 8.3,
      condition: "Clear",
      icon: "01d",
    },
    today: {
      high: 75.2,
      low: 58.1,
      sunrise: "2026-08-09T05:12:00Z",
      sunset: "2026-08-09T18:54:00Z",
    },
    hourly: [
      { at: "2026-08-09T15:00:00Z", temp: 50.2, icon: "01d" },
      { at: "2026-08-09T16:00:00Z", temp: 51.2, icon: "02d" },
      { at: "2026-08-09T17:00:00Z", temp: 52.2, icon: "10d" },
      { at: "2026-08-09T18:00:00Z", temp: 53.2, icon: "04d" },
      { at: "2026-08-09T19:00:00Z", temp: 54.2, icon: "01n" },
      { at: "2026-08-09T20:00:00Z", temp: 55.2, icon: "01n" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  getWeatherMock.mockReset();
  getWeatherLocationsMock.mockReset();
  putWeatherLocationsMock.mockReset();
  searchWeatherLocationsMock.mockReset();
  getWeatherLocationsMock.mockResolvedValue({ locations: [kyoto], settings: settings() });
  getWeatherMock.mockResolvedValue(reading());
  putWeatherLocationsMock.mockResolvedValue({ locations: [kyoto] });
  searchWeatherLocationsMock.mockResolvedValue([]);
});

describe("WeatherCard", () => {
  it("shows the skeleton while locations load", () => {
    getWeatherLocationsMock.mockReturnValue(new Promise(() => {}));
    const { container } = render(<WeatherCard />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText("Weather")).not.toBeInTheDocument();
  });

  it("invites adding a location when none are saved — and it opens the popover", async () => {
    getWeatherLocationsMock.mockResolvedValue({ locations: [], settings: settings() });
    render(<WeatherCard />);

    const cta = await screen.findByRole("button", { name: /add a location/i });
    // An empty list is an invitation, not an error.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(getWeatherMock).not.toHaveBeenCalled();

    fireEvent.click(cta);
    expect(screen.getByLabelText("Search for a city")).toBeInTheDocument();
  });

  it("renders the full reading for an ok status", async () => {
    render(<WeatherCard />);

    expect(await screen.findByText("72°")).toBeInTheDocument();
    expect(screen.getByText("Kyoto")).toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
    expect(screen.getByText(/feels 70° · 55% · 8 mph/)).toBeInTheDocument();
    expect(screen.getByText(/H 75° · L 58°/)).toBeInTheDocument();

    // Six hourly entries served, exactly five rendered.
    expect(screen.getByText("50°")).toBeInTheDocument();
    expect(screen.getByText("54°")).toBeInTheDocument();
    expect(screen.queryByText("55°")).not.toBeInTheDocument();

    // House convention: the browser timezone rides along on the fetch.
    expect(getWeatherMock).toHaveBeenCalledWith(
      "test-token",
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      "loc-kyoto",
    );
  });

  it("renders a stale reading in full with a quiet updated-ago note", async () => {
    getWeatherMock.mockResolvedValue(
      reading({
        status: "stale",
        fetched_at: new Date(Date.now() - 45 * 60_000).toISOString(),
      }),
    );
    render(<WeatherCard />);

    expect(await screen.findByText("72°")).toBeInTheDocument();
    expect(screen.getByText("updated 45m ago")).toBeInTheDocument();
  });

  it("hides the stale note for a fresh reading", async () => {
    render(<WeatherCard />);
    expect(await screen.findByText("72°")).toBeInTheDocument();
    expect(screen.queryByText(/updated .* ago/)).not.toBeInTheDocument();
  });

  it("renders a calm line when the budget is exhausted with no cached reading", async () => {
    getWeatherMock.mockResolvedValue({ status: "budget_exhausted" });
    const { container } = render(<WeatherCard />);

    expect(await screen.findByText("Weather is resting for today.")).toBeInTheDocument();
    // Calm means calm: no alert role, no danger styling.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(container.querySelector('[class*="danger"], [class*="red-"]')).toBeNull();
  });

  it("renders the unavailable line when getWeather rejects — and does not throw", async () => {
    getWeatherMock.mockRejectedValue(new Error("upstream down"));
    render(<WeatherCard />);

    expect(await screen.findByText("Weather is unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders 'Weather is off.' when the server settings disable the feature", async () => {
    getWeatherLocationsMock.mockResolvedValue({
      locations: [kyoto],
      settings: settings({ enabled: false }),
    });
    render(<WeatherCard />);

    expect(await screen.findByText("Weather is off.")).toBeInTheDocument();
    expect(getWeatherMock).not.toHaveBeenCalled();
  });

  it("pages between locations, fetching each once and serving revisits from cache", async () => {
    getWeatherLocationsMock.mockResolvedValue({
      locations: [kyoto, lisbon],
      settings: settings(),
    });
    getWeatherMock.mockImplementation(async (_token: string, _tz: string, id?: string) =>
      id === "loc-lisbon"
        ? reading({
            location: { id: "loc-lisbon", label: "Lisbon", country: "PT" },
            current: {
              temp: 61.4,
              feels_like: 60.1,
              humidity: 70,
              wind_speed: 12.2,
              condition: "Cloudy",
              icon: "04d",
            },
            hourly: [],
          })
        : reading(),
    );
    const { container } = render(<WeatherCard />);

    // Always opens on location 1, with the page dots present.
    expect(await screen.findByText("72°")).toBeInTheDocument();
    expect(container.querySelectorAll("span.rounded-full")).toHaveLength(2);
    expect(getWeatherMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Next location" }));
    expect(await screen.findByText("61°")).toBeInTheDocument();
    expect(getWeatherMock).toHaveBeenCalledTimes(2);

    // Back and forward again — both revisits come from the component cache.
    fireEvent.click(screen.getByRole("button", { name: "Previous location" }));
    expect(await screen.findByText("72°")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next location" }));
    expect(await screen.findByText("61°")).toBeInTheDocument();
    expect(getWeatherMock).toHaveBeenCalledTimes(2);

    // Arrow keys page the focused card body too.
    const body = screen.getByRole("group", { name: "Weather reading" });
    fireEvent.keyDown(body, { key: "ArrowLeft" });
    expect(await screen.findByText("72°")).toBeInTheDocument();
    fireEvent.keyDown(body, { key: "ArrowRight" });
    expect(await screen.findByText("61°")).toBeInTheDocument();
    expect(getWeatherMock).toHaveBeenCalledTimes(2);
  });

  it("PUTs the popover's list and refetches locations", async () => {
    getWeatherLocationsMock
      .mockResolvedValueOnce({ locations: [kyoto, lisbon], settings: settings() })
      .mockResolvedValueOnce({ locations: [kyoto], settings: settings() });
    putWeatherLocationsMock.mockResolvedValue({ locations: [kyoto] });
    render(<WeatherCard />);
    expect(await screen.findByText("72°")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manage locations" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Lisbon" }));

    await waitFor(() =>
      expect(putWeatherLocationsMock).toHaveBeenCalledWith("test-token", [kyoto]),
    );
    await waitFor(() => expect(getWeatherLocationsMock).toHaveBeenCalledTimes(2));
    // The paging chrome collapses along with the refetched single-item list.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Next location" })).not.toBeInTheDocument(),
    );
  });

  it("closes the popover on Escape", async () => {
    render(<WeatherCard />);
    expect(await screen.findByText("72°")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manage locations" }));
    expect(screen.getByLabelText("Search for a city")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByLabelText("Search for a city")).not.toBeInTheDocument(),
    );
  });

  it("closes the popover on an outside click", async () => {
    render(<WeatherCard />);
    expect(await screen.findByText("72°")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manage locations" }));
    expect(screen.getByLabelText("Search for a city")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() =>
      expect(screen.queryByLabelText("Search for a city")).not.toBeInTheDocument(),
    );
  });

  it("renders the unavailable line when the locations fetch fails", async () => {
    getWeatherLocationsMock.mockRejectedValue(new Error("network"));
    render(<WeatherCard />);

    expect(await screen.findByText("Weather is unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // No gear either — there are no settings to manage against.
    expect(screen.queryByRole("button", { name: "Manage locations" })).not.toBeInTheDocument();
  });

  it("fans out one fetch per location when eager loading is on", async () => {
    getWeatherLocationsMock.mockResolvedValue({
      locations: [kyoto, lisbon],
      settings: settings({ eager_load_all_locations: true }),
    });
    render(<WeatherCard />);

    expect(await screen.findByText("72°")).toBeInTheDocument();
    await waitFor(() => expect(getWeatherMock).toHaveBeenCalledTimes(2));
    const ids = getWeatherMock.mock.calls.map((c) => c[2]);
    expect(ids).toContain("loc-kyoto");
    expect(ids).toContain("loc-lisbon");
  });
});

describe("formatAge", () => {
  const now = Date.parse("2026-08-09T12:00:00Z");

  it("uses one coarse unit per scale", () => {
    expect(formatAge("2026-08-09T11:59:40Z", now)).toBe("moments");
    expect(formatAge("2026-08-09T11:15:00Z", now)).toBe("45m");
    expect(formatAge("2026-08-09T09:00:00Z", now)).toBe("3h");
    expect(formatAge("2026-08-07T12:00:00Z", now)).toBe("2d");
  });

  it("clamps a clock-skewed future timestamp to moments", () => {
    expect(formatAge("2026-08-09T12:05:00Z", now)).toBe("moments");
  });
});
