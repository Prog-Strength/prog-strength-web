"use client";

import type { MapStyleDef, MapStyleId } from "@/lib/map-styles";

/**
 * Basemap picker — a pill row in the established `SegmentedToggle` idiom
 * rather than a `<select>`, matching the timeframe pills elsewhere in the app.
 *
 * It renders OVER the map, on the one surface in the product whose backdrop we
 * do not control, so it uses the `--map-chrome-*` family instead of the neutral
 * ramp: `--surface` is invisible over a pale topographic canvas and will be
 * invisible over imagery in Phase 3.
 *
 * The active pill keeps `--accent`, which is correct here and NOT a violation
 * of the "activity ≠ selection" rule — this is a selection control, exactly
 * what the accent is reserved for. The route stroke, which is a series, is what
 * moved OFF the accent onto the discipline hue.
 */
export function MapStyleSwitcher({
  styles,
  value,
  onChange,
}: {
  styles: MapStyleDef[];
  value: MapStyleId;
  onChange: (id: MapStyleId) => void;
}) {
  // With one resolvable style there is no choice to offer — most commonly when
  // no MapTiler key is configured. Render nothing rather than a dead control.
  if (styles.length < 2) return null;

  return (
    <div
      role="group"
      aria-label="Basemap style"
      className="absolute right-3 top-3 z-10 inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--map-chrome-bg)] p-0.5 backdrop-blur-sm"
    >
      {styles.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={active}
            title={s.hint}
            onClick={() => {
              if (!active) onChange(s.id);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--map-chrome-fg)] hover:bg-white/10"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
