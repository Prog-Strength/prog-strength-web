/**
 * IDIOM: editorial-milestone-journal  (reference: Linear's typographic restraint,
 * pushed into magazine art-direction)
 *
 * The feed as a curated training story. Single column, art-directed, minimal
 * rails. A display serif sets titles; the stat that matters is blown up into an
 * oversized numeral. PRs and best efforts are not rows — they are full-bleed
 * celebratory editorial moments. Routine posts read like journal entries.
 *
 * - TYPE SCALE: dramatic — Fraunces display serif, italic kickers, oversized
 *   numerals; long measure, generous leading; the opposite of dense.
 * - COLOR LOGIC: mostly-neutral warm paper-on-black; ONE editorial gold accent
 *   reserved exclusively for milestones, so they glow against the grayscale.
 * - SPACING RHYTHM: columnar, magazine — wide vertical rhythm, hairline rules
 *   between entries, a narrow centered measure.
 */
"use client";

import { editorialDisplay } from "../fonts";
import { RouteMap, Radar } from "../atoms";
import { FEED, SOURCE_META, isMilestone, totalKudos, type DxPost } from "../fixtures";

const GOLD = "#d8b25a";
const serif = editorialDisplay.style.fontFamily;

export function EditorialMilestoneJournal() {
  return (
    <div
      className="rounded-xl bg-[#0c0b0a] px-6 py-10 text-[#e8e3da]"
      style={{ fontFamily: "Georgia, serif" }}
    >
      <div className="mx-auto max-w-[620px]">
        <header className="border-b border-[#2a2722] pb-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#8a8377]">
            The Training Journal
          </p>
          <h2 style={{ fontFamily: serif }} className="mt-2 text-4xl font-medium tracking-tight">
            This Week in Motion
          </h2>
          <p style={{ fontFamily: serif }} className="mt-2 text-base italic text-[#8a8377]">
            Five entries from the athletes you follow
          </p>
        </header>

        <div className="flex flex-col">
          {FEED.map((p, i) => (
            <Entry key={p.id} post={p} index={i} />
          ))}
        </div>

        <EmptyState />
      </div>
    </div>
  );
}

function Entry({ post, index }: { post: DxPost; index: number }) {
  if (isMilestone(post)) return <MilestoneEntry post={post} />;
  const meta = SOURCE_META[post.source_type];
  // Pick the "headline" stat to blow up — first stat reads as the lede.
  const lede = post.stats[0];
  return (
    <article className="border-b border-[#2a2722] py-9">
      <div className="flex items-baseline justify-between">
        <p style={{ fontFamily: serif }} className="text-sm italic text-[#8a8377]">
          {post.author.name}
          {post.author.is_self ? " — your log" : ""}
        </p>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#6a6459]">
          {meta.label} · {post.occurred_at}
        </p>
      </div>

      <h3
        style={{ fontFamily: serif }}
        className="mt-2 text-[28px] font-medium leading-[1.15] tracking-tight"
      >
        {post.title}
      </h3>
      {post.subtitle && (
        <p style={{ fontFamily: serif }} className="mt-1 text-lg italic text-[#9a9285]">
          {post.subtitle}
        </p>
      )}

      <div className="mt-5 flex items-end gap-6">
        <div>
          <div
            style={{ fontFamily: serif }}
            className="text-6xl font-medium leading-none tracking-tight"
          >
            {lede.value}
            {lede.unit && <span className="text-2xl text-[#8a8377]">{lede.unit}</span>}
          </div>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#6a6459]">{lede.label}</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 pb-1">
          {post.stats.slice(1).map((s) => (
            <div key={s.label}>
              <div style={{ fontFamily: serif }} className="text-xl">
                {s.value}
                {s.unit && <span className="text-sm text-[#8a8377]">{s.unit}</span>}
              </div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#6a6459]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {post.notes && (
        <p style={{ fontFamily: serif }} className="mt-5 text-[17px] leading-[1.7] text-[#cfc8bb]">
          <span className="float-left mr-1 text-5xl leading-[0.8]" style={{ fontFamily: serif }}>
            {post.notes.charAt(0)}
          </span>
          {post.notes.slice(1)}
        </p>
      )}

      {post.route && (
        <figure className="mt-6">
          <RouteMap
            route={post.route}
            stroke={"#cfc8bb"}
            grid="#221f1b"
            height={150}
            strokeWidth={1.5}
          />
          <figcaption
            className="mt-1 text-center text-[11px] italic text-[#6a6459]"
            style={{ fontFamily: serif }}
          >
            {post.subtitle ?? "Logged route"}
          </figcaption>
        </figure>
      )}

      {post.radar && (
        <figure className="mt-6 flex justify-center">
          <Radar
            data={post.radar}
            stroke={"#cfc8bb"}
            fill="rgba(207,200,187,0.12)"
            grid="#3a352d"
            size={160}
            label="Muscle emphasis"
          />
        </figure>
      )}

      <Footer post={post} index={index} />
    </article>
  );
}

function MilestoneEntry({ post }: { post: DxPost }) {
  const meta = SOURCE_META[post.source_type];
  const hero = post.stats[0];
  return (
    <article className="border-b border-[#2a2722] py-12 text-center">
      <p className="text-[11px] uppercase tracking-[0.4em]" style={{ color: GOLD }}>
        {meta.emoji} {post.source_type === "pr" ? "Personal Record" : "Best Effort"}
      </p>
      <p style={{ fontFamily: serif }} className="mt-2 text-base italic text-[#8a8377]">
        {post.author.is_self ? "You set a new mark" : `${post.author.name} set a new mark`}
      </p>
      <h3
        style={{ fontFamily: serif }}
        className="mx-auto mt-3 max-w-md text-[34px] font-medium leading-tight tracking-tight"
      >
        {post.title}
      </h3>

      <div
        style={{ fontFamily: serif, color: GOLD }}
        className="mt-6 text-[96px] font-semibold leading-[0.85] tracking-tighter"
      >
        {hero.value}
        {hero.unit && <span className="text-4xl">{hero.unit}</span>}
      </div>
      <div className="mt-3 flex items-center justify-center gap-6">
        {post.stats.slice(1).map((s) => (
          <p key={s.label} style={{ fontFamily: serif }} className="text-sm italic text-[#9a9285]">
            {s.label}: {s.value}
            {s.unit ?? ""}
          </p>
        ))}
      </div>

      <div className="mx-auto mt-6 h-px w-16" style={{ background: GOLD }} />
      <p className="mt-3 text-[12px] uppercase tracking-[0.25em] text-[#6a6459]">
        {totalKudos(post) > 0
          ? `${totalKudos(post)} celebrations`
          : "Fresh — be the first to celebrate"}
      </p>
    </article>
  );
}

function Footer({ post }: { post: DxPost; index: number }) {
  return (
    <div className="mt-6 flex items-center gap-4 text-[12px] uppercase tracking-[0.18em] text-[#6a6459]">
      <span>{totalKudos(post)} kudos</span>
      <span aria-hidden>·</span>
      <span>{post.comment_count} notes</span>
      {post.top_comment && (
        <span
          style={{ fontFamily: serif }}
          className="ml-auto max-w-[55%] truncate text-right text-sm normal-case italic tracking-normal text-[#9a9285]"
        >
          “{post.top_comment.body}”
        </span>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 border-t border-[#2a2722] pt-10 text-center">
      <p style={{ fontFamily: serif }} className="text-2xl italic">
        A journal of one is still a journal.
      </p>
      <p
        className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#9a9285]"
        style={{ fontFamily: serif }}
      >
        Your own entries are here. Follow a few athletes and their milestones join the story.
      </p>
      <button
        className="mt-5 border-b pb-0.5 text-sm uppercase tracking-[0.2em]"
        style={{ color: GOLD, borderColor: GOLD }}
      >
        Find athletes to follow
      </button>
    </div>
  );
}
