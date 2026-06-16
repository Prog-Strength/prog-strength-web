/**
 * Small "via Haiku 4.5" label that sits in the assistant bubble's
 * metadata row. Styled as muted plain text rather than a colored pill
 * so it recedes against the more visually weighted tool pills next to
 * it — the model is contextual info, not an action.
 */
export function ModelPill({ model }: { model: string }) {
  return (
    <span className="text-[10px] font-semibold text-[var(--muted)]">
      via {humanizeModelName(model)}
    </span>
  );
}

/**
 * Friendly form for a Claude model id. `claude-haiku-4-5-20251001` →
 * `Haiku 4.5`, `claude-sonnet-4-6` → `Sonnet 4.6`. Falls back to the
 * raw id if the pattern doesn't match — better to show the cryptic
 * value than nothing when a new model family lands.
 */
function humanizeModelName(model: string): string {
  const match = model.match(/^claude-([a-z]+)-(\d+)-(\d+)/);
  if (!match) return model;
  const [, family, major, minor] = match;
  const familyTitle = family[0].toUpperCase() + family.slice(1);
  return `${familyTitle} ${major}.${minor}`;
}
