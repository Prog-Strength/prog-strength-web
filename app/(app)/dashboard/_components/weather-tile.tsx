"use client";

import { MiniCard } from "./mini-card";

/**
 * Placeholder: the self-fetching weather card lands in the next commit on
 * this branch; this stub keeps the exhaustive tile switch compiling.
 */
export function WeatherCard() {
  return (
    <MiniCard title="Weather">
      <p className="text-sm text-[var(--muted)]">Weather is loading soon.</p>
    </MiniCard>
  );
}
