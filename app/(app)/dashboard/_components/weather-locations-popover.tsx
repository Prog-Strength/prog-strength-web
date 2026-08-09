/**
 * WeatherLocationsPopover — the weather tile's saved-places manager.
 *
 * A fully controlled panel: it never writes to the server itself. Every
 * mutation — add from search, add from geolocation, delete, drag-reorder —
 * calls `onChange` with the complete next list, coordinates included, and
 * the tile owns the PUT round-trip. The server write is a whole-list
 * replace, so an entry sent back without its lat/lon would destroy them;
 * saved entries are therefore passed through verbatim.
 *
 * Positioning is the parent's job: this renders as an absolutely-positioned
 * card and the tile anchors it.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  reverseWeatherLocation,
  searchWeatherLocations,
  type WeatherGeoResult,
  type WeatherLocation,
  type WeatherLocationInput,
  type WeatherSettings,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

/**
 * Pure dragEnd math: move the row with `activeId` to `overId`'s index.
 * Unknown ids and no-op drops return the list untouched. Extracted so the
 * reorder logic is unit-testable without simulating a drag in jsdom.
 */
export function reorderLocations(
  locations: WeatherLocation[],
  activeId: string,
  overId: string,
): WeatherLocation[] {
  const from = locations.findIndex((l) => l.id === activeId);
  const to = locations.findIndex((l) => l.id === overId);
  if (from < 0 || to < 0 || from === to) return locations;
  return arrayMove(locations, from, to);
}

/** `state country` metadata line; state is absent outside subdivided countries. */
function placeMeta(place: { state?: string; country: string }): string {
  return [place.state, place.country].filter(Boolean).join(" ");
}

function toInput(r: WeatherGeoResult): WeatherLocationInput {
  return { label: r.name, state: r.state, country: r.country, lat: r.lat, lon: r.lon };
}

export function WeatherLocationsPopover({
  locations,
  settings,
  onChange,
  onClose,
}: {
  locations: WeatherLocation[];
  settings: WeatherSettings;
  /** Controlled: the tile owns the PUT round-trip. */
  onChange: (next: WeatherLocationInput[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherGeoResult[]>([]);
  const [locating, setLocating] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  // Monotonic ticket so a slow response can't overwrite a newer search
  // (or repopulate results after an add cleared them).
  const searchSeq = useRef(0);

  const atCap = locations.length >= settings.max_locations;

  useEffect(() => {
    // Bumping the ticket here also invalidates any in-flight lookup when
    // the query empties or changes; clearing the rendered results is the
    // event handlers' job (setQueryTo, addResult), not the effect's.
    const seq = ++searchSeq.current;
    const q = query.trim();
    if (!q) return;
    const handle = setTimeout(async () => {
      const token = getToken();
      if (!token) return;
      let found: WeatherGeoResult[] = [];
      try {
        found = await searchWeatherLocations(token, q);
      } catch {
        // A failed lookup renders as "no results" — never an alarm.
      }
      if (searchSeq.current === seq) setResults(found);
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function setQueryTo(next: string) {
    setQuery(next);
    if (!next.trim()) setResults([]);
  }

  function addResult(r: WeatherGeoResult) {
    onChange([...locations, toInput(r)]);
    setQuery("");
    setResults([]);
  }

  function removeLocation(id: string) {
    onChange(locations.filter((l) => l.id !== id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onChange(reorderLocations(locations, String(active.id), String(over.id)));
  }

  function useMyLocation() {
    if (locating) return;
    setGeoNote(null);
    if (!("geolocation" in navigator)) {
      setGeoNote("Location permission denied.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        let found: WeatherGeoResult[] = [];
        try {
          const token = getToken();
          if (token) {
            found = await reverseWeatherLocation(token, pos.coords.latitude, pos.coords.longitude);
          }
        } catch {
          // Fall through to the "couldn't resolve" note.
        }
        const first = found[0];
        if (first) {
          // Pin the GEOCODED coordinate, not the raw device fix, so the
          // saved place matches what the reverse lookup named.
          onChange([...locations, toInput(first)]);
        } else {
          setGeoNote("Couldn't resolve your location.");
        }
        setLocating(false);
      },
      () => {
        setGeoNote("Location permission denied.");
        setLocating(false);
      },
    );
  }

  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-raised)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Locations
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--faint)]">
            {locations.length}/{settings.max_locations}
          </span>
          <button
            type="button"
            aria-label="Close locations"
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            <CrossIcon />
          </button>
        </span>
      </div>

      {atCap ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Location limit reached — remove one to add another.
        </p>
      ) : (
        <div className="mt-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQueryTo(e.target.value)}
            placeholder="Search for a city…"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)]"
          />
          {results.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {results.map((r) => (
                <li key={`${r.name}:${r.lat}:${r.lon}`}>
                  <button
                    type="button"
                    onClick={() => addResult(r)}
                    className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[var(--surface-2)]"
                  >
                    <span className="truncate text-sm text-[var(--foreground)]">{r.name}</span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">{placeMeta(r)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {locations.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={locations.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="mt-2 flex flex-col gap-0.5">
              {locations.map((location) => (
                <LocationRow
                  key={location.id}
                  location={location}
                  onRemove={() => removeLocation(location.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={useMyLocation}
        disabled={atCap || locating}
        className="mt-2 w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-[var(--muted)]"
      >
        {locating ? "Locating…" : "Use my current location"}
      </button>
      {geoNote && <p className="mt-1.5 text-xs text-[var(--muted)]">{geoNote}</p>}
    </div>
  );
}

/** One saved place: drag handle, label + metadata, quiet remove. */
function LocationRow({ location, onRemove }: { location: WeatherLocation; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: location.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : undefined,
      }}
      className="flex items-center gap-2 rounded-md px-1 py-1"
    >
      <button
        type="button"
        aria-label={`Reorder ${location.label}`}
        className="flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-[var(--faint)] active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className="truncate text-sm text-[var(--foreground)]">{location.label}</span>
        <span className="shrink-0 text-xs text-[var(--muted)]">{placeMeta(location)}</span>
      </span>
      <button
        type="button"
        aria-label={`Remove ${location.label}`}
        onClick={onRemove}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        <CrossIcon />
      </button>
    </li>
  );
}

function CrossIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4L4 12" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="3" r="1.2" />
      <circle cx="11" cy="3" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="13" r="1.2" />
      <circle cx="11" cy="13" r="1.2" />
    </svg>
  );
}
