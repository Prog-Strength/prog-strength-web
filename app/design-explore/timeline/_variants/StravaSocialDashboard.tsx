/**
 * IDIOM: strava-social-dashboard  (reference: Strava — Dashboard / following feed)
 *
 * Three-column social dashboard. Left rail = you (profile + streak + this-week
 * mini-chart); center = a confident following feed of bold activity cards with
 * a prominent route map and a labeled horizontal stat row (big values, small
 * labels under); right rail = discovery (suggested athletes + a challenge).
 *
 * - TYPE SCALE: condensed athletic sans (Oswald) for loud, uppercase-tracked
 *   titles + big stat numerals; small caps labels under values.
 * - COLOR LOGIC: photographic — the route map and ONE energetic orange accent
 *   carry it; surfaces stay near-black so the map and kudos pop.
 * - SPACING RHYTHM: generous, card-forward, social-first; lots of air per card.
 */
"use client";

import { athleticCondensed } from "../fonts";
import { RouteMap, Radar, WeekBars } from "../atoms";
import {
  FEED,
  SUGGESTIONS,
  MY_WEEK,
  SOURCE_META,
  totalKudos,
  isMilestone,
  type DxPost,
} from "../fixtures";

const ORANGE = "#f4622e";
const condensed = athleticCondensed.style.fontFamily;

export function StravaSocialDashboard() {
  return (
    <div
      className="rounded-2xl bg-[#0b0b0c] p-5 text-[#ededed]"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
        <LeftRail />
        <div className="flex flex-col gap-5">
          {FEED.map((p) => (
            <ActivityCard key={p.id} post={p} />
          ))}
          <EmptyState />
        </div>
        <RightRail />
      </div>
    </div>
  );
}

function Title({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span style={{ fontFamily: condensed }} className={className}>
      {children}
    </span>
  );
}

function LeftRail() {
  return (
    <aside className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-[#141416] p-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#f4622e] to-[#b8341a] text-xl font-bold">
          YO
        </span>
        <Title className="text-lg font-semibold uppercase tracking-wide">Your Week</Title>
        <p className="text-xs text-white/50">{"You're 4 sessions deep — keep it rolling."}</p>
      </div>

      <div className="rounded-xl border border-white/5 bg-[#141416] p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">Streak</span>
          <Title className="text-2xl font-bold">
            <span style={{ color: ORANGE }}>{MY_WEEK.streak_weeks}</span>
            <span className="ml-1 text-xs font-normal uppercase text-white/50">wks</span>
          </Title>
        </div>
        <div className="mt-3">
          <WeekBars load={MY_WEEK.load} color={ORANGE} track="#26262a" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
          <Stat big={`${MY_WEEK.miles}`} unit="mi" label="Run" />
          <Stat big={MY_WEEK.workouts.toString()} unit="" label="Lifts" />
        </div>
      </div>
    </aside>
  );
}

function Stat({ big, unit, label }: { big: string; unit: string; label: string }) {
  return (
    <div className="flex flex-col">
      <Title className="text-xl font-semibold leading-none">
        {big}
        {unit && <span className="ml-0.5 text-xs font-normal text-white/50">{unit}</span>}
      </Title>
      <span className="mt-1 text-[10px] uppercase tracking-widest text-white/40">{label}</span>
    </div>
  );
}

function ActivityCard({ post }: { post: DxPost }) {
  const meta = SOURCE_META[post.source_type];
  const milestone = isMilestone(post);
  return (
    <article className="overflow-hidden rounded-xl border border-white/5 bg-[#141416]">
      {milestone && (
        <div
          className="flex items-center gap-2 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ background: `linear-gradient(90deg, ${ORANGE}, #b8341a)` }}
        >
          {meta.emoji} {post.source_type === "pr" ? "Personal Record" : "Best Effort"}
        </div>
      )}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#26262a] text-sm font-bold">
            {post.author.initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{post.author.name}</span>
              {post.author.is_self && (
                <span className="rounded-full bg-[#26262a] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/50">
                  You
                </span>
              )}
            </div>
            <span className="text-xs text-white/40">
              {meta.emoji} {meta.label} · {post.occurred_at}
            </span>
          </div>
        </div>

        <Title className="mt-3 block text-2xl font-semibold uppercase tracking-tight leading-tight">
          {post.title}
        </Title>
        {post.subtitle && <p className="mt-0.5 text-sm text-white/55">{post.subtitle}</p>}
        {post.notes && <p className="mt-2 text-sm leading-relaxed text-white/70">{post.notes}</p>}
      </div>

      {post.route && (
        <div className="mt-4 bg-gradient-to-b from-[#16302a] to-[#10221d]">
          <RouteMap
            route={post.route}
            stroke={ORANGE}
            grid="#234038"
            height={170}
            strokeWidth={3.5}
          />
        </div>
      )}

      {post.radar && (
        <div className="mt-4 flex items-center gap-4 px-5">
          <Radar
            data={post.radar}
            stroke={ORANGE}
            fill="rgba(244,98,46,0.22)"
            grid="#3a3a3f"
            label="Muscle groups"
            size={132}
          />
          <p className="text-xs text-white/50">
            Shoulders &amp; arms carried the session — legs along for the ride.
          </p>
        </div>
      )}

      {/* Labeled stat row — the Strava signature: big value, small label under. */}
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 px-5">
        {post.stats.map((s) => (
          <div key={s.label} className="flex flex-col">
            <Title className="text-2xl font-semibold leading-none">
              {s.value}
              {s.unit && <span className="ml-0.5 text-sm font-normal text-white/50">{s.unit}</span>}
            </Title>
            <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/40">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 px-5 py-3">
        <div className="flex items-center gap-1.5">
          {totalKudos(post) === 0 ? (
            <span className="text-xs text-white/35">Be the first to give kudos</span>
          ) : (
            <>
              <button
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold"
                style={{
                  background: post.mine.length ? ORANGE : "#26262a",
                  color: post.mine.length ? "#0b0b0c" : "#fff",
                }}
              >
                <span aria-hidden>🔥</span> {totalKudos(post)}
              </button>
              <span className="text-xs text-white/40">kudos</span>
            </>
          )}
        </div>
        <span className="text-xs text-white/40">💬 {post.comment_count}</span>
      </div>
    </article>
  );
}

function RightRail() {
  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-xl border border-white/5 bg-[#141416] p-4">
        <Title className="text-sm font-semibold uppercase tracking-wide">Suggested athletes</Title>
        <div className="mt-3 flex flex-col gap-3">
          {SUGGESTIONS.slice(0, 3).map((s) => (
            <div key={s.username} className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#26262a] text-xs font-bold">
                {s.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="truncate text-[11px] text-white/40">{s.blurb}</p>
              </div>
              <button
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: ORANGE, color: "#0b0b0c" }}
              >
                Follow
              </button>
            </div>
          ))}
        </div>
      </div>
      <div
        className="rounded-xl p-4"
        style={{
          background: "linear-gradient(160deg, #2a160e, #141416)",
          border: "1px solid rgba(244,98,46,0.3)",
        }}
      >
        <Title className="text-sm font-semibold uppercase tracking-wide">
          June Distance Challenge
        </Title>
        <p className="mt-1 text-xs text-white/55">{"You're at 28.6 / 75 mi"}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#26262a]">
          <div className="h-full rounded-full" style={{ width: "38%", background: ORANGE }} />
        </div>
      </div>
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[#f4622e]/40 bg-[#141416] p-6 text-center">
      <Title className="text-xl font-semibold uppercase tracking-wide">Your feed is waiting</Title>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
        Follow a few athletes and your dashboard fills with their runs, lifts, and PRs — kudos and
        all.
      </p>
      <button
        className="mt-4 rounded-full px-5 py-2 text-sm font-semibold"
        style={{ background: ORANGE, color: "#0b0b0c" }}
      >
        Find people to follow
      </button>
    </div>
  );
}
