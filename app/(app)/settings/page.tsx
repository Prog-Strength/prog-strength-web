"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { useProfile } from "@/lib/profile-context";
import { useToast } from "@/components/toast";
import { UsageBar } from "@/components/usage-bar";
import { getToken } from "@/lib/auth";
import { config } from "@/lib/config";
import {
  checkUsernameAvailable,
  disconnectCalendar,
  getCalendarConnection,
  type CalendarConnection,
} from "@/lib/api";

/**
 * Settings. A "Profile" section (display name, height, avatar) above a
 * "Units" section (distance + weight segmented controls). Profile fields
 * read/write through the shared `useProfile()` context so edits propagate
 * to the sidebar account row and the chat payload instantly; the distance
 * unit stays on the localStorage-backed DistanceUnitContext.
 */

// Avatar client-side guards — UX only; the API is authoritative (2 MB,
// image/png|jpeg|webp). Catching here gives a snappier rejection.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const CM_PER_INCH = 2.54;

export default function SettingsPage() {
  const toast = useToast();
  const { unit, setUnit } = useDistanceUnit();
  const { profile, update, uploadAvatar, removeAvatar } = useProfile();

  // distance_unit "mi" → height shown in inches; "km" → centimeters.
  // Keyed off the running distance preference per the SOW ("cm or in").
  const heightUnit: "in" | "cm" = profile?.distance_unit === "km" ? "cm" : "in";

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-tight">Profile</h2>

            <DisplayNameRow
              value={profile?.display_name ?? ""}
              disabled={!profile}
              onSave={async (name) => {
                await update({ display_name: name });
              }}
            />

            <UsernameRow
              value={profile?.username ?? ""}
              disabled={!profile}
              onSave={async (username) => {
                await update({ username });
                toast.success("Username updated.");
              }}
            />

            <BioRow
              value={profile?.bio ?? ""}
              disabled={!profile}
              onSave={async (bio) => {
                await update({ bio });
              }}
            />

            <HeightRow
              heightCm={profile?.height_cm ?? null}
              heightUnit={heightUnit}
              disabled={!profile}
              onSave={async (cm) => {
                await update({ height_cm: cm });
              }}
            />

            <AvatarRow
              avatarUrl={profile?.avatar_url ?? null}
              displayName={profile?.display_name ?? ""}
              disabled={!profile}
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
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-tight">Usage</h2>

            <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
              <p className="text-sm font-medium">Daily AI allowance</p>
              <UsageBar />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-tight">Units</h2>

            <SettingRow
              label="Distance"
              description="Used across the Running views for distances and paces."
            >
              <SegmentedControl
                value={unit}
                options={[
                  { value: "mi", label: "Miles" },
                  { value: "km", label: "Kilometers" },
                ]}
                onChange={setUnit}
              />
            </SettingRow>

            <SettingRow label="Weight" description="Used for bodyweight and workout volume.">
              <WeightUnitControl />
            </SettingRow>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-tight">Google Calendar</h2>

            <GoogleCalendarConnectionRow />

            <SettingRow
              label="Default event detail"
              description="What a synced calendar event shows for a planned workout."
            >
              <CalendarDetailControl />
            </SettingRow>
          </section>
        </div>
      </div>
    </main>
  );
}

/**
 * Google Calendar connection row. Reads the connection state on mount.
 * When absent/revoked, a Connect button navigates the browser to the API's
 * OAuth connect endpoint (which redirects to Google then back to
 * /settings). When connected, shows the connected state + a Disconnect
 * button that revokes server-side and refreshes the row.
 */
function GoogleCalendarConnectionRow() {
  const toast = useToast();
  const [conn, setConn] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setConn(await getCalendarConnection(token));
    } catch {
      // Treat a read failure as "not connected" — the Connect button is a
      // safe default and re-running the OAuth flow is idempotent.
      setConn({ status: "absent" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
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
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
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
 * Default calendar-detail segmented control, backed by the shared profile's
 * `calendar_default_detail`. Optimistic like WeightUnitControl.
 */
function CalendarDetailControl() {
  const toast = useToast();
  const { profile, update } = useProfile();
  const [pending, setPending] = useState<"time_block" | "full_agenda" | null>(null);
  const value = pending ?? profile?.calendar_default_detail ?? "time_block";

  function change(next: "time_block" | "full_agenda") {
    if (next === value) return;
    setPending(next);
    update({ calendar_default_detail: next })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Failed to update default detail");
      })
      .finally(() => setPending(null));
  }

  return (
    <SegmentedControl
      value={value}
      disabled={!profile}
      options={[
        { value: "time_block", label: "Time block" },
        { value: "full_agenda", label: "Full agenda" },
      ]}
      onChange={change}
    />
  );
}

/**
 * Display-name editor: a text input with a Save button. Required,
 * non-empty, soft-capped at 60 chars (client maxLength; server is
 * authoritative). Server 400s surface inline.
 */
function DisplayNameRow({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (name: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the draft when the profile loads / changes from elsewhere,
  // but only while the user isn't mid-edit (draft matches nothing yet).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const trimmed = draft.trim();
  const dirty = trimmed !== value.trim();

  async function save() {
    setError(null);
    if (!trimmed) {
      setError("Display name is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save display name");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">Display name</p>
        <p className="text-xs text-[var(--muted)]">The name your coach calls you by.</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label="Display name"
          value={draft}
          maxLength={60}
          disabled={disabled || saving}
          onChange={(e) => setDraft(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={save}
          disabled={disabled || saving || !dirty}
          className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

// Mirrors the server's username validator: 3–30 chars, must start with a
// lowercase letter, then lowercase letters / digits / underscores. The
// server is authoritative (it also enforces a reserved-word list and
// uniqueness, surfaced as 400/409 on save) — this catches the obvious
// charset/length mistakes inline for snappier feedback.
const USERNAME_RE = /^[a-z][a-z0-9_]{2,29}$/;
const USERNAME_AVAILABILITY_DEBOUNCE_MS = 400;

type AvailabilityState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "error"; message: string };

/**
 * Username (handle) editor. Lowercases input, validates charset/length
 * inline against the server's rule, and debounce-probes availability once
 * the candidate is valid and differs from the current handle. Save writes
 * through the profile context; the server is authoritative and any
 * 400 (invalid/reserved) or 409 (taken) surfaces inline + via toast.
 */
function UsernameRow({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (username: string) => Promise<void>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityState>({ kind: "idle" });

  // Re-seed when the profile loads / changes from elsewhere.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // The server stores handles lowercase; normalize on the way in so the
  // charset check and the availability probe both see the canonical form.
  const normalized = draft.trim().toLowerCase();
  const charsetOk = USERNAME_RE.test(normalized);
  const dirty = normalized !== value.trim().toLowerCase();

  // Debounced availability probe: only when the candidate is a valid,
  // changed handle. Cleanup cancels an in-flight timer on each keystroke so
  // we don't fire a request per character.
  useEffect(() => {
    if (!dirty || !charsetOk) {
      setAvailability({ kind: "idle" });
      return;
    }
    const token = getToken();
    if (!token) {
      setAvailability({ kind: "idle" });
      return;
    }
    setAvailability({ kind: "checking" });
    let cancelled = false;
    const handle = window.setTimeout(() => {
      checkUsernameAvailable(token, normalized)
        .then((free) => {
          if (cancelled) return;
          setAvailability(free ? { kind: "available" } : { kind: "taken" });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setAvailability({
            kind: "error",
            message: err instanceof Error ? err.message : "Couldn't check availability",
          });
        });
    }, USERNAME_AVAILABILITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [normalized, dirty, charsetOk]);

  async function save() {
    setError(null);
    if (!charsetOk) {
      setError(
        "Usernames are 3–30 characters: start with a letter, then lowercase letters, numbers, or underscores.",
      );
      return;
    }
    setSaving(true);
    try {
      await onSave(normalized);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save username";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  // Inline status line: charset error wins; otherwise reflect the probe.
  const showCharsetHint = dirty && draft.trim() !== "" && !charsetOk;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">Username</p>
        <p className="text-xs text-[var(--muted)]">
          Your public handle and profile URL. Changing it changes your profile link — the old one
          stops working (there&apos;s no redirect).
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm text-[var(--muted)]">@</span>
        <input
          type="text"
          aria-label="Username"
          value={draft}
          maxLength={30}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled || saving}
          onChange={(e) => setDraft(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={save}
          disabled={disabled || saving || !dirty || !charsetOk || availability.kind === "taken"}
          className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : showCharsetHint ? (
        <p className="text-xs text-[var(--danger)]">
          3–30 characters: start with a letter, then lowercase letters, numbers, or underscores.
        </p>
      ) : availability.kind === "checking" ? (
        <p className="text-xs text-[var(--muted)]">Checking availability…</p>
      ) : availability.kind === "available" ? (
        <p className="text-xs text-[var(--success)]">@{normalized} is available.</p>
      ) : availability.kind === "taken" ? (
        <p className="text-xs text-[var(--danger)]">@{normalized} is taken.</p>
      ) : availability.kind === "error" ? (
        <p className="text-xs text-[var(--muted)]">{availability.message}</p>
      ) : null}
    </div>
  );
}

/**
 * Height editor shown in the user's familiar unit (inches when their
 * distance preference is miles, centimeters when kilometers). Converts
 * to/from canonical cm at the edge (1 in = 2.54 cm). An empty input
 * clears the height; "no height set" shows when null.
 */
function HeightRow({
  heightCm,
  heightUnit,
  disabled,
  onSave,
}: {
  heightCm: number | null;
  heightUnit: "in" | "cm";
  disabled: boolean;
  onSave: (cm: number | null) => Promise<void>;
}) {
  // Convert the canonical cm into the displayed unit for the draft.
  const toDisplay = (cm: number | null): string => {
    if (cm == null) return "";
    const v = heightUnit === "in" ? cm / CM_PER_INCH : cm;
    // One decimal, dropping a trailing ".0" so "180" reads cleanly.
    return String(Math.round(v * 10) / 10);
  };

  const [draft, setDraft] = useState(() => toDisplay(heightCm));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(toDisplay(heightCm));
    // toDisplay depends on heightUnit too — re-seed when either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heightCm, heightUnit]);

  async function save() {
    setError(null);
    const raw = draft.trim();
    let cm: number | null;
    if (raw === "") {
      cm = null;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        setError("Enter a valid height, or leave blank to clear.");
        return;
      }
      cm = heightUnit === "in" ? n * CM_PER_INCH : n;
      // Round to one decimal so we don't persist float noise from the
      // inch→cm conversion.
      cm = Math.round(cm * 10) / 10;
    }
    setSaving(true);
    try {
      await onSave(cm);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save height");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">Height</p>
        <p className="text-xs text-[var(--muted)]">
          {heightCm == null
            ? "No height set."
            : `Shown in ${heightUnit === "in" ? "inches" : "centimeters"}.`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          min={0}
          aria-label={`Height (${heightUnit})`}
          placeholder={heightUnit === "in" ? "e.g. 71" : "e.g. 180"}
          value={draft}
          disabled={disabled || saving}
          onChange={(e) => setDraft(e.target.value)}
          className={`${inputClass} tabular-nums min-w-0 flex-1`}
        />
        <span className="shrink-0 text-xs text-[var(--muted)]">{heightUnit}</span>
        <button
          type="button"
          onClick={save}
          disabled={disabled || saving}
          className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

// The server caps the bio at 160 runes; mirror that here so the counter and
// the hard-cap match what the API will accept. We count by code points
// ([...value].length) rather than UTF-16 units (value.length) so multibyte
// characters (emoji, accented letters) count as one.
const BIO_MAX_RUNES = 160;

const runeLength = (value: string): number => [...value].length;

// Trim a string to at most `max` runes without splitting a surrogate pair.
const clampRunes = (value: string, max: number): string =>
  runeLength(value) <= max ? value : [...value].slice(0, max).join("");

/**
 * Bio editor: a short textarea with a live `{count}/160` rune counter,
 * hard-capped at 160 runes on input. An empty value clears the bio (the
 * API treats "" as a clear). Save is disabled until the trimmed draft
 * differs from the persisted bio.
 */
function BioRow({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (bio: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed when the profile loads / changes from elsewhere.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const trimmed = draft.trim();
  const dirty = trimmed !== value.trim();
  const count = runeLength(draft);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await onSave(trimmed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save bio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">Bio</p>
        <p className="text-xs text-[var(--muted)]">A short blurb shown on your public profile.</p>
      </div>
      <textarea
        aria-label="Bio"
        rows={3}
        value={draft}
        disabled={disabled || saving}
        onChange={(e) => setDraft(clampRunes(e.target.value, BIO_MAX_RUNES))}
        className={`${inputClass} w-full resize-none`}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {count}/{BIO_MAX_RUNES}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={disabled || saving || !dirty}
          className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

/**
 * Avatar editor: a preview (current image or initials placeholder), a
 * file picker that uploads on selection, and a Remove button when an
 * avatar is set.
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
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
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
    // Presigned S3 / OAuth URLs are arbitrary remote hosts; next/image
    // would require per-host remotePatterns config.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${name.trim() || "Account"} avatar`}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const init =
    parts.length === 0
      ? "?"
      : parts.length === 1
        ? parts[0].slice(0, 2).toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-semibold uppercase text-[var(--foreground)]"
    >
      {init}
    </span>
  );
}

/** Weight-unit segmented control backed by the shared profile. */
function WeightUnitControl() {
  const toast = useToast();
  const { profile, update } = useProfile();
  const [pending, setPending] = useState<"lb" | "kg" | null>(null);
  const value = pending ?? profile?.weight_unit ?? "lb";

  function change(next: "lb" | "kg") {
    if (next === value) return;
    setPending(next); // optimistic
    update({ weight_unit: next })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Failed to update weight unit");
      })
      .finally(() => setPending(null));
  }

  return (
    <SegmentedControl
      value={value}
      disabled={!profile}
      options={[
        { value: "lb", label: "Pounds" },
        { value: "kg", label: "Kilograms" },
      ]}
      onChange={change}
    />
  );
}

const inputClass =
  "rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-[var(--accent)] disabled:opacity-60";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-[var(--muted)]">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Two-option segmented toggle. The active option gets the accent fill;
 * the rest read as muted. Matches the app's pill/toggle styling.
 */
function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--background)] p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
