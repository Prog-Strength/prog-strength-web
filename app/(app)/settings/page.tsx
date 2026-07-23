"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { useProfile } from "@/lib/profile-context";
import { useToast } from "@/components/toast";
import { UsageBar } from "@/components/usage-bar";
import { getToken } from "@/lib/auth";
import { config } from "@/lib/config";
import {
  disconnectCalendar,
  getCalendarConnection,
  type CalendarConnection,
  type ResolvedProfile,
} from "@/lib/api";
import {
  type Draft,
  type DraftKey,
  type HeightUnit,
  BIO_MAX_RUNES,
  clampRunes,
  displayToCm,
  dirtyKeys,
  draftFromProfile,
  heightToDisplay,
  heightUnitFor,
  initialsOf,
  patchFromDraft,
  runeLength,
} from "./_components/draft";
import { Card, Field, inputClass } from "./_components/primitives";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { SaveBar } from "./_components/SaveBar";
import { UsernameField } from "./_components/UsernameField";
import { WhoopConnectionRow } from "./_components/whoop-connection-row";

/**
 * Settings. A single page-level `draft` holds every editable profile field,
 * diffed against an immutable `initial` baseline captured from `useProfile()`.
 * Editing any field mutates `draft` only — nothing saves on its own; a sticky
 * `SaveBar` appears when there are dirty keys and issues one `update(patch)` of
 * only the changed keys. Avatar upload/remove and calendar connect/disconnect
 * stay as immediate, out-of-band actions (not part of the draft).
 */

// Avatar client-side guards — UX only; the API is authoritative (2 MB,
// image/png|jpeg|webp). Catching here gives a snappier rejection.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const SAVED_FLASH_MS = 1800;

// A blank draft for the brief window before the profile resolves.
const EMPTY_DRAFT: Draft = {
  display_name: "",
  username: "",
  bio: "",
  height: "",
  birthdate: "",
  sex: "",
  distance_unit: "mi",
  weight_unit: "lb",
  calendar_default_detail: "time_block",
};

/**
 * Re-express a height display string from one unit to another, preserving the
 * underlying cm so flipping the distance toggle back and forth doesn't mark
 * the height dirty. If the current display is unparseable, leave it as typed.
 */
function reexpressHeight(display: string, fromUnit: HeightUnit, toUnit: HeightUnit): string {
  if (fromUnit === toUnit) return display;
  try {
    const cm = displayToCm(display, fromUnit);
    return heightToDisplay(cm, toUnit);
  } catch {
    return display;
  }
}

type SettingsTab = "profile" | "integrations";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "integrations", label: "Integrations" },
];

/**
 * Outer Suspense wrapper so the inner component can call `useSearchParams`
 * without tripping Next 16's prerender requirement (mirrors the validated
 * activities/nutrition page pattern).
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const toast = useToast();
  const router = useRouter();
  const search = useSearchParams();
  const { setUnit } = useDistanceUnit();

  // URL-addressable tabs: the active tab is read from ?tab= (default profile),
  // so `return_to=/settings?tab=integrations` round-trips through OAuth and
  // lands the user back on Integrations. Selecting a tab replaces the URL
  // (shallow) rather than pushing, keeping the back button out of the tabs.
  const rawTab = search.get("tab");
  const tab: SettingsTab = rawTab === "integrations" ? "integrations" : "profile";
  const selectTab = (next: SettingsTab) => {
    router.replace(next === "profile" ? "/settings" : "/settings?tab=integrations");
  };
  const { profile, update, uploadAvatar, removeAvatar } = useProfile();

  // The baseline we re-seed from: only updated (a) on first load and (b) right
  // after a successful save, so unrelated context re-renders don't clobber
  // in-progress edits. `draftFromProfile` builds an empty-ish draft for a null
  // profile so the cards can render a disabled shell while loading.
  const [baseline, setBaseline] = useState<ResolvedProfile | null>(profile);
  const [initial, setInitial] = useState<Draft>(() =>
    profile ? draftFromProfile(profile) : EMPTY_DRAFT,
  );
  const [draft, setDraft] = useState<Draft>(initial);

  // Re-seed `initial` + `draft` when the baseline profile identity changes
  // (first load, or after a save bumps the baseline). Mirrors the old per-field
  // rows' deliberate re-seed effect.
  useEffect(() => {
    if (!baseline) return;
    const next = draftFromProfile(baseline);
    setInitial(next);
    setDraft(next);
    // We intentionally re-seed only on a baseline change, not on every draft
    // edit — matching the old rows' re-seed idiom.
  }, [baseline]);

  // Adopt the profile as the baseline on first load (profile goes null → set).
  useEffect(() => {
    if (profile && !baseline) setBaseline(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const [saving, setSaving] = useState(false);
  const [handleBlocked, setHandleBlocked] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const disabled = !profile;
  const heightUnit = heightUnitFor(draft.distance_unit);

  function set<K extends DraftKey>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // Distance flip re-expresses the height display (and its baseline) into the
  // new unit so the underlying cm is preserved.
  function setDistance(next: "mi" | "km") {
    if (next === draft.distance_unit) return;
    const fromUnit = heightUnitFor(draft.distance_unit);
    const toUnit = heightUnitFor(next);
    setDraft((d) => ({
      ...d,
      distance_unit: next,
      height: reexpressHeight(d.height, fromUnit, toUnit),
    }));
    setInitial((i) => ({ ...i, height: reexpressHeight(i.height, fromUnit, toUnit) }));
  }

  const handleOnBlocked = useCallback((b: boolean) => setHandleBlocked(b), []);

  const dirty = dirtyKeys(initial, draft);
  const dirtyCount = dirty.length;
  const nameEmpty = draft.display_name.trim() === "";
  const canSave = dirtyCount > 0 && !nameEmpty && !handleBlocked && !saving;
  const blockReason = nameEmpty
    ? "Add a display name to save"
    : handleBlocked
      ? "Fix the username to save"
      : null;

  function discard() {
    setDraft(initial);
    setNameTouched(false);
  }

  async function save() {
    if (dirtyCount === 0) return;
    const distanceDirty = dirty.includes("distance_unit");
    let patch: ReturnType<typeof patchFromDraft>;
    try {
      patch = patchFromDraft(initial, draft);
    } catch (err: unknown) {
      // displayToCm can throw on an invalid height — surface it and abort.
      toast.error(err instanceof Error ? err.message : "Enter a valid height.");
      return;
    }
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    try {
      const next = await update(patch);
      // Re-baseline from the returned profile so the bar retracts.
      setBaseline(next);
      setNameTouched(false);
      if (distanceDirty) setUnit(next.distance_unit);
      setSavedFlash(true);
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setSavedFlash(false), SAVED_FLASH_MS);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <SettingsTabs value={tab} onChange={selectTab} />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {/* Profile panel: profile fields, AI allowance, and units. The
              draft lives on the parent, so switching tabs never drops
              in-progress edits and the SaveBar (rendered below the panels)
              still surfaces a dirty calendar default-detail change made on
              the Integrations tab. */}
          {tab === "profile" && (
            <>
              {/* Profile: avatar, display name, username, bio, and height (its unit
              follows the distance toggle per the plan's decision note). */}
              <Card title="Profile">
                <AvatarRow
                  avatarUrl={profile?.avatar_url ?? null}
                  displayName={draft.display_name}
                  disabled={disabled}
                  onPick={async (file) => {
                    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
                      toast.error("Use PNG, JPG, or WebP.");
                      return;
                    }
                    if (file.size > MAX_AVATAR_BYTES) {
                      toast.error("Image must be under 2 MB.");
                      return;
                    }
                    try {
                      await uploadAvatar(file);
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
                    }
                  }}
                  onRemove={async () => {
                    try {
                      await removeAvatar();
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : "Failed to remove avatar");
                    }
                  }}
                />

                <Field
                  label="Display name"
                  htmlFor="settings-display-name"
                  hint={
                    nameTouched && nameEmpty ? (
                      <span className="text-[var(--danger)]">Display name is required.</span>
                    ) : (
                      "The name your coach calls you by."
                    )
                  }
                >
                  <input
                    id="settings-display-name"
                    type="text"
                    aria-label="Display name"
                    value={draft.display_name}
                    maxLength={60}
                    disabled={disabled}
                    onChange={(e) => set("display_name", e.target.value)}
                    onBlur={() => setNameTouched(true)}
                    className={`${inputClass} w-full`}
                  />
                </Field>

                <Field
                  label="Username"
                  hint="Your public handle and profile URL. Changing it changes your profile link — the old one stops working (there's no redirect)."
                >
                  <UsernameField
                    value={draft.username}
                    original={initial.username}
                    disabled={disabled}
                    onChange={(next) => set("username", next)}
                    onBlockedChange={handleOnBlocked}
                  />
                </Field>

                <Field
                  label="Bio"
                  hint={
                    <span className="flex items-center justify-between gap-2">
                      <span>A short blurb shown on your public profile.</span>
                      <span className="tabular-nums text-[var(--muted)]">
                        {runeLength(draft.bio)}/{BIO_MAX_RUNES}
                      </span>
                    </span>
                  }
                >
                  <textarea
                    aria-label="Bio"
                    rows={3}
                    value={draft.bio}
                    disabled={disabled}
                    onChange={(e) => set("bio", clampRunes(e.target.value, BIO_MAX_RUNES))}
                    className={`${inputClass} w-full resize-none`}
                  />
                </Field>

                <Field
                  label={`Height (${heightUnit})`}
                  hint={`Shown in ${heightUnit === "in" ? "inches" : "centimeters"}; leave blank to clear.`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min={0}
                      aria-label={`Height (${heightUnit})`}
                      placeholder={heightUnit === "in" ? "e.g. 71" : "e.g. 180"}
                      value={draft.height}
                      disabled={disabled}
                      onChange={(e) => set("height", e.target.value)}
                      className={`${inputClass} min-w-0 flex-1 tabular-nums`}
                    />
                    <span className="shrink-0 text-xs text-[var(--muted)]">{heightUnit}</span>
                  </div>
                </Field>

                <Field
                  label="Birthdate"
                  hint="Optional. Improves running max-effort estimates (YYYY-MM-DD)."
                >
                  <input
                    type="date"
                    aria-label="Birthdate"
                    value={draft.birthdate}
                    disabled={disabled}
                    onChange={(e) => set("birthdate", e.target.value)}
                    className={`${inputClass} w-full tabular-nums`}
                  />
                </Field>

                <Field
                  label="Sex (for running estimates)"
                  hint="Optional. Used only for running pace projections."
                >
                  <select
                    aria-label="Sex for running estimates"
                    value={draft.sex}
                    disabled={disabled}
                    onChange={(e) => set("sex", e.target.value as Draft["sex"])}
                    className={`${inputClass} w-full`}
                  >
                    <option value="">Not set</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>
              </Card>

              {/* Daily AI allowance: read-only, excluded from the draft/dirty set. */}
              <Card title="Daily AI allowance">
                <UsageBar />
                <p className="text-xs text-[var(--muted)]">
                  This resets daily and isn&apos;t something you can change here.
                </p>
              </Card>

              {/* Units: distance + weight. Distance also drives the height unit. */}
              <Card title="Units">
                <Field
                  label="Distance"
                  hint="Used across the Running views for distances and paces — and for your height unit."
                >
                  <SegmentedToggle
                    value={draft.distance_unit}
                    disabled={disabled}
                    options={[
                      { value: "mi", label: "Miles" },
                      { value: "km", label: "Kilometers" },
                    ]}
                    onChange={setDistance}
                  />
                </Field>

                <Field label="Weight" hint="Used for bodyweight and workout volume.">
                  <SegmentedToggle
                    value={draft.weight_unit}
                    disabled={disabled}
                    options={[
                      { value: "lb", label: "Pounds" },
                      { value: "kg", label: "Kilograms" },
                    ]}
                    onChange={(v) => set("weight_unit", v)}
                  />
                </Field>
              </Card>
            </>
          )}

          {/* Integrations panel: calendar (moved unchanged, incl. its
              default-detail draft field) + Whoop. Connect/disconnect are
              immediate/out-of-band; the calendar default-detail toggle stays a
              draft field, so a change here surfaces the page-level SaveBar. */}
          {tab === "integrations" && (
            <>
              {/* Google Calendar: connect/disconnect immediate; default detail draftable. */}
              <Card title="Google Calendar">
                <GoogleCalendarConnectionRow />

                <Field
                  label="Default event detail"
                  hint="What a synced calendar event shows for a planned workout."
                >
                  <SegmentedToggle
                    value={draft.calendar_default_detail}
                    disabled={disabled}
                    options={[
                      { value: "time_block", label: "Time block" },
                      { value: "full_agenda", label: "Full agenda" },
                    ]}
                    onChange={(v) => set("calendar_default_detail", v)}
                  />
                </Field>
              </Card>

              {/* Whoop: recovery/strain sync. Connect/disconnect/reconnect are
              immediate/out-of-band, mirroring the calendar row. */}
              <Card title="Whoop">
                <WhoopConnectionRow />
              </Card>
            </>
          )}

          <SaveBar
            dirtyCount={dirtyCount}
            canSave={canSave}
            blockReason={blockReason}
            savedFlash={savedFlash}
            saving={saving}
            onSave={save}
            onDiscard={discard}
          />
        </div>
      </div>
    </main>
  );
}

/**
 * Settings tab header. The first tab control in Settings, so it borrows the
 * existing full-pill segmented-control idiom (a `--surface` track with a
 * hairline border; active segment = `--accent` fill + `--accent-fg` text;
 * inactive = `--muted`, brightening to `--foreground` on hover) rather than
 * inventing a new pattern. Tabs are exposed as a tablist for accessibility.
 */
function SettingsTabs({
  value,
  onChange,
}: {
  value: SettingsTab;
  onChange: (next: SettingsTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5"
    >
      {TABS.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) onChange(t.id);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Google Calendar connection row. Reads the connection state on mount.
 * When absent/revoked, a Connect button navigates the browser to the API's
 * OAuth connect endpoint (which redirects to Google then back to /settings).
 * When connected, shows the connected state + a Disconnect button that revokes
 * server-side and refreshes the row. Immediate / out-of-band (not in the draft).
 */
function GoogleCalendarConnectionRow() {
  const toast = useToast();
  const [conn, setConn] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // `isCancelled` lets the mount effect drop late updates after unmount
  // (mirrors UsernameField's `cancelled` idiom); `disconnect()` calls it
  // without a guard, so it defaults to never-cancelled.
  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    const token = getToken();
    if (!token) {
      if (isCancelled()) return;
      setLoading(false);
      return;
    }
    try {
      const next = await getCalendarConnection(token);
      if (isCancelled()) return;
      setConn(next);
    } catch {
      // Treat a read failure as "not connected" — the Connect button is a
      // safe default and re-running the OAuth flow is idempotent.
      if (isCancelled()) return;
      setConn({ status: "absent" });
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  function connect() {
    const returnTo = `${window.location.origin}/settings`;
    window.location.href = `${config.apiUrl}/auth/google/calendar/connect?return_to=${encodeURIComponent(
      returnTo,
    )}`;
  }

  async function disconnect() {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try {
      await disconnectCalendar(token);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect calendar");
    } finally {
      setBusy(false);
    }
  }

  const connected = conn?.status === "connected";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">Calendar sync</p>
        <p className="text-xs text-[var(--muted)]">
          {loading
            ? "Checking connection…"
            : connected
              ? "Connected. Planned workouts can sync to your Google Calendar."
              : "Connect Google Calendar to sync your planned workouts."}
        </p>
      </div>
      <div className="shrink-0">
        {connected ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
          >
            {busy ? "Working…" : "Disconnect"}
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={loading}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
          >
            Connect Google Calendar
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Avatar editor: a preview (current image or initials placeholder), a file
 * picker that uploads on selection, and a Remove button when an avatar is set.
 * Immediate / out-of-band (not part of the draft).
 */
function AvatarRow({
  avatarUrl,
  displayName,
  disabled,
  onPick,
  onRemove,
}: {
  avatarUrl: string | null;
  displayName: string;
  disabled: boolean;
  onPick: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires change.
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await onPick(file);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await onRemove();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <AvatarPreview url={avatarUrl} name={displayName} />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">Avatar</p>
          <p className="text-xs text-[var(--muted)]">PNG, JPG, or WebP, up to 2 MB.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Upload avatar"
          onChange={handlePick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
        >
          {busy ? "Working…" : avatarUrl ? "Change" : "Upload"}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || busy}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function AvatarPreview({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // Presigned S3 / OAuth URLs are arbitrary remote hosts; next/image would
    // require per-host remotePatterns config.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${name.trim() || "Account"} avatar`}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-sm font-semibold uppercase text-[var(--foreground)]"
    >
      {initialsOf(name)}
    </span>
  );
}
