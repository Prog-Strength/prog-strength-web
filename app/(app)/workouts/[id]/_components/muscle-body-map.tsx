"use client";

import Body, { type ExtendedBodyPart, type Slug } from "react-muscle-highlighter";

import type { Exercise, Workout } from "@/lib/api";
import { setsByMuscleGroup } from "@/lib/muscle-set-distribution";
import { populatedCategories } from "@/lib/workout-recap";

/**
 * The workout's muscle work as a front + back anatomical silhouette, worked
 * regions shaded by set volume on the v0.4 lift intensity ramp. Replaces the
 * "What it trained" text strip: it *shows* what the strip *stated*, and keeps
 * the populated category counts as its caption so nothing the strip carried is
 * lost. Renders null on an uncategorizable session (no empty frame), exactly as
 * the strip dropped.
 *
 * Built on react-muscle-highlighter (the anatomy is intense to author and the
 * library models graded intensity as a first-class concept). Retoned to v0.4
 * entirely through props — no CSS polygon overrides. Page-scoped on purpose:
 * the shared WorkoutDetailsBody and the pre-v0.4 MuscleGroupRadarChart are
 * untouched.
 */

/**
 * Our 11 catalog `muscle_groups` → the library's `Slug` taxonomy. Where one of
 * our groups spans several anatomical regions (back, core), every mapped slug
 * inherits that group's intensity tier. A guard test asserts this covers every
 * key of `muscle-categories` MAP, so a future catalog muscle can't silently
 * fall off the figure.
 */
export const GROUP_TO_SLUGS: Record<string, Slug[]> = {
  chest: ["chest"],
  back: ["trapezius", "upper-back", "lower-back"],
  shoulders: ["deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearm"],
  core: ["abs", "obliques"],
  quads: ["quadriceps"],
  hamstrings: ["hamstring"],
  glutes: ["gluteal"],
  calves: ["calves"],
};

// The v0.4 lift intensity ramp, dim → bright steel-blue. Literal hex mirroring
// the --discipline-lift-1..4 tokens (the library applies entries as SVG fill;
// literal hex keeps the rendered fills deterministic). intensity is 1-based:
// the library fills a part with colors[intensity - 1].
const RAMP = ["#39405a", "#5a6493", "#7d88c2", "#aab4dd"];

// Unworked silhouette — a desaturated near-black slate (≈ --surface-2), visible
// against the page without competing with the worked regions.
const DEFAULT_FILL = "#191c21";

const TIER_COUNT = 4;

export function MuscleBodyMap({ workout, exercises }: { workout: Workout; exercises: Exercise[] }) {
  const { data, hasData } = setsByMuscleGroup(workout, exercises);
  if (!hasData) return null;

  // Tier each group relative to the session's busiest region, so the worked
  // regions of even a sparse, focused session reach the bright end and glow.
  const maxValue = data.reduce((max, d) => Math.max(max, d.value), 0);

  // Build a set of worked slugs and their tiers.
  const workedSlugs = new Map<string, number>();
  for (const { muscleGroup, value } of data) {
    const tier = Math.min(TIER_COUNT, Math.max(1, Math.ceil((value / maxValue) * TIER_COUNT)));
    for (const slug of GROUP_TO_SLUGS[muscleGroup] ?? []) {
      workedSlugs.set(slug, tier);
    }
  }

  // Pass ALL known slugs to the library. Worked slugs get an intensity tier
  // (the library resolves those to colors[intensity - 1]). Unworked slugs get
  // color: DEFAULT_FILL explicitly — this overrides the hardcoded per-slug
  // color embedded in the library's asset data, which would otherwise take
  // priority over the defaultFill prop and expose the library's internal gray.
  const parts: ExtendedBodyPart[] = [];
  for (const slugs of Object.values(GROUP_TO_SLUGS)) {
    for (const slug of slugs) {
      const tier = workedSlugs.get(slug);
      if (tier !== undefined) {
        parts.push({ slug, intensity: tier });
      } else {
        parts.push({ slug, color: DEFAULT_FILL });
      }
    }
  }

  const categories = populatedCategories(workout, exercises);

  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-2">
        <Body
          side="front"
          data={parts}
          colors={RAMP}
          defaultFill={DEFAULT_FILL}
          defaultStroke="none"
          border="none"
          scale={0.7}
        />
        <Body
          side="back"
          data={parts}
          colors={RAMP}
          defaultFill={DEFAULT_FILL}
          defaultStroke="none"
          border="none"
          scale={0.7}
        />
      </div>
      <figcaption
        data-testid="muscle-body-map-caption"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]"
      >
        {categories.map((m, i) => (
          <span key={m.category}>
            <span className="text-[var(--foreground)]">{m.category}</span>
            <span className="text-[var(--faint)]"> {m.value}</span>
            {i < categories.length - 1 && <span className="px-1.5 text-[var(--faint)]">·</span>}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
