/**
 * WeatherCard — the self-fetching weather tile.
 *
 * Deliberately NOT a /dashboard/summary section (see the SOW): weather is
 * third-party data with its own cache and budget, so the tile fetches for
 * itself and the dashboard's single summary round-trip stays untouched.
 * Like the quote tile there is no page behind it, so it renders MiniCard's
 * non-navigable variant.
 *
 * Serving degradations ("stale", "budget_exhausted", "unavailable",
 * "disabled") never render as error banners — each becomes a calm muted
 * line, and a reading that still carries `current` is rendered in full
 * (stale adds a quiet "updated … ago" note). Renderers key off the
 * presence of `current`, not the status alone.
 *
 * Paging is ephemeral (always opens on the first saved location) and the
 * per-location readings live in a component-local cache: each location is
 * fetched on first visit (or all up front when the server's
 * `eager_load_all_locations` says so) and paging back is instant.
 *
 * The locations popover is a controlled child: it hands the complete next
 * list to `onChange` and this tile owns the PUT. Each edit is applied
 * optimistically (so a second quick edit derives from the first, not from
 * the original list) and the PUT+refetch pipelines are serialized through
 * a promise chain (so writes hit the server in order); only the newest
 * edit's refetch is applied, so a superseded response can't resurrect a
 * removed place. A failed PUT is deliberately swallowed into a locations
 * refetch — the popover snaps back to the server's list and the rejected
 * edit simply doesn't stick, which keeps the tile free of error chrome
 * (the server-side caps are also enforced in the popover's own UI, so
 * rejections here are rare races). Dismissal (Escape, outside click) and
 * focus return to the gear live here too; the popover's × is the only
 * close path it wires itself.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getWeather,
  getWeatherLocations,
  putWeatherLocations,
  type WeatherLocation,
  type WeatherLocationInput,
  type WeatherReading,
  type WeatherSettings,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { WeatherIcon } from "@/components/weather/icons";
import { MiniCard, MiniCardSkeleton } from "./mini-card";
import { WeatherLocationsPopover } from "./weather-locations-popover";

/** Horizontal travel below which a touch is a tap, not a page swipe. */
const SWIPE_THRESHOLD_PX = 40;

/** A location's slot in the reading cache; absent means "not asked yet". */
type ReadingSlot = WeatherReading | "loading" | "failed";

/**
 * Id prefix for optimistically-added locations that the server hasn't
 * named yet. Keeps popover rows keyed and removable during the PUT
 * round-trip; the reading fetcher skips them (the server can't answer for
 * an id it never issued) and the refetch swaps in the real ids.
 */
const PENDING_ID = "pending:";

/**
 * Coarse age for the stale note — "45m", "3h", "2d". Weather staleness is
 * a shrug, not a deadline, so one unit is plenty.
 */
export function formatAge(iso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "moments";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Hour label for the strip, in the browser's locale ("3 PM" / "15"). */
function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric" });
}

/** `state country` metadata; state is absent outside subdivided countries. */
function placeMeta(place: { state?: string; country: string }): string {
  return [place.state, place.country].filter(Boolean).join(" ");
}

export function WeatherCard() {
  const [locations, setLocations] = useState<WeatherLocation[] | null>(null);
  const [settings, setSettings] = useState<WeatherSettings | null>(null);
  const [locationsFailed, setLocationsFailed] = useState(false);
  // Ephemeral by design — the tile always opens on the first location.
  const [page, setPage] = useState(0);
  const [readings, setReadings] = useState<Record<string, ReadingSlot>>({});
  const [popoverOpen, setPopoverOpen] = useState(false);

  // The popover's positioning anchor and the outside-click boundary.
  const anchorRef = useRef<HTMLDivElement | null>(null);
  // Focus home for the popover: every close path returns focus here.
  const gearRef = useRef<HTMLButtonElement | null>(null);
  // Ids ever handed to getWeather. Synchronous, so a re-run of the fetch
  // effect (or StrictMode's double pass) can't fetch a location twice —
  // this is what makes "second visit uses the cache" hold.
  const requestedIds = useRef(new Set<string>());
  // Per-id fetch tickets (the searchSeq idiom): invalidating a location
  // bumps its ticket, so an in-flight getWeather for a pruned/moved place
  // resolves into the void instead of repopulating the cache slot.
  const readingSeq = useRef(new Map<string, number>());
  // Serialization for popover edits: each PUT+refetch chains behind the
  // previous one, and only the newest edit (by seq) applies its refetch.
  const editChain = useRef<Promise<void>>(Promise.resolve());
  const editSeq = useRef(0);
  // Whether a locations list has ever landed — a refetch failure with
  // last-good data keeps rendering it instead of bricking the tile.
  const hasLoadedRef = useRef(false);
  const touchStartX = useRef<number | null>(null);

  const loadLocations = useCallback(async (): Promise<WeatherLocation[] | null> => {
    // Failure policy: only the FIRST load (nothing to fall back to) flips
    // the tile to its unavailable line. A failed refetch after an edit
    // keeps the last-good locations/settings rendered and closes nothing —
    // flipping to "unavailable" mid-session would hide the gear and strand
    // an open popover over a bricked tile.
    const fail = () => {
      if (!hasLoadedRef.current) setLocationsFailed(true);
      return null;
    };
    const token = getToken();
    if (!token) return fail();
    try {
      const data = await getWeatherLocations(token);
      if (!data) return fail();
      hasLoadedRef.current = true;
      setLocationsFailed(false);
      setSettings(data.settings);
      setLocations(data.locations);
      return data.locations;
    } catch {
      // Renders as the calm unavailable line — never an error banner.
      return fail();
    }
  }, []);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const loadReading = useCallback(async (id: string) => {
    // An optimistic add has no server id yet — its slot stays on skeleton
    // lines until the refetch delivers the real id.
    if (id.startsWith(PENDING_ID)) return;
    if (requestedIds.current.has(id)) return;
    requestedIds.current.add(id);
    const seq = readingSeq.current.get(id) ?? 0;
    // Applies a result only if the id wasn't invalidated while the fetch
    // was in flight (pruned or re-added with new coordinates).
    const apply = (slot: ReadingSlot) => {
      if ((readingSeq.current.get(id) ?? 0) !== seq) return;
      setReadings((prev) => ({ ...prev, [id]: slot }));
    };
    apply("loading");
    const token = getToken();
    if (!token) {
      apply("failed");
      return;
    }
    try {
      const next = await getWeather(token, Intl.DateTimeFormat().resolvedOptions().timeZone, id);
      apply(next ?? "failed");
    } catch {
      // A rejected read is the same calm line as an "unavailable" status.
      apply("failed");
    }
  }, []);

  const count = locations?.length ?? 0;
  // Defensive clamp: the list can shrink under the current page via the
  // popover, and the state clamp there lands a render later.
  const safePage = Math.min(page, Math.max(0, count - 1));

  // Lazy by default — fetch a location the first time it's paged to; fan
  // out to all locations up front when the server asks for eager loading.
  useEffect(() => {
    if (!locations || locations.length === 0 || !settings?.enabled) return;
    if (settings.eager_load_all_locations) {
      for (const location of locations) void loadReading(location.id);
      return;
    }
    const visible = locations[safePage];
    if (visible) void loadReading(visible.id);
  }, [locations, settings, safePage, loadReading]);

  // Every close path funnels through here so focus reliably returns to
  // the gear — the popover's own header contract delegates that to us.
  const closePopover = useCallback(() => {
    setPopoverOpen(false);
    gearRef.current?.focus();
  }, []);

  // Dismissal for the popover: Escape and any pointer-down outside the
  // tile's anchor. The popover itself only wires its × button.
  useEffect(() => {
    if (!popoverOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      // dnd-kit's KeyboardSensor cancels an in-progress keyboard reorder
      // with Escape and prevents default — that Escape is the drag's, not
      // ours, and mustn't also close the popover.
      if (e.defaultPrevented) return;
      if (e.key === "Escape") closePopover();
    }
    function onMouseDown(e: MouseEvent) {
      const anchor = anchorRef.current;
      if (anchor && e.target instanceof Node && !anchor.contains(e.target)) closePopover();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [popoverOpen, closePopover]);

  const handleLocationsChange = useCallback(
    (next: WeatherLocationInput[]) => {
      const previous = locations ?? [];
      const seq = ++editSeq.current;
      // Optimistic apply, immediately and synchronously: the popover is
      // controlled off this state, so a second quick edit derives from
      // THIS list. Without it, remove-A then remove-B would both derive
      // from the original [A,B,C] and the second PUT would resurrect A.
      // Brand-new adds have no server id yet — a pending placeholder keeps
      // their rows stable until the refetch swaps in the real one.
      setLocations(next.map((l, i) => ({ ...l, id: l.id ?? `${PENDING_ID}${i}` })));
      // Serialized write-behind: chain this PUT+refetch after any edit
      // already in flight so writes hit the server in order, and let only
      // the newest edit apply a refetch — a superseded edit's refetch
      // would briefly resurrect its own already-stale server list.
      editChain.current = editChain.current.then(async () => {
        const token = getToken();
        if (!token) return;
        try {
          await putWeatherLocations(token, next);
        } catch {
          // Documented choice: a failed PUT is swallowed and we fall
          // through to the refetch, which snaps the popover back to the
          // server's list. The rejected edit doesn't stick, and the tile
          // stays free of error chrome.
        }
        if (seq !== editSeq.current) return;
        const fresh = await loadLocations();
        // A failed refetch keeps the optimistic list on screen (see
        // loadLocations); the next successful load reconciles.
        if (!fresh) return;
        // Drop cached readings for locations that vanished or moved (a
        // kept id with new coordinates would otherwise serve the old
        // place's weather); untouched ids keep their cache so paging
        // stays instant. Bumping the pruned ids' tickets also voids any
        // of their fetches still in flight.
        const keep = new Set(
          fresh
            .filter((l) => {
              const before = previous.find((p) => p.id === l.id);
              return before !== undefined && before.lat === l.lat && before.lon === l.lon;
            })
            .map((l) => l.id),
        );
        for (const id of requestedIds.current) {
          if (!keep.has(id)) readingSeq.current.set(id, (readingSeq.current.get(id) ?? 0) + 1);
        }
        requestedIds.current = new Set([...requestedIds.current].filter((id) => keep.has(id)));
        setReadings((prev) =>
          Object.fromEntries(Object.entries(prev).filter(([id]) => keep.has(id))),
        );
        setPage((p) => Math.min(p, Math.max(0, fresh.length - 1)));
      });
    },
    [locations, loadLocations],
  );

  const pagePrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const pageNext = useCallback(
    () => setPage((p) => Math.min(Math.max(0, count - 1), p + 1)),
    [count],
  );

  function onBodyKeyDown(e: React.KeyboardEvent) {
    if (count < 2) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      pagePrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      pageNext();
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start == null || end == null || count < 2) return;
    const dx = end - start;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) pageNext();
    else pagePrev();
  }

  // Locations still in flight: the house skeleton, same as the grid's
  // other cards. No gear yet — there is nothing to manage.
  if (!locationsFailed && (!locations || !settings)) {
    return <MiniCardSkeleton />;
  }

  let body: React.ReactNode;
  if (locationsFailed || !locations || !settings) {
    body = <QuietLine text="Weather is unavailable." />;
  } else if (!settings.enabled) {
    body = <QuietLine text="Weather is off." />;
  } else if (locations.length === 0) {
    // Zero saved places is an invitation, not an error — MiniCardEmpty's
    // CTA styling, wired to open the popover.
    body = (
      <button
        type="button"
        onClick={() => setPopoverOpen(true)}
        className="flex flex-1 items-center text-left"
      >
        <span className="text-sm text-[var(--muted)]">
          Add a location <span className="text-[var(--accent)]">→</span>
        </span>
      </button>
    );
  } else {
    const visible = locations[safePage];
    body = (
      <div
        role="group"
        aria-label="Weather reading"
        tabIndex={0}
        onKeyDown={onBodyKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="flex flex-1 flex-col gap-1.5 rounded-md outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
      >
        {visible && <ReadingBody location={visible} slot={readings[visible.id]} />}
        {count > 1 && (
          <div className="mt-auto flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              aria-label="Previous location"
              onClick={pagePrev}
              disabled={safePage === 0}
              className="px-1 text-sm leading-none text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-40 disabled:hover:text-[var(--muted)]"
            >
              ‹
            </button>
            <span className="flex items-center gap-1.5">
              {locations.map((l, i) => (
                <span
                  key={l.id}
                  className={`h-1.5 w-1.5 rounded-full ${
                    i === safePage ? "bg-[var(--foreground)]" : "bg-[var(--faint)]"
                  }`}
                />
              ))}
            </span>
            <button
              type="button"
              aria-label="Next location"
              onClick={pageNext}
              disabled={safePage === count - 1}
              className="px-1 text-sm leading-none text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-40 disabled:hover:text-[var(--muted)]"
            >
              ›
            </button>
          </div>
        )}
      </div>
    );
  }

  // The relative wrapper is triple duty: the gear's absolute position, the
  // popover's placement anchor, and the outside-click boundary. MiniCard's
  // title prop can't carry actions, so the gear overlays the header's
  // right side from out here.
  return (
    <div ref={anchorRef} className="relative">
      <MiniCard title="Weather">{body}</MiniCard>
      {settings && !locationsFailed && (
        <button
          ref={gearRef}
          type="button"
          aria-label="Manage locations"
          onClick={() => setPopoverOpen((open) => !open)}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          <GearIcon />
        </button>
      )}
      {popoverOpen && settings && locations && (
        <WeatherLocationsPopover
          locations={locations}
          settings={settings}
          onChange={handleLocationsChange}
          onClose={closePopover}
        />
      )}
    </div>
  );
}

/** Every degraded state renders as this — a calm muted line, no banner. */
function QuietLine({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center">
      <p className="text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}

/**
 * One location's slot: skeleton lines while its first fetch is in flight,
 * the full reading when `current` is present (status only decides the
 * stale note), and a status-appropriate quiet line otherwise.
 */
function ReadingBody({
  location,
  slot,
}: {
  location: WeatherLocation;
  slot: ReadingSlot | undefined;
}) {
  if (slot === undefined || slot === "loading") {
    return (
      <div className="flex animate-pulse flex-col gap-2" aria-hidden="true">
        <div className="h-4 w-28 rounded bg-[var(--surface-2)]" />
        <div className="h-8 w-36 rounded bg-[var(--surface-2)]" />
        <div className="h-3 w-full rounded bg-[var(--surface-2)]" />
        <div className="h-10 w-full rounded bg-[var(--surface-2)]" />
      </div>
    );
  }
  if (slot === "failed") return <QuietLine text="Weather is unavailable." />;

  const { current } = slot;
  if (!current) {
    // Key off the missing reading, not the status: stale/budget/unavailable
    // with a cached `current` all render in full above this check.
    const text =
      slot.status === "budget_exhausted"
        ? "Weather is resting for today."
        : slot.status === "disabled"
          ? "Weather is off."
          : "Weather is unavailable.";
    return <QuietLine text={text} />;
  }

  const hourly = (slot.hourly ?? []).slice(0, 5);
  return (
    <>
      <div className="flex items-baseline gap-1.5">
        <span className="truncate text-sm text-[var(--foreground)]">{location.label}</span>
        <span className="shrink-0 text-xs text-[var(--muted)]">{placeMeta(location)}</span>
      </div>
      <div className="flex items-center gap-3">
        <WeatherIcon icon={current.icon} className="h-8 w-8 shrink-0 text-[var(--muted)]" />
        <span className="text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          {Math.round(current.temp)}°
        </span>
        <span className="min-w-0 truncate text-sm text-[var(--muted)]">{current.condition}</span>
      </div>
      <p className="text-xs text-[var(--muted)]">
        feels {Math.round(current.feels_like)}° · {current.humidity}% ·{" "}
        {Math.round(current.wind_speed)} {slot.units?.wind ?? "mph"}
      </p>
      {slot.today && (
        <p className="text-xs text-[var(--muted)]">
          H {Math.round(slot.today.high)}° · L {Math.round(slot.today.low)}°
        </p>
      )}
      {slot.status === "stale" && slot.fetched_at && (
        <p className="text-[11px] text-[var(--faint)]">updated {formatAge(slot.fetched_at)} ago</p>
      )}
      {hourly.length > 0 && (
        <div className="grid grid-cols-5 gap-1 border-t border-[var(--border)] pt-2">
          {hourly.map((h) => (
            <div key={h.at} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-[var(--faint)]">{formatHour(h.at)}</span>
              <WeatherIcon icon={h.icon} className="h-4 w-4 text-[var(--muted)]" />
              <span className="text-xs text-[var(--foreground)]">{Math.round(h.temp)}°</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
