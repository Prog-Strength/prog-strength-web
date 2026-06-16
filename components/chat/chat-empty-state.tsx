import { BrandMark } from "@/components/brand-mark";

const EXAMPLE_PROMPTS = [
  "What chest exercises are in the catalog?",
  "Log yesterday's workout",
  "How many calories did I eat today?",
];

/**
 * First-run card shown in an empty conversation. Purely presentational —
 * a violet brand badge, a one-line invitation, and a few static example
 * prompts styled as chips. The chips are non-interactive cues, not
 * buttons; the composer below is where the user actually types.
 */
export function ChatEmptyState() {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
        <BrandMark size={28} />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-[var(--foreground)]">
        Ask about your training.
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Programming, logging, nutrition — start with a question.
      </p>
      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <li
            key={prompt}
            className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--muted)]"
          >
            {prompt}
          </li>
        ))}
      </ul>
    </div>
  );
}
