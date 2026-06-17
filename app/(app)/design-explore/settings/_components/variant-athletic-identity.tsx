"use client";

/**
 * IDIOM: athletic-identity — draws on Whoop's stat-forward identity, in
 * our voice.
 *
 * - Type scale: the SCOPED condensed athletic display face (Oswald, our
 *   `font-display`) carries the name and the big allowance numeral;
 *   Nunito does everything else. Large display + small supporting text =
 *   a deliberate two-tier scale.
 * - Color logic: violet used CONFIDENTLY as a primary (the hero panel,
 *   Edit buttons); the allowance is a bold stat RING carrying the
 *   amber/red threshold — Whoop's dial language, not a thin bar.
 * - Spacing rhythm: punchy, card-forward, deliberate gaps between
 *   sections; the profile is reframed as a hero identity card that reads
 *   like the top of the user's own public profile.
 * - Save model: per-section EDIT mode. A section is read-only display
 *   until you hit Edit, which flips its fields editable with Save /
 *   Cancel for the whole group — so identity isn't a perpetual row of
 *   inputs.
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

const editInput =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm " +
  "transition focus:outline focus:outline-2 focus:outline-[var(--accent)]";

/** Whoop-style allowance dial. Read-only by construction — a ring can't be dragged. */
function AllowanceRing({ percent }: { percent: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const fill = Math.min(100, Math.max(0, percent));
  const color = usageColor(percent);
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fill / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold leading-none" style={{ color }}>
          {percent}%
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          used
        </span>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
        {label}
      </div>
      <div className="font-display text-xl font-semibold leading-tight">{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  editing,
  onEdit,
  onSave,
  onCancel,
  canSave = true,
  children,
}: {
  title: string;
  editing?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  canSave?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold uppercase tracking-wide">{title}</h3>
        {onEdit &&
          (editing ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave}
                className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-[var(--accent-line)] px-4 py-1.5 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
            >
              Edit
            </button>
          ))}
      </div>
      {children}
    </section>
  );
}

export function AthleticIdentity() {
  // Committed profile + a draft used only while editing.
  const [committed, setCommitted] = useState({
    name: PROFILE_FIXTURE.display_name,
    handle: PROFILE_FIXTURE.username ?? "",
    bio: PROFILE_FIXTURE.bio,
    height: heightToDisplay(PROFILE_FIXTURE.height_cm, heightUnit),
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(committed);
  const [probe, setProbe] = useState<{ handle: string; result: Availability } | null>(null);

  const [distance, setDistance] = useState(PROFILE_FIXTURE.distance_unit);
  const [weight, setWeight] = useState(PROFILE_FIXTURE.weight_unit);
  const [unitsEditing, setUnitsEditing] = useState(false);
  const [unitsDraft, setUnitsDraft] = useState({ distance, weight });

  const normalized = draft.handle.trim().toLowerCase();
  const handleDirty = normalized !== (PROFILE_FIXTURE.username ?? "");
  const charsetOk = USERNAME_RE.test(normalized);
  useEffect(() => {
    if (!editing || !handleDirty || !charsetOk) return;
    const t = window.setTimeout(
      () => setProbe({ handle: normalized, result: resolveAvailability(normalized) }),
      500,
    );
    return () => window.clearTimeout(t);
  }, [normalized, handleDirty, charsetOk, editing]);
  const availability: Availability =
    !editing || !handleDirty || !charsetOk
      ? { kind: "idle" }
      : probe?.handle === normalized
        ? probe.result
        : { kind: "checking" };

  const nameOk = draft.name.trim().length > 0;
  const handleOk =
    !handleDirty ||
    (charsetOk && (availability.kind === "available" || availability.kind === "idle"));
  const canSaveProfile = nameOk && handleOk && availability.kind !== "checking";

  const heightStat = committed.height === "" ? "—" : `${committed.height} ${heightUnit}`;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 font-sans">
      {/* HERO identity card */}
      <SectionCard
        title="Athlete"
        editing={editing}
        canSave={canSaveProfile}
        onEdit={() => {
          setDraft(committed);
          setEditing(true);
        }}
        onSave={() => {
          if (!canSaveProfile) return;
          setCommitted(draft);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      >
        {!editing ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-5 rounded-2xl bg-gradient-to-br from-[var(--accent-soft)] to-transparent p-5">
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent-line)] bg-[var(--surface-2)] font-display text-4xl font-bold uppercase">
                {initialsOf(committed.name)}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-4xl font-bold uppercase leading-none tracking-wide">
                  {committed.name}
                </h2>
                <p className="mt-1 text-sm font-semibold text-[var(--accent)]">
                  @{committed.handle || "—"}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">{committed.bio || "No bio yet."}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatChip label="Height" value={heightStat} />
              <StatChip label="Weighs in" value={weight === "lb" ? "Pounds" : "Kilograms"} />
              <StatChip label="Distance" value={distance === "mi" ? "Miles" : "Kilometers"} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface-2)] font-display text-3xl font-bold uppercase">
                {initialsOf(draft.name)}
              </span>
              <button
                type="button"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)]"
              >
                Change avatar
              </button>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">
                Display name
              </span>
              <input
                aria-label="Display name"
                value={draft.name}
                maxLength={60}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className={editInput}
              />
              {!nameOk && (
                <span className="text-xs text-[var(--danger)]">Display name is required.</span>
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">
                Username
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--muted)]">@</span>
                <input
                  aria-label="Username"
                  value={draft.handle}
                  maxLength={30}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, handle: e.target.value.toLowerCase() }))
                  }
                  className={editInput}
                />
              </div>
              <HandleStatus
                availability={availability}
                charsetOk={charsetOk}
                dirty={handleDirty}
                handle={normalized}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">
                Bio
              </span>
              <textarea
                aria-label="Bio"
                rows={2}
                value={draft.bio}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, bio: clampRunes(e.target.value, BIO_MAX_RUNES) }))
                }
                className={`${editInput} resize-none`}
              />
              <span className="self-end text-xs tabular-nums text-[var(--muted)]">
                {runeLength(draft.bio)}/{BIO_MAX_RUNES}
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">
                Height ({heightUnit})
              </span>
              <input
                type="number"
                step="any"
                min={0}
                aria-label={`Height (${heightUnit})`}
                value={draft.height}
                onChange={(e) => setDraft((d) => ({ ...d, height: e.target.value }))}
                className={`${editInput} tabular-nums max-w-[10rem]`}
              />
            </label>
          </div>
        )}
      </SectionCard>

      {/* Allowance dial */}
      <SectionCard title="Daily allowance">
        <div className="flex items-center gap-6">
          <AllowanceRing percent={USAGE_FIXTURE.percentUsed} />
          <div>
            <p className="text-sm font-semibold">AI coach allowance</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Resets in {USAGE_FIXTURE.resetsInLabel}.
            </p>
            <span className="mt-3 inline-block rounded-full bg-[var(--surface-2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
              Status · read-only
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Units — its own edit group */}
      <SectionCard
        title="Units"
        editing={unitsEditing}
        onEdit={() => {
          setUnitsDraft({ distance, weight });
          setUnitsEditing(true);
        }}
        onSave={() => {
          setDistance(unitsDraft.distance);
          setWeight(unitsDraft.weight);
          setUnitsEditing(false);
        }}
        onCancel={() => setUnitsEditing(false)}
      >
        {!unitsEditing ? (
          <div className="flex flex-wrap gap-3">
            <StatChip label="Distance" value={distance === "mi" ? "Miles" : "Kilometers"} />
            <StatChip label="Weight" value={weight === "lb" ? "Pounds" : "Kilograms"} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Picker
              label="Distance"
              value={unitsDraft.distance}
              options={[
                { value: "mi", label: "Miles" },
                { value: "km", label: "Kilometers" },
              ]}
              onChange={(v) => setUnitsDraft((d) => ({ ...d, distance: v }))}
            />
            <Picker
              label="Weight"
              value={unitsDraft.weight}
              options={[
                { value: "lb", label: "Pounds" },
                { value: "kg", label: "Kilograms" },
              ]}
              onChange={(v) => setUnitsDraft((d) => ({ ...d, weight: v }))}
            />
          </div>
        )}
      </SectionCard>

      {/* Calendar */}
      <SectionCard title="Calendar">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Google Calendar</p>
            <p className="text-xs text-[var(--muted)]">Connected · events sync as time blocks.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)]"
          >
            Disconnect
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">
        {label}
      </span>
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
  return null;
}
