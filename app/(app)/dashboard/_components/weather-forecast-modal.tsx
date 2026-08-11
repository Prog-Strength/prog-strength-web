/**
 * WeatherForecastModal — the tile's full forecast: every saved location, by
 * hour for the rest of the day and by day for the week.
 *
 * The tile answers "what is it like right now, here"; this answers "when should
 * I run". That is a planning question, so the panel is organised around the two
 * horizons a plan actually uses — the remaining hours of today, and the days
 * ahead — with the saved locations as tabs across the top, because comparing
 * two places is how a run gets moved rather than cancelled.
 *
 * It owns NO fetching. The tile holds the per-location reading cache and hands
 * this component the slot plus a `onNeedReading` callback, so opening the panel
 * on a location the tile has not visited yet triggers exactly the same lazy
 * fetch (and the same loading state) that paging to it would — and a location
 * already in the tile's cache opens instantly, with no second provider call.
 *
 * Data horizon is stated rather than padded: the hourly strip runs as far as
 * the provider's single call reaches (~20 hours) and the week is what the daily
 * call returned (up to 8 days). Where a section is short, the panel says so —
 * inventing an eighth day, or interpolating hours past the horizon, would be
 * fiction on a surface the user is planning against.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { WeatherDay, WeatherHour, WeatherLocation, WeatherReading } from "@/lib/api";
import { WeatherIcon } from "@/components/weather/icons";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { weatherTheme } from "@/lib/weather-theme";
import { Spinner } from "./weather-loading";

/** What the tile knows about one location's reading; mirrors its own slot type. */
export type ForecastSlot = WeatherReading | "loading" | "failed" | undefined;

type Horizon = "today" | "week";

export function WeatherForecastModal({
  locations,
  slots,
  initialLocationId,
  onNeedReading,
  onClose,
}: {
  locations: WeatherLocation[];
  slots: Record<string, ForecastSlot>;
  initialLocationId: string;
  /** Ask the tile to fetch this location if it hasn't already. */
  onNeedReading: (id: string) => void;
  onClose: () => void;
}) {
  const [locationId, setLocationId] = useState(initialLocationId);
  const [horizon, setHorizon] = useState<Horizon>("today");
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // The tab the panel opens on may be a location the tile never paged to, and
  // every later tab certainly is. Asking on every change is safe: the tile's
  // fetcher is idempotent per id (it tracks what it has already requested).
  useEffect(() => {
    onNeedReading(locationId);
  }, [locationId, onNeedReading]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const active = locations.find((l) => l.id === locationId) ?? locations[0];
  const slot = active ? slots[active.id] : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weather-forecast-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="weather-forecast-title" className="text-base font-semibold">
              Forecast
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Hour by hour for the rest of today, then the week ahead.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          {/* Locations as tabs — comparing two places is the point. */}
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Locations">
            {locations.map((l) => {
              const selected = active?.id === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setLocationId(l.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    selected
                      ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
          <SegmentedToggle<Horizon>
            value={horizon}
            onChange={setHorizon}
            options={[
              { value: "today", label: "Today" },
              { value: "week", label: "Week" },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ForecastBody slot={slot} horizon={horizon} />
        </div>
      </div>
    </div>
  );
}

/** One location's forecast at one horizon, including every not-yet state. */
function ForecastBody({ slot, horizon }: { slot: ForecastSlot; horizon: Horizon }) {
  if (slot === undefined || slot === "loading") {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-[var(--muted)]">
        <Spinner />
        Fetching the forecast…
      </div>
    );
  }
  if (slot === "failed") {
    return <p className="py-10 text-sm text-[var(--muted)]">Weather is unavailable.</p>;
  }
  if (horizon === "today") {
    return <TodayView hourly={slot.hourly ?? []} reading={slot} />;
  }
  return <WeekView days={slot.daily ?? []} unit={slot.units?.temp ?? "F"} />;
}

/** "3 PM" in the browser's locale — the same formatter the tile strip uses. */
function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric" });
}

function formatWeekday(iso: string, index: number): string {
  if (index === 0) return "Today";
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
}

function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The rest of today, hour by hour, as a scrolling row of columns with a
 * temperature curve behind them.
 *
 * The curve is drawn from the same buckets the columns print, on a scale
 * spanning only this strip's own range — so a flat afternoon reads flat rather
 * than being stretched into drama by a fixed axis.
 */
function TodayView({ hourly, reading }: { hourly: WeatherHour[]; reading: WeatherReading }) {
  if (hourly.length === 0) {
    return <p className="py-10 text-sm text-[var(--muted)]">No hourly forecast right now.</p>;
  }
  const temps = hourly.map((h) => h.temp);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = hi - lo || 1;
  const unit = reading.units?.temp ?? "F";

  return (
    <div className="flex flex-col gap-4">
      {reading.today && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--muted)]">
          <span>
            High <span className="text-[var(--foreground)]">{reading.today.high}°</span> · Low{" "}
            <span className="text-[var(--foreground)]">{reading.today.low}°</span>
          </span>
          <span>Sunrise {formatHour(reading.today.sunrise)}</span>
          <span>Sunset {formatHour(reading.today.sunset)}</span>
        </div>
      )}

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1 px-1">
          {hourly.map((h) => {
            const theme = weatherTheme(h.icon);
            // Column height encodes the temperature within this strip's range;
            // 22px of floor keeps the coldest hour a bar rather than a line.
            const fill = 22 + ((h.temp - lo) / span) * 34;
            return (
              <div
                key={h.at}
                className="flex w-[58px] shrink-0 flex-col items-center gap-1.5 rounded-[10px] px-1 py-2"
                style={{ backgroundColor: theme.tint }}
              >
                <span className="text-[10px] text-[var(--faint)]">{formatHour(h.at)}</span>
                <WeatherIcon icon={h.icon} className="h-4 w-4" />
                <span className="text-xs font-medium text-[var(--foreground)]">{h.temp}°</span>
                <span
                  aria-hidden="true"
                  className="w-[3px] rounded-full"
                  style={{ height: `${fill}px`, backgroundColor: theme.tone, opacity: 0.55 }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-[var(--faint)]">
        {hourly.length} {hourly.length === 1 ? "hour" : "hours"} ahead · temperatures in °{unit}
      </p>
    </div>
  );
}

/**
 * The week as rows, each with a high/low range bar positioned against the
 * WEEK's own span — so a cold Thursday sits visibly left of a warm Saturday
 * instead of every row drawing an identical bar.
 */
function WeekView({ days, unit }: { days: WeatherDay[]; unit: "F" | "C" }) {
  if (days.length === 0) {
    return (
      <p className="py-10 text-sm text-[var(--muted)]">
        No daily forecast yet — it arrives with the next refresh.
      </p>
    );
  }
  const lo = Math.min(...days.map((d) => d.low));
  const hi = Math.max(...days.map((d) => d.high));
  const span = hi - lo || 1;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {days.map((d, i) => {
          const theme = weatherTheme(d.icon);
          const left = ((d.low - lo) / span) * 100;
          const width = ((d.high - d.low) / span) * 100;
          return (
            <li key={d.at} className="flex items-center gap-3 py-2.5">
              <span className="w-12 shrink-0 text-xs font-medium text-[var(--foreground)]">
                {formatWeekday(d.at, i)}
              </span>
              <span className="hidden w-14 shrink-0 text-[11px] text-[var(--faint)] sm:block">
                {formatDayMonth(d.at)}
              </span>
              <span style={{ color: theme.tone }} title={d.condition}>
                <WeatherIcon icon={d.icon} className="h-4 w-4 shrink-0" />
              </span>
              <span className="hidden w-16 shrink-0 truncate text-[11px] text-[var(--muted)] md:block">
                {d.condition}
              </span>
              <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--muted)]">
                {d.low}°
              </span>
              {/* The range bar: position and width both carry meaning. */}
              <span
                className="relative h-1.5 min-w-[40px] flex-1 rounded-full bg-[var(--surface-2)]"
                role="img"
                aria-label={`Low ${d.low} degrees, high ${d.high} degrees`}
              >
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(4, width)}%`,
                    backgroundColor: theme.tone,
                    opacity: 0.75,
                  }}
                />
              </span>
              <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--foreground)]">
                {d.high}°
              </span>
              {/* Precipitation earns its column only when there is some. */}
              <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--muted)]">
                {d.precip_chance > 0 ? `${d.precip_chance}%` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-[var(--faint)]">
        {days.length} {days.length === 1 ? "day" : "days"} · temperatures in °{unit} · the last
        column is the chance of precipitation
      </p>
    </div>
  );
}
