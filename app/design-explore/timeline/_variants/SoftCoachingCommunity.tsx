/**
 * IDIOM: soft-coaching-community  (reference: Whoop — warm single accent, big
 * confident metrics, coaching tone)
 *
 * A warm, encouraging community feed. Soft rounded cards, friendly kudos,
 * streak / consistency emphasis, a warm "your people this week" leaderboard,
 * gentle coaching microcopy, and a clay brand accent. The crew as a supportive
 * group, not a scoreboard.
 *
 * - TYPE SCALE: rounded, comfortable, mid-contrast (Nunito); larger body, soft
 *   weight steps rather than dramatic jumps.
 * - COLOR LOGIC: warm tonal hues on dark (toasted browns) + one clay accent;
 *   kudos and streaks glow warm, never harsh.
 * - SPACING RHYTHM: generous and rounded — big radii, pill kudos, roomy padding;
 *   motivating and approachable.
 */
"use client";

import { softRounded } from "../fonts";
import { RouteMap, Radar, WeekBars } from "../atoms";
import {
  FEED,
  LEADERBOARD,
  MY_WEEK,
  REACTIONS,
  SOURCE_META,
  totalKudos,
  isMilestone,
  type DxPost,
} from "../fixtures";

const CLAY = "#e08a5d";
const CLAY_SOFT = "rgba(224,138,93,0.16)";
const rounded = softRounded.style.fontFamily;

export function SoftCoachingCommunity() {
  return (
    <div className="rounded-3xl bg-[#1a1512] p-5 text-[#efe7df]" style={{ fontFamily: rounded }}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_268px]">
        <div className="flex flex-col gap-5">
          <CoachBanner />
          {FEED.map((p) => (
            <SoftCard key={p.id} post={p} />
          ))}
          <EmptyState />
        </div>
        <CrewRail />
      </div>
    </div>
  );
}

function CoachBanner() {
  return (
    <div
      className="flex items-center gap-4 rounded-3xl p-5"
      style={{
        background: "linear-gradient(135deg, #3a241a, #241813)",
        border: "1px solid rgba(224,138,93,0.25)",
      }}
    >
      <div
        className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full"
        style={{ background: CLAY_SOFT, color: CLAY }}
      >
        <span className="text-2xl font-extrabold leading-none">{MY_WEEK.streak_weeks}</span>
        <span className="text-[10px] font-bold uppercase">weeks</span>
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-extrabold">
          {"You're on a 7-week streak — that's real consistency. 🌱"}
        </h3>
        <p className="text-sm text-[#c9b8aa]">
          {MY_WEEK.workouts} lifts · {MY_WEEK.runs} runs · {MY_WEEK.miles} mi this week. Your crew
          is showing up too.
        </p>
        <div className="mt-3 max-w-[260px]">
          <WeekBars load={MY_WEEK.load} color={CLAY} track="#2e211a" rounded height={40} />
        </div>
      </div>
    </div>
  );
}

function SoftCard({ post }: { post: DxPost }) {
  const meta = SOURCE_META[post.source_type];
  const milestone = isMilestone(post);
  return (
    <article
      className="rounded-3xl p-5"
      style={{
        background: milestone ? "linear-gradient(150deg, #3a241a, #211712)" : "#241b16",
        border: milestone ? `1px solid ${CLAY}` : "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-base font-extrabold"
          style={{ background: CLAY_SOFT, color: CLAY }}
        >
          {post.author.initials}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-extrabold">{post.author.name}</span>
            {post.author.is_self && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: CLAY_SOFT, color: CLAY }}
              >
                you
              </span>
            )}
          </div>
          <span className="text-sm text-[#b3a294]">
            {meta.emoji} {meta.label} · {post.occurred_at}
          </span>
        </div>
        {milestone && (
          <span
            className="rounded-full px-3 py-1 text-xs font-extrabold"
            style={{ background: CLAY, color: "#1a1512" }}
          >
            {post.source_type === "pr" ? "🏆 New PR!" : "⚡ Best yet!"}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-xl font-extrabold leading-snug">{post.title}</h3>
      {post.subtitle && <p className="text-sm text-[#b3a294]">{post.subtitle}</p>}
      {post.notes && (
        <p className="mt-3 rounded-2xl bg-[#1d1611] p-3 text-[15px] leading-relaxed text-[#d8cabd]">
          {post.notes}
        </p>
      )}

      {/* soft rounded stat pills */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        {post.stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl px-4 py-2.5"
            style={{ background: milestone ? CLAY_SOFT : "#1d1611" }}
          >
            <div
              className="text-lg font-extrabold leading-none"
              style={{ color: milestone ? CLAY : "#efe7df" }}
            >
              {s.value}
              {s.unit && <span className="ml-0.5 text-xs font-bold text-[#b3a294]">{s.unit}</span>}
            </div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[#9c8a7c]">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {post.route && (
        <div className="mt-4 overflow-hidden rounded-2xl" style={{ background: "#1d1611" }}>
          <RouteMap
            route={post.route}
            stroke={CLAY}
            grid="#332620"
            height={150}
            strokeWidth={4}
            rounded
          />
        </div>
      )}
      {post.radar && (
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-[#1d1611] p-3">
          <Radar
            data={post.radar}
            stroke={CLAY}
            fill={CLAY_SOFT}
            grid="#403028"
            size={128}
            label="Muscles trained"
          />
          <p className="text-sm text-[#c9b8aa]">
            Nice balanced push session — shoulders and arms got the love today. 💪
          </p>
        </div>
      )}

      {/* friendly kudos row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {REACTIONS.map((r) => {
          const count = post.reactions[r.type];
          const active = post.mine.includes(r.type);
          return (
            <button
              key={r.type}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition"
              style={{
                background: active ? CLAY : "#1d1611",
                color: active ? "#1a1512" : "#b3a294",
              }}
            >
              <span aria-hidden>{r.emoji}</span>
              {count > 0 && <span>{count}</span>}
            </button>
          );
        })}
        <button className="ml-auto flex items-center gap-1.5 rounded-full bg-[#1d1611] px-3 py-1.5 text-sm font-bold text-[#b3a294]">
          💬 {post.comment_count}
        </button>
      </div>
      {totalKudos(post) === 0 && (
        <p className="mt-2 text-sm text-[#9c8a7c]">
          {"Fresh off the bar — send the first cheer! 🎉"}
        </p>
      )}
      {post.top_comment && (
        <div className="mt-3 flex gap-2 rounded-2xl bg-[#1d1611] p-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
            style={{ background: CLAY_SOFT, color: CLAY }}
          >
            {post.top_comment.author
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </span>
          <p className="text-sm text-[#d8cabd]">
            <span className="font-bold">{post.top_comment.author}</span> {post.top_comment.body}
          </p>
        </div>
      )}
    </article>
  );
}

function CrewRail() {
  const max = Math.max(...LEADERBOARD.map((r) => r.volume));
  return (
    <aside className="flex h-fit flex-col gap-4">
      <div
        className="rounded-3xl bg-[#241b16] p-4"
        style={{ border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <h3 className="text-base font-extrabold">Your people this week 🤝</h3>
        <p className="text-xs text-[#9c8a7c]">Volume lifted — cheering each other on</p>
        <ol className="mt-3 flex flex-col gap-1.5">
          {LEADERBOARD.map((r) => (
            <li
              key={r.rank}
              className="flex items-center gap-2.5 rounded-2xl px-2.5 py-2"
              style={{ background: r.is_self ? CLAY_SOFT : "transparent" }}
            >
              <span
                className="w-4 text-sm font-extrabold"
                style={{ color: r.rank <= 3 ? CLAY : "#9c8a7c" }}
              >
                {r.rank}
              </span>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold"
                style={{ background: "#1d1611", color: CLAY }}
              >
                {r.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`truncate text-sm ${r.is_self ? "font-extrabold" : "font-semibold text-[#d8cabd]"}`}
                  >
                    {r.name}
                  </span>
                  <span className="text-xs font-bold tabular-nums">
                    {(r.volume / 1000).toFixed(1)}k
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#1d1611]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(r.volume / max) * 100}%`,
                      background: r.is_self ? CLAY : "#5a4334",
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 rounded-2xl bg-[#1d1611] p-2.5 text-center text-xs text-[#c9b8aa]">
          {"You're mid-pack and climbing — one more session pulls you to 4th. 🙌"}
        </p>
      </div>
    </aside>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-3xl p-6 text-center"
      style={{
        background: "linear-gradient(150deg, #3a241a, #211712)",
        border: `1px solid ${CLAY_SOFT}`,
      }}
    >
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl"
        style={{ background: CLAY_SOFT }}
      >
        🌟
      </div>
      <h3 className="mt-3 text-xl font-extrabold">Training is better together</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#c9b8aa]">
        You have not followed anyone yet — and that is totally okay. Find a few athletes and your
        crew starts cheering you on.
      </p>
      <button
        className="mt-4 rounded-full px-6 py-2.5 text-sm font-extrabold"
        style={{ background: CLAY, color: "#1a1512" }}
      >
        Find your people
      </button>
    </div>
  );
}
