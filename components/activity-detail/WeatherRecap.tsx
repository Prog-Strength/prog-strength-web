"use client";

/**
 * Conditions recap — what the athlete stepped out into, beside `MapView`,
 * `HeartRateRecap`, and `ElevationRecap`. The reading is a single stored
 * observation from the activity's start hour (immutable history, not a
 * forecast), so there is no refetch and no loading state: it rides the
 * detail response the page already has.
 *
 * Composed as a body beat rather than a card — a discipline-hued kicker over
 * a headline (glyph · temperature · condition) and the page's own `border-y`
 * definition-list metric strip, the same idiom distance/time/pace use. The
 * glyph stays neutral (`--muted`): saturated colour belongs to the activity
 * disciplines, and a yellow sun would read as a hue that means nothing.
 *
 * Absent by omission. Nothing renders when the activity has no reading, when
 * the capture resolved to anything but `ok`, or when the activity is indoor —
 * a treadmill run's outdoor temperature is a fact about a parking lot. No
 * skeleton, no empty frame, no "weather unavailable" line, and individual
 * missing fields drop their own cell rather than printing a dash.
 */

import type { ActivityWeather } from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { WeatherIcon } from "@/components/weather/icons";
import { SectionKicker } from "./SectionKicker";

/**
 * 16-point compass, indexed by 22.5° sectors from north. Meteorological
 * degrees name the direction the wind comes FROM, so 210° is a wind out of
 * the south-southwest — which is what the label says.
 */
const COMPASS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

function degreesToCompass(deg: number): string {
  // Normalize first: the provider is well-behaved, but a wrapped or negative
  // bearing must not index off the end of the table.
  const normalized = ((deg % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 22.5) % COMPASS.length];
}

export function WeatherRecap({
  weather,
  environment,
  discipline = "run",
}: {
  weather?: ActivityWeather;
  environment: "outdoor" | "indoor";
  discipline?: "run" | "hike";
}) {
  const { formatTemperature, formatWindSpeed } = useDistanceUnit();

  // An `outdoor → indoor` retag keeps the stored row (hiding is the client's
  // job, so retagging back needs no refetch) — which is exactly why the
  // environment gate lives here and not in the API.
  if (!weather || weather.status !== "ok" || environment !== "outdoor") return null;

  const cells: { label: string; value: string }[] = [];
  if (weather.feels_like_c != null) {
    cells.push({ label: "Feels like", value: formatTemperature(weather.feels_like_c) });
  }
  if (weather.dew_point_c != null) {
    cells.push({ label: "Dew point", value: formatTemperature(weather.dew_point_c) });
  }
  if (weather.humidity != null) {
    cells.push({ label: "Humidity", value: `${weather.humidity}%` });
  }
  if (weather.wind_kmh != null) {
    // Direction is a garnish on the speed, never a cell of its own: "SSW"
    // with no number says nothing a reader can use.
    const speed = formatWindSpeed(weather.wind_kmh);
    cells.push({
      label: "Wind",
      value: weather.wind_deg != null ? `${speed} ${degreesToCompass(weather.wind_deg)}` : speed,
    });
  }
  if (weather.precip_mm != null && weather.precip_mm > 0) {
    // A dry hour is omitted rather than rendered as "0 mm" — the absence of
    // a precipitation cell already reads as "it was dry".
    cells.push({ label: "Precip", value: `${weather.precip_mm.toFixed(1)} mm` });
  }

  const temperature = weather.temp_c != null ? formatTemperature(weather.temp_c) : null;
  const hasHeadline = temperature != null || !!weather.condition || !!weather.icon;
  // Defensive: an `ok` row stripped of every reading would otherwise render a
  // kicker over an empty rule, which is the empty frame the grammar forbids.
  if (!hasHeadline && cells.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionKicker discipline={discipline}>Conditions</SectionKicker>
      {hasHeadline && (
        <div className="flex items-center gap-3">
          {weather.icon && (
            <WeatherIcon icon={weather.icon} className="h-8 w-8 shrink-0 text-[var(--muted)]" />
          )}
          {temperature && (
            <span className="text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {temperature}
            </span>
          )}
          {weather.condition && (
            <span className="min-w-0 truncate text-sm text-[var(--muted)]">
              · {weather.condition}
            </span>
          )}
        </div>
      )}
      {cells.length > 0 && (
        <dl className="flex flex-wrap gap-x-8 gap-y-3 border-y border-[var(--border)] py-4">
          {cells.map((cell) => (
            // `dt` before `dd` in the DOM because that is the order HTML
            // requires and the order assistive tech pairs them in — a
            // value-first group announces "36°C, Feels like" instead of
            // naming the metric first. `flex-col-reverse` puts the value back
            // on top visually, so the strip reads exactly as it did before.
            <div key={cell.label} className="flex flex-col-reverse gap-1">
              <dt className="text-[10px] uppercase tracking-wider text-[var(--faint)]">
                {cell.label}
              </dt>
              <dd className="text-base font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
