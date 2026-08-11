/// <reference types="vitest/globals" />

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { WeatherLocation, WeatherReading } from "@/lib/api";
import { WeatherForecastModal, type ForecastSlot } from "./weather-forecast-modal";

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

function reading(overrides: Partial<WeatherReading> = {}): WeatherReading {
  return {
    status: "ok",
    units: { temp: "F", wind: "mph" },
    current: {
      temp: 72,
      feels_like: 70,
      humidity: 55,
      wind_speed: 8,
      condition: "Clear",
      icon: "01d",
    },
    today: {
      high: 75,
      low: 58,
      sunrise: "2026-08-09T05:12:00Z",
      sunset: "2026-08-09T18:54:00Z",
    },
    hourly: [
      { at: "2026-08-09T15:00:00Z", temp: 61, icon: "01d" },
      { at: "2026-08-09T16:00:00Z", temp: 63, icon: "02d" },
      { at: "2026-08-09T17:00:00Z", temp: 66, icon: "10d" },
    ],
    daily: [
      {
        at: "2026-08-09T12:00:00Z",
        high: 75,
        low: 58,
        condition: "Clear",
        icon: "01d",
        precip_chance: 0,
        wind_speed: 8,
        humidity: 55,
        sunrise: "2026-08-09T05:12:00Z",
        sunset: "2026-08-09T18:54:00Z",
      },
      {
        at: "2026-08-10T12:00:00Z",
        high: 68,
        low: 52,
        condition: "Rain",
        icon: "10d",
        precip_chance: 60,
        wind_speed: 12,
        humidity: 80,
        sunrise: "2026-08-10T05:13:00Z",
        sunset: "2026-08-10T18:52:00Z",
      },
    ],
    ...overrides,
  };
}

function renderModal(
  slots: Record<string, ForecastSlot>,
  overrides: Partial<Parameters<typeof WeatherForecastModal>[0]> = {},
) {
  const onNeedReading = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <WeatherForecastModal
      locations={[kyoto, lisbon]}
      slots={slots}
      initialLocationId={kyoto.id}
      onNeedReading={onNeedReading}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { ...utils, onNeedReading, onClose };
}

describe("WeatherForecastModal", () => {
  it("opens on the tile's current location, with every saved place as a tab", () => {
    renderModal({ [kyoto.id]: reading() });
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Kyoto", "Lisbon"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("asks the tile for a location it has not fetched — and only asks", () => {
    // The panel owns no fetching: a place already in the tile's cache opens
    // instantly, and one that is not costs exactly the request paging would.
    const { onNeedReading } = renderModal({ [kyoto.id]: reading() });
    expect(onNeedReading).toHaveBeenCalledWith(kyoto.id);

    fireEvent.click(screen.getByRole("tab", { name: "Lisbon" }));
    expect(onNeedReading).toHaveBeenCalledWith(lisbon.id);
  });

  it("shows the labelled wait for a location still in flight", () => {
    renderModal({ [kyoto.id]: "loading" });
    expect(screen.getByText("Fetching the forecast…")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("degrades a failed location to a calm line, never error chrome", () => {
    renderModal({ [kyoto.id]: "failed" });
    expect(screen.getByText("Weather is unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens on today's hours, with the day's bookends", () => {
    renderModal({ [kyoto.id]: reading() });
    expect(screen.getByText("61°")).toBeInTheDocument();
    expect(screen.getByText("66°")).toBeInTheDocument();
    expect(screen.getByText(/3 hours ahead/)).toBeInTheDocument();
    expect(screen.getByText(/Sunrise/)).toBeInTheDocument();
    expect(screen.getByText(/Sunset/)).toBeInTheDocument();
  });

  it("switches to the week, naming today and reading each day's range", () => {
    renderModal({ [kyoto.id]: reading() });
    fireEvent.click(screen.getByRole("button", { name: "Week" }));

    // The first row names itself rather than printing a weekday the user has
    // to date-check. Scoped to the list, since "Today" is also a toggle.
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Today")).toBeInTheDocument();
    // Both days' range bars are described for a screen reader, since the bar
    // itself is the only place the pair is drawn.
    expect(
      screen.getByRole("img", { name: "Low 58 degrees, high 75 degrees" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Low 52 degrees, high 68 degrees" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 days/)).toBeInTheDocument();
  });

  it("prints a precipitation chance only where there is one", () => {
    renderModal({ [kyoto.id]: reading() });
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).queryByText("0%")).not.toBeInTheDocument();
    expect(within(rows[1]).getByText("60%")).toBeInTheDocument();
  });

  it("says the week is missing rather than drawing an empty frame", () => {
    // A reading cached before the daily forecast existed: honest, not broken.
    renderModal({ [kyoto.id]: reading({ daily: [] }) });
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByText(/No daily forecast yet/)).toBeInTheDocument();
  });

  it("closes on Escape, on the backdrop, and on the ×", () => {
    const { onClose, container } = renderModal({ [kyoto.id]: reading() });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(container.querySelector('[aria-hidden="true"]')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("takes focus on open, so Escape and Tab go to the panel", () => {
    renderModal({ [kyoto.id]: reading() });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });
});
