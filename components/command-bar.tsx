/**
 * CommandBar — the `›` chevron command input.
 *
 * A single controlled text field fronted by a periwinkle chevron. Periwinkle
 * `--accent` is the command/active chrome here (the only place accent is used
 * on this surface): on focus the field drops its default outline and takes an
 * `--accent` border plus an `--accent-line` ring, per the design system's
 * form-control focus spec, and the caret is accent-tinted. On submit (Enter)
 * it calls `onSubmit(value)` with the trimmed text and clears the field; the
 * page wires `onSubmit` to route into `/chat?prompt=`.
 */

"use client";

import { useState } from "react";

export function CommandBar({
  onSubmit,
  placeholder = "Ask your coach or jump to anything…",
}: {
  onSubmit: (value: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form
      onSubmit={submit}
      className="group flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent-line)]"
    >
      <span aria-hidden="true" className="font-mono text-base leading-none text-[var(--accent)]">
        ›
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Command"
        className="flex-1 bg-transparent text-sm text-[var(--foreground)] caret-[var(--accent)] outline-none placeholder:text-[var(--muted)]"
      />
    </form>
  );
}
