/// <reference types="vitest/globals" />

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WeatherLocation, WeatherSettings } from "@/lib/api";
import { WeatherLocationsPopover, reorderLocations } from "./weather-locations-popover";

const searchWeatherLocationsMock = vi.hoisted(() => vi.fn());
const reverseWeatherLocationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  searchWeatherLocations: searchWeatherLocationsMock,
  reverseWeatherLocation: reverseWeatherLocationMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

function settings(overrides: Partial<WeatherSettings> = {}): WeatherSettings {
  return { enabled: true, max_locations: 5, eager_load_all_locations: false, ...overrides };
}

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

const saved: WeatherLocation[] = [kyoto, lisbon];

function atCapLocations(): WeatherLocation[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `loc-${i}`,
    label: `Place ${i}`,
    country: "US",
    lat: i,
    lon: -i,
  }));
}

function mockGeolocation(getCurrentPosition: (...args: unknown[]) => void) {
  Object.defineProperty(window.navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
}

beforeEach(() => {
  searchWeatherLocationsMock.mockReset();
  reverseWeatherLocationMock.mockReset();
  searchWeatherLocationsMock.mockResolvedValue([]);
  reverseWeatherLocationMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("WeatherLocationsPopover", () => {
  it("renders the saved locations and the counter", () => {
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Kyoto")).toBeInTheDocument();
    expect(screen.getByText("Lisbon")).toBeInTheDocument();
    expect(screen.getByText("2/5")).toBeInTheDocument();
  });

  it("debounces the search — one call with the settled value", async () => {
    vi.useFakeTimers();
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Search for a city…");

    fireEvent.change(input, { target: { value: "d" } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: "de" } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: "den" } });
    expect(searchWeatherLocationsMock).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    await act(async () => {});

    expect(searchWeatherLocationsMock).toHaveBeenCalledTimes(1);
    expect(searchWeatherLocationsMock).toHaveBeenCalledWith("test-token", "den");
  });

  it("never renders stale results — a late first response loses to a newer query", async () => {
    vi.useFakeTimers();
    let resolveFirst!: (v: unknown) => void;
    let resolveSecond!: (v: unknown) => void;
    searchWeatherLocationsMock
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveFirst = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveSecond = r;
          }),
      );
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Search for a city…");

    fireEvent.change(input, { target: { value: "den" } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(input, { target: { value: "kyi" } });
    act(() => vi.advanceTimersByTime(300));
    expect(searchWeatherLocationsMock).toHaveBeenCalledTimes(2);

    // The second query answers first…
    await act(async () => {
      resolveSecond([{ name: "Kyiv", country: "UA", lat: 50.4501, lon: 30.5234 }]);
    });
    expect(screen.getByText("Kyiv")).toBeInTheDocument();

    // …then the first limps in late. Its results must never render.
    await act(async () => {
      resolveFirst([
        { name: "Denver", state: "Colorado", country: "US", lat: 39.74, lon: -104.99 },
      ]);
    });
    expect(screen.queryByText("Denver")).not.toBeInTheDocument();
    expect(screen.getByText("Kyiv")).toBeInTheDocument();
  });

  it("adds a search result — appended verbatim, input cleared", async () => {
    vi.useFakeTimers();
    searchWeatherLocationsMock.mockResolvedValue([
      { name: "Denver", state: "Colorado", country: "US", lat: 39.7392, lon: -104.9903 },
    ]);
    const onChange = vi.fn();
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Search for a city…");
    fireEvent.change(input, { target: { value: "denver" } });
    act(() => vi.advanceTimersByTime(300));
    await act(async () => {});

    fireEvent.click(screen.getByText("Denver"));

    expect(onChange).toHaveBeenCalledWith([
      kyoto,
      lisbon,
      { label: "Denver", state: "Colorado", country: "US", lat: 39.7392, lon: -104.9903 },
    ]);
    expect(input).toHaveValue("");
  });

  it("at the cap: no search input, cap message shown, geolocation disabled", () => {
    render(
      <WeatherLocationsPopover
        locations={atCapLocations()}
        settings={settings()}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText("Search for a city…")).not.toBeInTheDocument();
    expect(
      screen.getByText("Location limit reached — remove one to add another."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use my current location/i })).toBeDisabled();
  });

  it("delete removes only that row", () => {
    const onChange = vi.fn();
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Kyoto" }));
    expect(onChange).toHaveBeenCalledWith([lisbon]);
  });

  it("geolocation success appends the geocoded location", async () => {
    mockGeolocation((...args) => {
      const success = args[0] as (pos: unknown) => void;
      success({ coords: { latitude: 39.7, longitude: -104.9 } });
    });
    reverseWeatherLocationMock.mockResolvedValue([
      { name: "Denver", state: "Colorado", country: "US", lat: 39.7392, lon: -104.9903 },
    ]);
    const onChange = vi.fn();
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        kyoto,
        lisbon,
        { label: "Denver", state: "Colorado", country: "US", lat: 39.7392, lon: -104.9903 },
      ]),
    );
    expect(reverseWeatherLocationMock).toHaveBeenCalledWith("test-token", 39.7, -104.9);
  });

  it("geolocation success clears any pending search text", async () => {
    mockGeolocation((...args) => {
      const success = args[0] as (pos: unknown) => void;
      success({ coords: { latitude: 39.7, longitude: -104.9 } });
    });
    reverseWeatherLocationMock.mockResolvedValue([
      { name: "Denver", state: "Colorado", country: "US", lat: 39.7392, lon: -104.9903 },
    ]);
    const onChange = vi.fn();
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Search for a city…");
    fireEvent.change(input, { target: { value: "denv" } });
    fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(input).toHaveValue("");
  });

  it("builds the geolocation add from the CURRENT list, not the click-time list", async () => {
    // The GPS + reverse round trip is slow; the user can delete a row while
    // it is in flight. The appended list must reflect that delete, or the
    // whole-list PUT would resurrect it.
    let success!: (pos: unknown) => void;
    mockGeolocation((...args) => {
      success = args[0] as typeof success;
    });
    reverseWeatherLocationMock.mockResolvedValue([
      { name: "Denver", state: "Colorado", country: "US", lat: 39.7392, lon: -104.9903 },
    ]);
    const onChange = vi.fn();
    const { rerender } = render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

    // Kyoto is deleted mid-flight; the parent re-renders with the new list.
    rerender(
      <WeatherLocationsPopover
        locations={[lisbon]}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    await act(async () => {
      success({ coords: { latitude: 39.7, longitude: -104.9 } });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      lisbon,
      { label: "Denver", state: "Colorado", country: "US", lat: 39.7392, lon: -104.9903 },
    ]);
  });

  it("ignores a geolocation fix that lands after unmount", async () => {
    let success!: (pos: unknown) => void;
    mockGeolocation((...args) => {
      success = args[0] as typeof success;
    });
    reverseWeatherLocationMock.mockResolvedValue([
      { name: "Denver", state: "Colorado", country: "US", lat: 39.7392, lon: -104.9903 },
    ]);
    const onChange = vi.fn();
    const { unmount } = render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));
    unmount();

    await act(async () => {
      success({ coords: { latitude: 39.7, longitude: -104.9 } });
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("drops the geolocation add when the list fills to the cap mid-flight", async () => {
    let success!: (pos: unknown) => void;
    mockGeolocation((...args) => {
      success = args[0] as typeof success;
    });
    reverseWeatherLocationMock.mockResolvedValue([
      { name: "Denver", state: "Colorado", country: "US", lat: 39.7392, lon: -104.9903 },
    ]);
    const onChange = vi.fn();
    const four = atCapLocations().slice(0, 4);
    const { rerender } = render(
      <WeatherLocationsPopover
        locations={four}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

    rerender(
      <WeatherLocationsPopover
        locations={atCapLocations()}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    await act(async () => {
      success({ coords: { latitude: 39.7, longitude: -104.9 } });
    });

    expect(onChange).not.toHaveBeenCalled();
    // The cap line is already on screen explaining why adding is off.
    expect(
      screen.getByText("Location limit reached — remove one to add another."),
    ).toBeInTheDocument();
  });

  it("geolocation with no reverse results shows the couldn't-resolve note", async () => {
    mockGeolocation((...args) => {
      const success = args[0] as (pos: unknown) => void;
      success({ coords: { latitude: 0, longitude: 0 } });
    });
    reverseWeatherLocationMock.mockResolvedValue([]);
    const onChange = vi.fn();
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

    expect(await screen.findByText("Couldn't resolve your location.")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("geolocation unsupported by the browser shows its own note", async () => {
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    const onChange = vi.fn();
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

    expect(
      await screen.findByText("Location isn't available in this browser."),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("geolocation denied shows a quiet note and does not call onChange", async () => {
    mockGeolocation((...args) => {
      const error = args[1] as (err: unknown) => void;
      error({ code: 1, message: "User denied Geolocation" });
    });
    const onChange = vi.fn();
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

    expect(await screen.findByText("Location permission denied.")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(reverseWeatherLocationMock).not.toHaveBeenCalled();
  });

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    render(
      <WeatherLocationsPopover
        locations={saved}
        settings={settings()}
        onChange={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close locations" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("reorderLocations", () => {
  it("moves the active row to the over row's index", () => {
    expect(reorderLocations(saved, "loc-kyoto", "loc-lisbon")).toEqual([lisbon, kyoto]);
  });

  it("returns the list unchanged when active and over are the same", () => {
    expect(reorderLocations(saved, "loc-kyoto", "loc-kyoto")).toEqual(saved);
  });

  it("returns the list unchanged for unknown ids", () => {
    expect(reorderLocations(saved, "loc-kyoto", "nope")).toEqual(saved);
    expect(reorderLocations(saved, "nope", "loc-lisbon")).toEqual(saved);
  });
});
