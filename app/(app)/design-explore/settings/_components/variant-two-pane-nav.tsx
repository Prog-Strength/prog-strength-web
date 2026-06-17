"use client";

/**
 * IDIOM: two-pane-nav — draws on Stripe / Notion settings shells.
 *
 * - Type scale: mid scale with STRONG rail section labels; the active
 *   group title anchors the detail pane.
 * - Color logic: the active rail item is an accent-SOFT pill with an
 *   accent-LINE border and an accent-colored glyph — the exact app-nav
 *   language, so settings reads as a room inside the app. Accent appears
 *   only there and on active toggles.
 * - Spacing rhythm: a structured two-pane split (compact left rail,
 *   generous right pane). Collapses to a top tab strip over a single pane
 *   on narrow widths.
 * - Save model: per-control INSTANT auto-save with a small inline "Saved"
 *   confirmation, matching the toggles — one group is shown at a time so
 *   the page scans at a glance and scales as settings grow.
 *
 * Throwaway DX mockup: state is local, nothing is wired to a service.
 */

import { useEffect, useRef, useState } from "react";
import {
  BIO_MAX_RUNES,
  PROFILE_FIXTURE,
  USAGE_FIXTURE,
  USERNAME_RE,
  type Availability,
  clampRunes,
  heightToDisplay,
  initialsOf,
  resolveAvailability,
  runeLength,
  usageColor,
} from "./fixtures";

type Section = "profile" | "usage" | "units" | "calendar";
const SECTIONS: { id: Section; label: string; glyph: React.ReactNode }[] = [
  { id: "profile", label: "Profile", glyph: "◍" },
  { id: "usage", label: "Usage", glyph: "▰" },
  { id: "units", label: "Units", glyph: "⇄" },
  { id: "calendar", label: "Calendar", glyph: "▦" },
];

const heightUnit: "in" | "cm" = PROFILE_FIXTURE.distance_unit === "km" ? "cm" : "in";

const paneInput =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm " +
  "transition focus:outline focus:outline-2 focus:outline-[var(--accent)]";

function useSavedHint() {
  const [shown, setShown] = useState(false);
  const t = useRef<number | undefined>(undefined);
  function ping() {
    setShown(true);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setShown(false), 1500);
  }
  useEffect(() => () => window.clearTimeout(t.current), []);
  return { shown, ping };
}

function SavedHint({ shown }: { shown: boolean }) {
  return (
    <span
      className={`text-xs text-[var(--success)] transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
    >
      Saved ✓
    </span>
  );
}

function PaneField({
  label,
  children,
  saved,
}: {
  label: string;
  children: React.ReactNode;
  saved?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        {saved !== undefined && <SavedHint shown={saved} />}
      </div>
      {children}
    </div>
  );
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-fit rounded-full border border-[var(--border)] bg-[var(--background)] p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function TwoPaneNav() {
  const [active, setActive] = useState<Section>("profile");

  const [name, setName] = useState(PROFILE_FIXTURE.display_name);
  const nameSaved = useSavedHint();
  const [handle, setHandle] = useState(PROFILE_FIXTURE.username ?? "");
  const handleSaved = useSavedHint();
  const [probe, setProbe] = useState<{ handle: string; result: Availability } | null>(null);
  const [bio, setBio] = useState(PROFILE_FIXTURE.bio);
  const bioSaved = useSavedHint();
  const [height, setHeight] = useState(heightToDisplay(PROFILE_FIXTURE.height_cm, heightUnit));
  const heightSaved = useSavedHint();
  const [distance, setDistance] = useState(PROFILE_FIXTURE.distance_unit);
  const distSaved = useSavedHint();
  const [weight, setWeight] = useState(PROFILE_FIXTURE.weight_unit);
  const weightSaved = useSavedHint();
  const [detail, setDetail] = useState(PROFILE_FIXTURE.calendar_default_detail);
  const detailSaved = useSavedHint();
  const [calConnected, setCalConnected] = useState(true);

  const normalized = handle.trim().toLowerCase();
  const handleDirty = normalized !== (PROFILE_FIXTURE.username ?? "");
  const charsetOk = USERNAME_RE.test(normalized);
  useEffect(() => {
    if (!handleDirty || !charsetOk) return;
    const t = window.setTimeout(
      () => setProbe({ handle: normalized, result: resolveAvailability(normalized) }),
      500,
    );
    return () => window.clearTimeout(t);
  }, [normalized, handleDirty, charsetOk]);
  const availability: Availability =
    !handleDirty || !charsetOk
      ? { kind: "idle" }
      : probe?.handle === normalized
        ? probe.result
        : { kind: "checking" };

  return (
    <div className="font-sans">
      <h2 className="mb-5 text-lg font-bold tracking-tight">Settings</h2>

      {/* Narrow: top tab strip. */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 sm:hidden">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(s.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active === s.id
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--muted)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Wide: left rail in the app-nav pill language. */}
        <nav className="hidden w-48 shrink-0 flex-col gap-1 sm:flex">
          {SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                  on
                    ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                }`}
              >
                <span className={on ? "text-[var(--accent)]" : "text-[var(--faint)]"}>
                  {s.glyph}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* Detail pane. */}
        <div className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
          {active === "profile" && (
            <div className="flex flex-col gap-5">
              <h3 className="text-base font-bold tracking-tight">Profile</h3>
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-lg font-bold uppercase">
                  {initialsOf(name)}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)]"
                >
                  Upload
                </button>
                <span className="text-xs text-[var(--muted)]">PNG, JPG, WebP · ≤ 2 MB</span>
              </div>

              <PaneField label="Display name" saved={nameSaved.shown}>
                <input
                  aria-label="Display name"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => name.trim() && nameSaved.ping()}
                  className={paneInput}
                />
              </PaneField>

              <PaneField label="Username" saved={handleSaved.shown}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--muted)]">@</span>
                  <input
                    aria-label="Username"
                    value={handle}
                    maxLength={30}
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) => setHandle(e.target.value.toLowerCase())}
                    onBlur={() =>
                      charsetOk && availability.kind === "available" && handleSaved.ping()
                    }
                    className={paneInput}
                  />
                </div>
                <HandleStatus
                  availability={availability}
                  charsetOk={charsetOk}
                  dirty={handleDirty}
                  handle={normalized}
                />
              </PaneField>

              <PaneField label="Bio" saved={bioSaved.shown}>
                <textarea
                  aria-label="Bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(clampRunes(e.target.value, BIO_MAX_RUNES))}
                  onBlur={() => bioSaved.ping()}
                  className={`${paneInput} resize-none`}
                />
                <span className="self-end text-xs tabular-nums text-[var(--muted)]">
                  {runeLength(bio)}/{BIO_MAX_RUNES}
                </span>
              </PaneField>

              <PaneField label="Height" saved={heightSaved.shown}>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min={0}
                    aria-label={`Height (${heightUnit})`}
                    placeholder={heightUnit === "in" ? "e.g. 69" : "e.g. 175"}
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    onBlur={() => heightSaved.ping()}
                    className={`${paneInput} tabular-nums max-w-[8rem]`}
                  />
                  <span className="text-xs text-[var(--muted)]">{heightUnit}</span>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {height ? "Shown in your distance unit." : "No height set."}
                </span>
              </PaneField>
            </div>
          )}

          {active === "usage" && (
            <div className="flex flex-col gap-4">
              <h3 className="text-base font-bold tracking-tight">Usage</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Daily AI allowance</span>
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
                    Read-only
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${USAGE_FIXTURE.percentUsed}%`,
                        backgroundColor: usageColor(USAGE_FIXTURE.percentUsed),
                      }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs font-medium tabular-nums">
                    {USAGE_FIXTURE.percentUsed}%
                  </span>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  Resets in {USAGE_FIXTURE.resetsInLabel}.
                </span>
              </div>
            </div>
          )}

          {active === "units" && (
            <div className="flex flex-col gap-5">
              <h3 className="text-base font-bold tracking-tight">Units</h3>
              <PaneField label="Distance" saved={distSaved.shown}>
                <Toggle
                  value={distance}
                  options={[
                    { value: "mi", label: "Miles" },
                    { value: "km", label: "Kilometers" },
                  ]}
                  onChange={(v) => {
                    setDistance(v);
                    distSaved.ping();
                  }}
                />
                <span className="text-xs text-[var(--muted)]">
                  Running views and the unit Height uses.
                </span>
              </PaneField>
              <PaneField label="Weight" saved={weightSaved.shown}>
                <Toggle
                  value={weight}
                  options={[
                    { value: "lb", label: "Pounds" },
                    { value: "kg", label: "Kilograms" },
                  ]}
                  onChange={(v) => {
                    setWeight(v);
                    weightSaved.ping();
                  }}
                />
                <span className="text-xs text-[var(--muted)]">Bodyweight and workout volume.</span>
              </PaneField>
            </div>
          )}

          {active === "calendar" && (
            <div className="flex flex-col gap-5">
              <h3 className="text-base font-bold tracking-tight">Google Calendar</h3>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Calendar sync</p>
                  <p className="text-xs text-[var(--muted)]">
                    {calConnected
                      ? "Connected. Planned workouts can sync."
                      : "Connect to sync planned workouts."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCalConnected((c) => !c)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    calConnected
                      ? "border border-[var(--border)] hover:bg-[var(--surface-2)]"
                      : "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90"
                  }`}
                >
                  {calConnected ? "Disconnect" : "Connect"}
                </button>
              </div>
              <PaneField label="Default event detail" saved={detailSaved.shown}>
                <Toggle
                  value={detail}
                  options={[
                    { value: "time_block", label: "Time block" },
                    { value: "full_agenda", label: "Full agenda" },
                  ]}
                  onChange={(v) => {
                    setDetail(v);
                    detailSaved.ping();
                  }}
                />
              </PaneField>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HandleStatus({
  availability,
  charsetOk,
  dirty,
  handle,
}: {
  availability: Availability;
  charsetOk: boolean;
  dirty: boolean;
  handle: string;
}) {
  if (dirty && handle !== "" && !charsetOk)
    return (
      <span className="text-xs text-[var(--danger)]">
        3–30 chars: letter first, then lowercase letters, numbers, or underscores.
      </span>
    );
  if (availability.kind === "checking")
    return <span className="text-xs text-[var(--muted)]">Checking availability…</span>;
  if (availability.kind === "available")
    return <span className="text-xs text-[var(--success)]">@{handle} is available.</span>;
  if (availability.kind === "taken")
    return <span className="text-xs text-[var(--danger)]">@{handle} is taken.</span>;
  if (availability.kind === "reserved")
    return <span className="text-xs text-[var(--danger)]">@{handle} is reserved.</span>;
  return (
    <span className="text-xs text-[var(--muted)]">
      Your public handle. The old link stops working — no redirect.
    </span>
  );
}
