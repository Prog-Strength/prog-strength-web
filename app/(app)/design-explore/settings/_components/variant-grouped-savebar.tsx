"use client";

/**
 * IDIOM: grouped-savebar — draws on Vercel / GitHub account settings.
 *
 * - Type scale: mid form-label scale, comfortable; clear card titles over
 *   regular-weight field labels.
 * - Color logic: neutral slate cards carry no accent at rest. Violet is
 *   CONCENTRATED on the single sticky save bar — the page's one call to
 *   action — and the active toggle segment.
 * - Spacing rhythm: roomy sectioned cards with clear breaks between
 *   groups; fields breathe inside each card.
 * - Save model: edits accumulate in local state with NO per-field button.
 *   The moment anything is dirty a sticky "Save changes" bar slides up
 *   from the bottom with a dirty count and a Discard affordance. The
 *   username probe + validation gate the bar, not individual rows.
 *
 * Throwaway DX mockup: state is local, nothing is wired to a service.
 */

import { useEffect, useState } from "react";
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

const heightUnit: "in" | "cm" = PROFILE_FIXTURE.distance_unit === "km" ? "cm" : "in";

const initial = {
  name: PROFILE_FIXTURE.display_name,
  handle: PROFILE_FIXTURE.username ?? "",
  bio: PROFILE_FIXTURE.bio,
  height: heightToDisplay(PROFILE_FIXTURE.height_cm, heightUnit),
  distance: PROFILE_FIXTURE.distance_unit,
  weight: PROFILE_FIXTURE.weight_unit,
  detail: PROFILE_FIXTURE.calendar_default_detail,
};
type Draft = typeof initial;

const fieldInput =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm " +
  "transition focus:outline focus:outline-2 focus:outline-[var(--accent)]";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
      <h3 className="border-b border-[var(--border)] px-6 py-4 text-sm font-bold tracking-tight">
        {title}
      </h3>
      <div className="flex flex-col gap-5 px-6 py-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
    </label>
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

export function GroupedSavebar() {
  const [draft, setDraft] = useState<Draft>(initial);
  const [savedFlash, setSavedFlash] = useState(false);
  // Store only the resolved probe; idle/checking are derived (no sync
  // setState in the effect).
  const [probe, setProbe] = useState<{ handle: string; result: Availability } | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const normalized = draft.handle.trim().toLowerCase();
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

  // Which fields differ from the persisted profile.
  const dirtyKeys = (Object.keys(initial) as (keyof Draft)[]).filter(
    (k) => draft[k] !== initial[k],
  );
  const dirtyCount = dirtyKeys.length;

  const nameEmpty = !draft.name.trim();
  const handleBlocked =
    handleDirty &&
    (!charsetOk ||
      availability.kind === "taken" ||
      availability.kind === "reserved" ||
      availability.kind === "checking");
  const canSave = dirtyCount > 0 && !nameEmpty && !handleBlocked;

  function save() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
    // A real implementation would PATCH /me here; the mock just "commits"
    // by treating the current draft as the new baseline.
    Object.assign(initial, draft);
    setDraft({ ...draft });
  }

  return (
    <div className="relative mx-auto max-w-2xl font-sans">
      <h2 className="mb-5 text-lg font-bold tracking-tight">Settings</h2>

      <div className="flex flex-col gap-6 pb-24">
        <Card title="Profile">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-lg font-bold uppercase">
              {initialsOf(draft.name)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)]"
              >
                Upload
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">PNG, JPG, or WebP, up to 2 MB.</p>
          </div>

          <Field label="Display name" hint="The name your coach calls you by.">
            <input
              aria-label="Display name"
              value={draft.name}
              maxLength={60}
              onChange={(e) => set("name", e.target.value)}
              className={fieldInput}
            />
            {nameEmpty && (
              <span className="text-xs text-[var(--danger)]">Display name is required.</span>
            )}
          </Field>

          <Field label="Username">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--muted)]">@</span>
              <input
                aria-label="Username"
                value={draft.handle}
                maxLength={30}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => set("handle", e.target.value.toLowerCase())}
                className={fieldInput}
              />
            </div>
            <HandleStatus
              availability={availability}
              charsetOk={charsetOk}
              dirty={handleDirty}
              handle={normalized}
            />
          </Field>

          <Field label="Bio" hint="A short blurb shown on your public profile.">
            <textarea
              aria-label="Bio"
              rows={3}
              value={draft.bio}
              onChange={(e) => set("bio", clampRunes(e.target.value, BIO_MAX_RUNES))}
              className={`${fieldInput} resize-none`}
            />
            <span className="self-end text-xs tabular-nums text-[var(--muted)]">
              {runeLength(draft.bio)}/{BIO_MAX_RUNES}
            </span>
          </Field>

          <Field
            label="Height"
            hint={
              draft.height
                ? `Shown in ${heightUnit === "in" ? "inches" : "centimeters"}.`
                : "No height set."
            }
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min={0}
                aria-label={`Height (${heightUnit})`}
                placeholder={heightUnit === "in" ? "e.g. 69" : "e.g. 175"}
                value={draft.height}
                onChange={(e) => set("height", e.target.value)}
                className={`${fieldInput} tabular-nums max-w-[8rem]`}
              />
              <span className="text-xs text-[var(--muted)]">{heightUnit}</span>
            </div>
          </Field>
        </Card>

        <Card title="Usage">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Daily AI allowance</span>
              <span className="text-xs tabular-nums text-[var(--muted)]">
                Resets in {USAGE_FIXTURE.resetsInLabel}
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
          </div>
        </Card>

        <Card title="Units">
          <Field label="Distance" hint="Running distances, paces, and the unit Height uses.">
            <Toggle
              value={draft.distance}
              options={[
                { value: "mi", label: "Miles" },
                { value: "km", label: "Kilometers" },
              ]}
              onChange={(v) => set("distance", v)}
            />
          </Field>
          <Field label="Weight" hint="Bodyweight and workout volume.">
            <Toggle
              value={draft.weight}
              options={[
                { value: "lb", label: "Pounds" },
                { value: "kg", label: "Kilograms" },
              ]}
              onChange={(v) => set("weight", v)}
            />
          </Field>
        </Card>

        <Card title="Google Calendar">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Calendar sync</p>
              <p className="text-xs text-[var(--muted)]">Connected. Planned workouts can sync.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)]"
            >
              Disconnect
            </button>
          </div>
          <Field label="Default event detail" hint="What a synced event shows.">
            <Toggle
              value={draft.detail}
              options={[
                { value: "time_block", label: "Time block" },
                { value: "full_agenda", label: "Full agenda" },
              ]}
              onChange={(v) => set("detail", v)}
            />
          </Field>
        </Card>
      </div>

      {/* Sticky save bar — the one place violet lives, appears only when dirty. */}
      {(dirtyCount > 0 || savedFlash) && (
        <div className="sticky bottom-4 z-10 mt-2">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--accent-line)] bg-[var(--surface-2)] px-5 py-3 shadow-[var(--shadow-soft)]">
            <p className="text-sm">
              {savedFlash ? (
                <span className="font-medium text-[var(--success)]">All changes saved ✓</span>
              ) : (
                <>
                  <span className="font-semibold">
                    {dirtyCount} unsaved {dirtyCount === 1 ? "change" : "changes"}
                  </span>
                  {handleBlocked && (
                    <span className="ml-2 text-xs text-[var(--warning)]">
                      {availability.kind === "checking"
                        ? "checking username…"
                        : "fix username first"}
                    </span>
                  )}
                </>
              )}
            </p>
            {!savedFlash && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...initial })}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!canSave}
                  className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-50"
                >
                  Save changes
                </button>
              </div>
            )}
          </div>
        </div>
      )}
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
      Your public handle and profile URL. The old link stops working.
    </span>
  );
}
