"use client";

/**
 * IDIOM: linear-minimal — draws on Linear's settings calm.
 *
 * - Type scale: small and restrained; hierarchy comes from WEIGHT and
 *   SPACING, never size. One body size, semibold labels, faint meta.
 * - Color logic: near-monochrome slate. Violet appears ONLY on focus
 *   rings and the active segment of a toggle — nowhere else.
 * - Spacing rhythm: tight, even row rhythm with a generous left→right
 *   gutter; settings are label-left / control-right rows divided by
 *   HAIRLINES, not boxes, under small-caps section headers.
 * - Save model: auto-save on blur / debounce. A tiny "Saved" ✓ fades in
 *   beside the row and clears. No buttons anywhere — the page finally
 *   matches the toggles, which already commit silently.
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

type SaveState = "idle" | "saving" | "saved";

/** Per-row "Saved ✓" affordance: fades in on save, clears after a beat. */
function useFlash() {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<number | undefined>(undefined);
  function flash() {
    setState("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setState("saved");
      timer.current = window.setTimeout(() => setState("idle"), 1600);
    }, 350);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { state, flash };
}

function SavedTick({ state }: { state: SaveState }) {
  return (
    <span
      aria-live="polite"
      className={`text-xs tabular-nums transition-opacity duration-300 ${
        state === "idle" ? "opacity-0" : "opacity-100"
      } ${state === "saved" ? "text-[var(--success)]" : "text-[var(--faint)]"}`}
    >
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "·"}
    </span>
  );
}

const ghostInput =
  "w-full rounded-md bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)] transition " +
  "hover:bg-[var(--surface)] focus:bg-[var(--surface)] focus:outline focus:outline-2 " +
  "focus:outline-[var(--accent)] placeholder:text-[var(--faint)]";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-2 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint)]">
      {children}
    </h3>
  );
}

/** label-left / control-right row on a hairline. */
function Row({
  label,
  hint,
  children,
  flash,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  flash?: SaveState;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-1 border-b border-[var(--border)] py-3.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center sm:gap-6">
      <div className="px-2">
        <div className="text-sm font-semibold text-[var(--foreground)]">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-[var(--muted)]">{hint}</div>}
      </div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {flash !== undefined && <SavedTick state={flash} />}
      </div>
    </div>
  );
}

function MiniToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-[var(--border)] p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
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

export function LinearMinimal() {
  const heightUnit: "in" | "cm" = PROFILE_FIXTURE.distance_unit === "km" ? "cm" : "in";

  const [name, setName] = useState(PROFILE_FIXTURE.display_name);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameFlash = useFlash();

  const [handle, setHandle] = useState(PROFILE_FIXTURE.username ?? "");
  // Store only the resolved probe; idle/checking are DERIVED so we never
  // setState synchronously inside the effect.
  const [probe, setProbe] = useState<{ handle: string; result: Availability } | null>(null);
  const handleFlash = useFlash();

  const [bio, setBio] = useState(PROFILE_FIXTURE.bio);
  const bioFlash = useFlash();

  const [height, setHeight] = useState(heightToDisplay(PROFILE_FIXTURE.height_cm, heightUnit));
  const heightFlash = useFlash();

  const [distance, setDistance] = useState(PROFILE_FIXTURE.distance_unit);
  const distFlash = useFlash();
  const [weight, setWeight] = useState(PROFILE_FIXTURE.weight_unit);
  const weightFlash = useFlash();
  const [detail, setDetail] = useState(PROFILE_FIXTURE.calendar_default_detail);
  const detailFlash = useFlash();
  const [calConnected, setCalConnected] = useState(true);

  // Debounced availability probe while typing a valid, changed handle.
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
    <div className="mx-auto max-w-2xl font-sans">
      <h2 className="px-2 text-lg font-bold tracking-tight">Settings</h2>
      <p className="mb-4 px-2 text-xs text-[var(--muted)]">Changes save automatically.</p>

      <SectionHeader>Profile</SectionHeader>
      <div className="mb-2">
        <Row label="Avatar" flash={undefined}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-bold uppercase">
              {initialsOf(name)}
            </span>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] underline-offset-2 transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            >
              Upload
            </button>
          </div>
        </Row>

        <Row label="Display name" hint="The name your coach calls you by." flash={nameFlash.state}>
          <input
            aria-label="Display name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (!name.trim()) {
                setNameError("Display name is required.");
                return;
              }
              setNameError(null);
              nameFlash.flash();
            }}
            className={ghostInput}
          />
          {nameError && <p className="px-2 pt-1 text-xs text-[var(--danger)]">{nameError}</p>}
        </Row>

        <Row
          label="Username"
          hint="Public @handle. Changing it breaks the old link — no redirect."
          flash={handleFlash.state}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-[var(--muted)]">@</span>
            <input
              aria-label="Username"
              value={handle}
              maxLength={30}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              onBlur={() => {
                if (charsetOk && availability.kind === "available") handleFlash.flash();
              }}
              className={ghostInput}
            />
          </div>
          <AvailabilityLine
            availability={availability}
            charsetOk={charsetOk}
            dirty={handleDirty}
            handle={normalized}
          />
        </Row>

        <Row label="Bio" hint="A short blurb on your public profile." flash={bioFlash.state}>
          <textarea
            aria-label="Bio"
            rows={2}
            value={bio}
            onChange={(e) => setBio(clampRunes(e.target.value, BIO_MAX_RUNES))}
            onBlur={() => bioFlash.flash()}
            className={`${ghostInput} resize-none`}
          />
          <p className="px-2 pt-0.5 text-right text-xs tabular-nums text-[var(--faint)]">
            {runeLength(bio)}/{BIO_MAX_RUNES}
          </p>
        </Row>

        <Row
          label="Height"
          hint={
            height
              ? `Shown in ${heightUnit === "in" ? "inches" : "centimeters"}.`
              : "No height set."
          }
          flash={heightFlash.state}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="any"
              min={0}
              aria-label={`Height (${heightUnit})`}
              placeholder={heightUnit === "in" ? "e.g. 69" : "e.g. 175"}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              onBlur={() => heightFlash.flash()}
              className={`${ghostInput} tabular-nums`}
            />
            <span className="text-xs text-[var(--muted)]">{heightUnit}</span>
          </div>
        </Row>
      </div>

      <SectionHeader>Usage</SectionHeader>
      <Row label="Daily AI allowance" hint={`Resets in ${USAGE_FIXTURE.resetsInLabel}.`}>
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
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
      </Row>

      <SectionHeader>Units</SectionHeader>
      <Row
        label="Distance"
        hint="Running distances, paces, and the unit Height uses."
        flash={distFlash.state}
      >
        <MiniToggle
          value={distance}
          options={[
            { value: "mi", label: "Miles" },
            { value: "km", label: "Kilometers" },
          ]}
          onChange={(v) => {
            setDistance(v);
            distFlash.flash();
          }}
        />
      </Row>
      <Row label="Weight" hint="Bodyweight and workout volume." flash={weightFlash.state}>
        <MiniToggle
          value={weight}
          options={[
            { value: "lb", label: "Pounds" },
            { value: "kg", label: "Kilograms" },
          ]}
          onChange={(v) => {
            setWeight(v);
            weightFlash.flash();
          }}
        />
      </Row>

      <SectionHeader>Google Calendar</SectionHeader>
      <Row label="Calendar sync" hint={calConnected ? "Connected." : "Not connected."}>
        <button
          type="button"
          onClick={() => setCalConnected((c) => !c)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            calConnected
              ? "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
              : "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90"
          }`}
        >
          {calConnected ? "Disconnect" : "Connect Google Calendar"}
        </button>
      </Row>
      <Row label="Default event detail" hint="What a synced event shows." flash={detailFlash.state}>
        <MiniToggle
          value={detail}
          options={[
            { value: "time_block", label: "Time block" },
            { value: "full_agenda", label: "Full agenda" },
          ]}
          onChange={(v) => {
            setDetail(v);
            detailFlash.flash();
          }}
        />
      </Row>
    </div>
  );
}

function AvailabilityLine({
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
  if (dirty && handle !== "" && !charsetOk) {
    return (
      <p className="px-2 pt-1 text-xs text-[var(--danger)]">
        3–30 chars: start with a letter, then lowercase letters, numbers, or underscores.
      </p>
    );
  }
  if (availability.kind === "checking")
    return <p className="px-2 pt-1 text-xs text-[var(--muted)]">Checking availability…</p>;
  if (availability.kind === "available")
    return <p className="px-2 pt-1 text-xs text-[var(--success)]">@{handle} is available.</p>;
  if (availability.kind === "taken")
    return <p className="px-2 pt-1 text-xs text-[var(--danger)]">@{handle} is taken.</p>;
  if (availability.kind === "reserved")
    return <p className="px-2 pt-1 text-xs text-[var(--danger)]">@{handle} is reserved.</p>;
  return null;
}
