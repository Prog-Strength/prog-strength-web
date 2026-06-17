"use client";

/**
 * IDIOM: conversational-inline — the product's chat-led character applied
 * to settings (draws on Notion's click-the-value editing + ChatGPT's
 * plain-language register).
 *
 * - Type scale: a comfortable READING scale with sentence rhythm — no
 *   label/field grid. Settings are plain-language statements with the
 *   editable value inline and emphasized.
 * - Color logic: violet MARKS every editable value, so what's changeable
 *   is obvious without a single visible input at rest. The read-only
 *   allowance is deliberately NOT violet so it never reads as editable.
 * - Spacing rhythm: roomy, line-by-line, the calmest page.
 * - Save model: click a bold value to edit it in place; it commits on
 *   confirm (Enter) and the username's available/taken state resolves
 *   right under the word — the least form-like commit of the five.
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

const heightUnit: "in" | "cm" = PROFILE_FIXTURE.distance_unit === "km" ? "cm" : "in";

/** A bold violet value that becomes an inline input on click. */
function InlineText({
  value,
  display,
  onCommit,
  placeholder,
  type = "text",
  multiline = false,
  maxRunes,
}: {
  value: string;
  display?: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  multiline?: boolean;
  maxRunes?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function commit() {
    onCommit(maxRunes ? clampRunes(draft, maxRunes) : draft);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="rounded font-bold text-[var(--accent)] underline decoration-[var(--accent-line)] decoration-dotted underline-offset-4 transition hover:bg-[var(--accent-soft)]"
      >
        {display ?? value ?? placeholder}
      </button>
    );
  }

  const Cmp = multiline ? "textarea" : "input";
  return (
    <span className="inline-flex items-center gap-1 align-baseline">
      <Cmp
        ref={ref}
        type={multiline ? undefined : type}
        value={draft}
        onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
          setDraft(maxRunes ? clampRunes(e.target.value, maxRunes) : e.target.value)
        }
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" && !multiline) commit();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder={placeholder}
        className="rounded-md border border-[var(--accent-line)] bg-[var(--background)] px-2 py-0.5 text-base font-bold text-[var(--foreground)] focus:outline focus:outline-2 focus:outline-[var(--accent)]"
        style={multiline ? { minWidth: "16rem" } : { width: `${Math.max(4, draft.length + 2)}ch` }}
      />
      <button
        type="button"
        onClick={commit}
        className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-[var(--accent-fg)]"
      >
        ↵
      </button>
    </span>
  );
}

/** Inline pick-one value: clicking cycles open a tiny choice menu. */
function InlineChoice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded font-bold text-[var(--accent)] underline decoration-[var(--accent-line)] decoration-dotted underline-offset-4 transition hover:bg-[var(--accent-soft)]"
      >
        {current?.label}
      </button>
      {open && (
        <span className="absolute left-0 top-full z-10 mt-1 flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1 shadow-[var(--shadow-soft)]">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-medium transition ${
                o.value === value
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "hover:bg-[var(--surface-3)]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function InlineUsername({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [probe, setProbe] = useState<{ handle: string; result: Availability } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const normalized = draft.trim().toLowerCase();
  const dirty = normalized !== value;
  const charsetOk = USERNAME_RE.test(normalized);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  useEffect(() => {
    if (!editing || !dirty || !charsetOk) return;
    const t = window.setTimeout(
      () => setProbe({ handle: normalized, result: resolveAvailability(normalized) }),
      500,
    );
    return () => window.clearTimeout(t);
  }, [normalized, dirty, charsetOk, editing]);
  const availability: Availability =
    !editing || !dirty || !charsetOk
      ? { kind: "idle" }
      : probe?.handle === normalized
        ? probe.result
        : { kind: "checking" };

  const canCommit = charsetOk && (availability.kind === "available" || !dirty);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="rounded font-bold text-[var(--accent)] underline decoration-[var(--accent-line)] decoration-dotted underline-offset-4 transition hover:bg-[var(--accent-soft)]"
      >
        @{value}
      </button>
    );
  }

  return (
    <span className="relative inline-flex items-center gap-1 align-baseline">
      <span className="text-base font-bold text-[var(--muted)]">@</span>
      <input
        ref={ref}
        value={draft}
        maxLength={30}
        autoCapitalize="none"
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value.toLowerCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canCommit) {
            onCommit(normalized);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        className="rounded-md border border-[var(--accent-line)] bg-[var(--background)] px-2 py-0.5 text-base font-bold focus:outline focus:outline-2 focus:outline-[var(--accent)]"
        style={{ width: `${Math.max(6, draft.length + 2)}ch` }}
      />
      <button
        type="button"
        disabled={!canCommit}
        onClick={() => {
          onCommit(normalized);
          setEditing(false);
        }}
        className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-[var(--accent-fg)] disabled:opacity-40"
      >
        ↵
      </button>
      <span className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs">
        {dirty && normalized !== "" && !charsetOk ? (
          <span className="text-[var(--danger)]">
            letter first, then lowercase letters / numbers / _
          </span>
        ) : availability.kind === "checking" ? (
          <span className="text-[var(--muted)]">checking…</span>
        ) : availability.kind === "available" ? (
          <span className="text-[var(--success)]">@{normalized} is available</span>
        ) : availability.kind === "taken" ? (
          <span className="text-[var(--danger)]">@{normalized} is taken</span>
        ) : availability.kind === "reserved" ? (
          <span className="text-[var(--danger)]">@{normalized} is reserved</span>
        ) : null}
      </span>
    </span>
  );
}

export function ConversationalInline() {
  const [name, setName] = useState(PROFILE_FIXTURE.display_name);
  const [handle, setHandle] = useState(PROFILE_FIXTURE.username ?? "");
  const [bio, setBio] = useState(PROFILE_FIXTURE.bio);
  const [height, setHeight] = useState(heightToDisplay(PROFILE_FIXTURE.height_cm, heightUnit));
  const [distance, setDistance] = useState(PROFILE_FIXTURE.distance_unit);
  const [weight, setWeight] = useState(PROFILE_FIXTURE.weight_unit);
  const [detail, setDetail] = useState(PROFILE_FIXTURE.calendar_default_detail);
  const [calConnected, setCalConnected] = useState(true);

  return (
    <div className="mx-auto max-w-xl font-sans">
      <h2 className="mb-6 text-lg font-bold tracking-tight">Settings</h2>

      <div className="flex flex-col gap-7 text-lg leading-relaxed text-[var(--muted)]">
        {/* Avatar sits in prose, not bolted on */}
        <p className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-base font-bold uppercase text-[var(--foreground)]">
            {initialsOf(name)}
          </span>
          <span>
            This is how you show up.{" "}
            <button
              type="button"
              className="font-bold text-[var(--accent)] underline decoration-[var(--accent-line)] decoration-dotted underline-offset-4 transition hover:bg-[var(--accent-soft)]"
            >
              Change photo
            </button>
          </span>
        </p>

        <p>
          Your coach calls you{" "}
          <InlineText
            value={name}
            onCommit={(v) => v.trim() && setName(v.trim())}
            placeholder="your name"
          />
          .
        </p>

        <p>
          You&apos;re <InlineUsername value={handle} onCommit={setHandle} /> in public — that&apos;s
          your profile link, and changing it breaks the old one.
        </p>

        <p>
          Your bio reads{" "}
          <InlineText
            value={bio}
            display={bio ? `“${bio}”` : "— add one"}
            onCommit={setBio}
            placeholder="a short blurb"
            multiline
            maxRunes={BIO_MAX_RUNES}
          />
          .{" "}
          <span className="text-sm text-[var(--faint)]">
            ({runeLength(bio)}/{BIO_MAX_RUNES})
          </span>
        </p>

        <p>
          You stand{" "}
          <InlineText
            value={height}
            display={height ? `${height} ${heightUnit}` : "no height set"}
            onCommit={setHeight}
            placeholder={heightUnit}
            type="number"
          />{" "}
          tall.
        </p>

        <p>
          You measure distance in{" "}
          <InlineChoice
            value={distance}
            options={[
              { value: "mi", label: "miles" },
              { value: "km", label: "kilometers" },
            ]}
            onChange={setDistance}
          />{" "}
          and weight in{" "}
          <InlineChoice
            value={weight}
            options={[
              { value: "lb", label: "pounds" },
              { value: "kg", label: "kilograms" },
            ]}
            onChange={setWeight}
          />
          .
        </p>

        <p>
          Your Google Calendar is{" "}
          <button
            type="button"
            onClick={() => setCalConnected((c) => !c)}
            className="font-bold text-[var(--accent)] underline decoration-[var(--accent-line)] decoration-dotted underline-offset-4 transition hover:bg-[var(--accent-soft)]"
          >
            {calConnected ? "connected" : "not connected"}
          </button>
          {calConnected && (
            <>
              , and synced events show as a{" "}
              <InlineChoice
                value={detail}
                options={[
                  { value: "time_block", label: "time block" },
                  { value: "full_agenda", label: "full agenda" },
                ]}
                onChange={setDetail}
              />
            </>
          )}
          .
        </p>

        {/* Read-only allowance — deliberately NOT violet, with an inline meter. */}
        <p className="flex flex-col gap-2 border-t border-[var(--border)] pt-6 text-base">
          <span>
            You&apos;ve used{" "}
            <span
              className="font-bold tabular-nums"
              style={{ color: usageColor(USAGE_FIXTURE.percentUsed) }}
            >
              {USAGE_FIXTURE.percentUsed}%
            </span>{" "}
            of today&apos;s AI allowance. It resets in {USAGE_FIXTURE.resetsInLabel}.
          </span>
          <span className="flex items-center gap-3">
            <span className="h-1.5 w-48 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${USAGE_FIXTURE.percentUsed}%`,
                  backgroundColor: usageColor(USAGE_FIXTURE.percentUsed),
                }}
              />
            </span>
            <span className="text-xs text-[var(--faint)]">read-only</span>
          </span>
        </p>
      </div>
    </div>
  );
}
