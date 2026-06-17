"use client";

/**
 * IDIOM: conversation-led  ·  draws on ChatGPT
 *
 * The hero IS the chat. Front and center, the turkey-burger → macro-table
 * exchange literally *is* the headline; a short framing line and the Google
 * CTA sit beneath it, so the product demonstrates its killer feature
 * instead of describing it. TYPE: chat-comfortable, mid scale, friendly —
 * no marketing display face. COLOR: violet user bubble, raised-slate
 * assistant card, macro tints inside the table — our soft-modern-messenger
 * language applied to a marketing hero. SPACING: comfortable and rounded,
 * the exchange given room to breathe. ChatGPT's "talk to it" hero, in
 * Prog Strength's voice.
 */

import { BrandMark } from "@/components/brand-mark";
import { GoogleGlyph, reassurance, useLoginHref } from "../_shared/cta";
import { MacroTable } from "../_shared/mocks";
import { chatExchange } from "../_shared/fixtures";

export function ConversationLed() {
  const loginHref = useLoginHref();

  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--background)] px-5 py-16">
      <div className="flex items-center gap-2.5">
        <BrandMark size={24} className="text-[var(--accent)]" />
        <span className="text-sm font-bold tracking-tight">Prog Strength</span>
      </div>

      <p className="mt-10 text-center text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        This is the whole product
      </p>

      {/* The exchange AS the hero — given full center stage. */}
      <div className="mt-6 w-full max-w-2xl space-y-4">
        {/* user bubble */}
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-[var(--accent)] px-5 py-3.5 text-base font-medium leading-relaxed text-[var(--accent-fg)]">
            {chatExchange.userMessage}
          </p>
        </div>

        {/* assistant card */}
        <div className="space-y-4 rounded-3xl rounded-bl-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--macro-protein-bg)] px-3 py-1 text-xs font-bold text-[var(--macro-protein)]">
              ✓ {chatExchange.toolChip.label}
            </span>
            <span className="text-xs text-[var(--faint)]">{chatExchange.model}</span>
          </div>
          <p className="text-base text-[var(--foreground)]">{chatExchange.assistantIntro}</p>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)] p-2 sm:p-3">
            <MacroTable density="comfortable" />
          </div>
          <p className="text-base font-medium text-[var(--foreground)]">
            {chatExchange.assistantOutro}
          </p>
        </div>
      </div>

      {/* Framing line + CTA beneath the conversation */}
      <div className="mt-12 flex max-w-xl flex-col items-center text-center">
        <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">
          Just tell it what you trained.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
          No forms, no searching a food database. Type it like you&apos;d text a coach — meals,
          lifts, runs — and Prog Strength logs the macros, the sets, and the PRs.
        </p>

        <a
          href={loginHref ?? "#"}
          aria-disabled={!loginHref}
          className={`mt-9 inline-flex items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-7 py-3.5 text-base font-bold text-[var(--accent-fg)] transition hover:bg-[var(--accent-dark)] ${
            loginHref ? "" : "pointer-events-none opacity-50"
          }`}
        >
          <span className="rounded-full bg-white p-1">
            <GoogleGlyph size={16} />
          </span>
          Continue with Google
        </a>
        <p className="mt-4 text-xs text-[var(--faint)]">{reassurance}</p>
      </div>
    </div>
  );
}
