/**
 * IDIOM: garmin-feed-leaderboard  (reference: Garmin Connect — News Feed + Weekly Leaderboard)
 *
 * Two-column competition dashboard. Center = a news feed of metric-DENSE
 * activity cards (every stat a bordered, labeled block). Right = a prominent
 * Weekly Leaderboard rail ranked among the people you follow, your row
 * highlighted mid-pack, with a Steps / Volume metric switcher.
 *
 * - TYPE SCALE: small utilitarian sans + tabular numerals; uniform, functional,
 *   little display hierarchy — the data is the hero, not the headline.
 * - COLOR LOGIC: functional + category-coded (run/lift/PR/best each get a fixed
 *   hue), otherwise restrained Garmin-blue chrome on slate.
 * - SPACING RHYTHM: tight, gridded, data-forward — a competitive dashboard,
 *   minimal whitespace, stat blocks packed edge to edge.
 */
"use client";

import { useState } from "react";
import { Radar } from "../atoms";
import { FEED, LEADERBOARD, SOURCE_META, type DxPost, type SourceType } from "../fixtures";

const BLUE = "#1aa7d8";
const CATEGORY: Record<SourceType, { tint: string; chip: string }> = {
  run: { tint: "#1aa7d8", chip: "rgba(26,167,216,0.14)" },
  workout: { tint: "#8b5cf6", chip: "rgba(139,92,246,0.14)" },
  pr: { tint: "#f5a623", chip: "rgba(245,166,35,0.16)" },
  best_effort: { tint: "#2dd4a7", chip: "rgba(45,212,167,0.16)" },
};

export function GarminFeedLeaderboard() {
  return (
    <div
      className="rounded-lg bg-[#0e1217] p-4 text-[#d6dde4]"
      style={{ fontFamily: "system-ui, 'Segoe UI', sans-serif", fontSize: 13 }}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-3">
          {FEED.map((p) => (
            <MetricCard key={p.id} post={p} />
          ))}
          <EmptyState />
        </div>
        <Leaderboard />
      </div>
    </div>
  );
}

function MetricCard({ post }: { post: DxPost }) {
  const meta = SOURCE_META[post.source_type];
  const cat = CATEGORY[post.source_type];
  return (
    <article
      className="overflow-hidden rounded-md border border-[#23303b] bg-[#141a21]"
      style={{ borderLeft: `3px solid ${cat.tint}` }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#23303b] text-[11px] font-semibold">
            {post.author.initials}
          </span>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-white">{post.author.name}</span>
              {post.author.is_self && <span className="text-[10px] text-[#5b6b78]">(you)</span>}
            </div>
            <span className="text-[11px] text-[#5b6b78]">{post.occurred_at}</span>
          </div>
        </div>
        <span
          className="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: cat.chip, color: cat.tint }}
        >
          {meta.emoji} {meta.label}
        </span>
      </div>

      <div className="px-3">
        <h3 className="text-[14px] font-semibold leading-tight text-white">{post.title}</h3>
        {post.subtitle && <p className="text-[11px] text-[#7e8b96]">{post.subtitle}</p>}
        {post.notes && <p className="mt-1 text-[12px] leading-snug text-[#9aa6b1]">{post.notes}</p>}
      </div>

      {/* Dense, bordered, labeled stat blocks — the Garmin signature. */}
      <div
        className="mt-2 grid"
        style={{ gridTemplateColumns: `repeat(${Math.min(post.stats.length, 4)}, 1fr)` }}
      >
        {post.stats.map((s) => (
          <div
            key={s.label}
            className="border-t border-[#23303b] px-3 py-2 [&:not(:first-child)]:border-l"
          >
            <div className="text-[16px] font-semibold tabular-nums text-white">
              {s.value}
              {s.unit && (
                <span className="ml-0.5 text-[11px] font-normal text-[#7e8b96]">{s.unit}</span>
              )}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-[#5b6b78]">{s.label}</div>
          </div>
        ))}
      </div>

      {post.radar && (
        <div className="flex items-center gap-3 border-t border-[#23303b] px-3 py-2">
          <Radar
            data={post.radar}
            stroke={CATEGORY.workout.tint}
            fill="rgba(139,92,246,0.2)"
            grid="#3a4a57"
            size={108}
            label="Muscle map"
          />
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1">
            {post.radar.map((r) => (
              <div key={r.label} className="flex items-center justify-between text-[11px]">
                <span className="text-[#7e8b96]">{r.label}</span>
                <span className="tabular-nums text-[#d6dde4]">{Math.round(r.value * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-[#23303b] px-3 py-1.5 text-[11px] text-[#7e8b96]">
        <div className="flex items-center gap-3 tabular-nums">
          <span style={{ color: post.mine.includes("like") ? BLUE : undefined }}>
            👍 {post.reactions.like}
          </span>
          <span style={{ color: post.mine.includes("strong") ? BLUE : undefined }}>
            💪 {post.reactions.strong}
          </span>
          <span style={{ color: post.mine.includes("fire") ? BLUE : undefined }}>
            🔥 {post.reactions.fire}
          </span>
          <span style={{ color: post.mine.includes("celebrate") ? BLUE : undefined }}>
            🎉 {post.reactions.celebrate}
          </span>
        </div>
        <span className="tabular-nums">💬 {post.comment_count}</span>
      </div>
    </article>
  );
}

function Leaderboard() {
  const [metric, setMetric] = useState<"steps" | "volume">("steps");
  const max = Math.max(...LEADERBOARD.map((r) => r[metric]));
  return (
    <aside className="flex h-fit flex-col rounded-md border border-[#23303b] bg-[#141a21]">
      <div className="flex items-center justify-between border-b border-[#23303b] px-3 py-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-white">
          Weekly Leaderboard
        </h3>
      </div>
      <div className="flex gap-1 border-b border-[#23303b] px-3 py-2">
        {(["steps", "volume"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className="flex-1 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition"
            style={{
              background: metric === m ? BLUE : "#1c252e",
              color: metric === m ? "#0e1217" : "#7e8b96",
            }}
          >
            {m === "steps" ? "Steps" : "Volume"}
          </button>
        ))}
      </div>
      <ol className="flex flex-col">
        {LEADERBOARD.map((row) => {
          const v = row[metric];
          return (
            <li
              key={row.rank}
              className="relative flex items-center gap-2 px-3 py-1.5"
              style={{ background: row.is_self ? "rgba(26,167,216,0.12)" : undefined }}
            >
              <span
                className="w-5 text-center text-[12px] font-bold tabular-nums"
                style={{ color: row.rank <= 3 ? BLUE : "#5b6b78" }}
              >
                {row.rank}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#23303b] text-[10px] font-semibold">
                {row.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`truncate text-[12px] ${row.is_self ? "font-bold text-white" : "text-[#c2ccd5]"}`}
                  >
                    {row.name}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-white">
                    {metric === "steps" ? v.toLocaleString() : `${(v / 1000).toFixed(1)}k`}
                  </span>
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[#1c252e]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(v / max) * 100}%`,
                      background: row.is_self ? BLUE : "#3a4a57",
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-[#23303b] px-3 py-2 text-[10px] text-[#5b6b78]">
        {metric === "steps" ? "Steps" : "Volume lifted"} · among people you follow
      </p>
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-[#23303b] bg-[#141a21] p-4">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-white">
        No activity from your network
      </h3>
      <p className="mt-1 text-[12px] text-[#7e8b96]">
        Connect with athletes to populate your feed and join the weekly leaderboard.
      </p>
      <button
        className="mt-3 rounded-sm px-3 py-1.5 text-[12px] font-semibold"
        style={{ background: BLUE, color: "#0e1217" }}
      >
        Find people to follow
      </button>
    </div>
  );
}
