/**
 * Circular avatar shared across the social surfaces (profile header, search
 * rows, follower/following lists, requests inbox): the resolved image when
 * present, otherwise an initials placeholder derived from the display name.
 *
 * The sidebar has its own 20px avatar baked into its account anchor; this is
 * the cross-page version used wherever a ProfileSummary is rendered, sized via
 * the `size` prop (defaults to a 40px list-row avatar).
 */
export function Avatar({
  url,
  name,
  size = 40,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const px = `${size}px`;
  if (url) {
    // Presigned S3 / OAuth URLs are arbitrary remote hosts; next/image would
    // require per-host remotePatterns config for a small avatar, so a plain
    // <img> is the right call here (matches the sidebar's avatar).
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${name} avatar`}
        style={{ width: px, height: px }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: px, height: px, fontSize: `${Math.max(10, Math.round(size * 0.38))}px` }}
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] font-semibold uppercase text-[var(--foreground)]"
    >
      {initials(name)}
    </span>
  );
}

/** First two word-initials of a name, e.g. "Sam Lifter" → "SL". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
