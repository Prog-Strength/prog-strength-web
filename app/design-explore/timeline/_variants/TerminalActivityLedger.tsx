/**
 * IDIOM: terminal-activity-ledger  (reference: Linear — dense type, single-accent
 * restraint, structured panes)
 *
 * The following feed as a precise activity stream. Monospace metadata in
 * aligned columns, tight log-like rows, kudos and type shown by glyphs not
 * chrome, a compact ranked sidebar. Keyboard-navigable, high density, one sharp
 * accent on graphite.
 *
 * - TYPE SCALE: uniform monospace; hierarchy comes from weight + indentation +
 *   color, not size jumps. Tabular by construction.
 * - COLOR LOGIC: graphite everything, ONE sharp lime accent for the active row /
 *   your kudos / your leaderboard line; type shown by a single colored glyph.
 * - SPACING RHYTHM: dense, ledgered — maximum activity per screen, hairline
 *   row separators, monospace gutters.
 */
"use client";

import { useState } from "react";
import { Radar } from "../atoms";
import { FEED, LEADERBOARD, totalKudos, type DxPost } from "../fixtures";

const LIME = "#a3e635";
const mono = "var(--font-geist-mono), ui-monospace, 'JetBrains Mono', Menlo, monospace";

const TYPE_GLYPH: Record<DxPost["source_type"], string> = {
  run: "▸ run",
  workout: "▸ lift",
  pr: "★ PR",
  best_effort: "⚡ best",
};

export function TerminalActivityLedger() {
  const [selected, setSelected] = useState<string>(FEED[0].id);
  return (
    <div
      className="rounded-md border border-[#1e1e1e] bg-[#0a0a0a] p-3 text-[#c8c8c8]"
      style={{ fontFamily: mono, fontSize: 12.5 }}
    >
      <div className="mb-2 flex items-center justify-between border-b border-[#1e1e1e] pb-2 text-[11px] text-[#6a6a6a]">
        <span>
          <span style={{ color: LIME }}>~/feed</span> following · 5 entries
        </span>
        <span>
          <kbd className="rounded-sm bg-[#161616] px-1">j</kbd>/
          <kbd className="rounded-sm bg-[#161616] px-1">k</kbd> to navigate
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_232px]">
        <div className="flex flex-col">
          {/* column header */}
          <div className="flex gap-3 border-b border-[#1e1e1e] px-2 py-1 text-[10px] uppercase tracking-wider text-[#5a5a5a]">
            <span className="w-14">type</span>
            <span className="w-24">@who</span>
            <span className="flex-1">activity</span>
            <span className="w-12 text-right">when</span>
          </div>
          {FEED.map((p) => (
            <LedgerRow
              key={p.id}
              post={p}
              open={selected === p.id}
              onToggle={() => setSelected(selected === p.id ? "" : p.id)}
            />
          ))}
          <EmptyState />
        </div>
        <Sidebar />
      </div>
    </div>
  );
}

function LedgerRow({
  post,
  open,
  onToggle,
}: {
  post: DxPost;
  open: boolean;
  onToggle: () => void;
}) {
  const isMilestone = post.source_type === "pr" || post.source_type === "best_effort";
  return (
    <div className="border-b border-[#161616]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-2 py-1.5 text-left transition hover:bg-[#111]"
        style={{
          background: open ? "rgba(163,230,53,0.06)" : undefined,
          borderLeft: `2px solid ${open ? LIME : "transparent"}`,
        }}
      >
        <span className="w-14 shrink-0" style={{ color: isMilestone ? LIME : "#8a8a8a" }}>
          {TYPE_GLYPH[post.source_type]}
        </span>
        <span
          className="w-24 shrink-0 truncate"
          style={{ color: post.author.is_self ? LIME : "#c8c8c8" }}
        >
          @{post.author.username}
        </span>
        <span className="flex-1 truncate">
          <span className={isMilestone ? "font-bold text-white" : "text-[#d8d8d8]"}>
            {post.title}
          </span>
          <span className="ml-2 text-[#6a6a6a]">
            {post.stats.map((s) => `${s.value}${s.unit ?? ""}`).join(" · ")}
          </span>
        </span>
        <span className="flex w-auto shrink-0 items-center gap-2 text-[#6a6a6a]">
          <span style={{ color: post.mine.length ? LIME : "#6a6a6a" }}>+{totalKudos(post)}</span>
          <span>↵{post.comment_count}</span>
          <span className="w-12 text-right text-[11px]">
            {post.occurred_at.replace(" ago", "").replace("Yesterday", "1d")}
          </span>
        </span>
      </button>

      {open && (
        <div className="px-2 pb-3 pl-[4.7rem] pt-1 text-[12px] leading-relaxed text-[#9a9a9a]">
          {post.subtitle && (
            <div className="text-[#7a7a7a]">
              {"// "}
              {post.subtitle}
            </div>
          )}
          {post.notes && (
            <div className="mt-1 whitespace-pre-wrap text-[#b8b8b8]">{post.notes}</div>
          )}

          {/* stat table */}
          <table className="mt-2 border-collapse">
            <tbody>
              {post.stats.map((s) => (
                <tr key={s.label}>
                  <td className="pr-4 text-[#5a5a5a]">{s.label.toLowerCase().padEnd(10, " ")}</td>
                  <td className="text-white">
                    {s.value}
                    {s.unit ? ` ${s.unit}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {post.route && (
            <div className="mt-2 text-[#5a5a5a]">
              route ·{" "}
              <span style={{ color: LIME }}>
                {"⎍".repeat(0)}
                {post.route.map((_, i) => (i % 2 ? "╱" : "╲")).join("")}
              </span>
            </div>
          )}
          {post.radar && (
            <div className="mt-2 flex items-center gap-3">
              <Radar
                data={post.radar}
                stroke={LIME}
                fill="rgba(163,230,53,0.14)"
                grid="#2a2a2a"
                size={96}
                label="muscle"
              />
              <pre className="text-[11px] leading-snug text-[#8a8a8a]">
                {post.radar
                  .map(
                    (r) =>
                      `${r.label.padEnd(10)} ${"█".repeat(Math.round(r.value * 10)).padEnd(10, "·")}`,
                  )
                  .join("\n")}
              </pre>
            </div>
          )}

          <div className="mt-2 flex gap-3 text-[11px] text-[#6a6a6a]">
            <span style={{ color: post.mine.includes("like") ? LIME : undefined }}>
              [+] like {post.reactions.like}
            </span>
            <span style={{ color: post.mine.includes("strong") ? LIME : undefined }}>
              [^] strong {post.reactions.strong}
            </span>
            <span style={{ color: post.mine.includes("fire") ? LIME : undefined }}>
              [*] fire {post.reactions.fire}
            </span>
            <span style={{ color: post.mine.includes("celebrate") ? LIME : undefined }}>
              [!] celeb {post.reactions.celebrate}
            </span>
          </div>
          {post.top_comment && (
            <div className="mt-2 text-[#7a7a7a]">
              <span style={{ color: LIME }}>
                @{post.top_comment.author.split(" ")[0].toLowerCase()}
              </span>{" "}
              {post.top_comment.body}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="flex flex-col gap-3">
      <div className="rounded-sm border border-[#1e1e1e] bg-[#0d0d0d] p-2">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-[#5a5a5a]">
          rank · steps/wk
        </div>
        <ol>
          {LEADERBOARD.map((r) => (
            <li
              key={r.rank}
              className="flex items-center gap-2 py-0.5"
              style={{
                color: r.is_self ? LIME : "#9a9a9a",
                background: r.is_self ? "rgba(163,230,53,0.06)" : undefined,
              }}
            >
              <span className="w-5 text-right text-[#5a5a5a]">
                {String(r.rank).padStart(2, "0")}
              </span>
              <span className="flex-1 truncate">
                {r.is_self ? "you" : `@${r.name.split(" ")[0].toLowerCase()}`}
              </span>
              <span className="tabular-nums">{(r.steps / 1000).toFixed(1)}k</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-sm border border-[#1e1e1e] bg-[#0d0d0d] p-2 text-[11px] text-[#6a6a6a]">
        <div className="text-[#5a5a5a]">{"// hint"}</div>
        <div className="mt-1">
          <kbd className="bg-[#161616] px-1">f</kbd> follow ·{" "}
          <kbd className="bg-[#161616] px-1">/</kbd> search athletes
        </div>
      </div>
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="mt-3 rounded-sm border border-dashed border-[#2a2a2a] bg-[#0d0d0d] p-3 text-[12px]">
      <div className="text-[#6a6a6a]">{"$ feed --following"}</div>
      <div className="mt-1" style={{ color: LIME }}>
        0 results — you follow no one yet.
      </div>
      <div className="mt-1 text-[#8a8a8a]">
        {"› run "}
        <span className="text-white">find-athletes</span>
        {" to populate the stream."}
      </div>
      <button
        className="mt-2 border border-[#2a2a2a] px-2 py-1 text-[11px]"
        style={{ color: LIME }}
      >
        [ find people to follow ]
      </button>
    </div>
  );
}
