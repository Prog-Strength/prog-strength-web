"use client";

import { useState } from "react";
import { getToken } from "@/lib/auth";
import { searchProfiles, type ProfileSummary } from "@/lib/api";
import { ProfileRow } from "@/components/social/ProfileRow";

/**
 * The right "find people to follow" rail on the timeline dashboard. Backed by
 * the existing searchProfiles API + ProfileRow (which renders a FollowButton).
 * This is a search-entry, not a suggestion algorithm or leaderboard: the user
 * types a query, hits Search, and sees matching athletes to follow. Empty /
 * initial state shows an inviting prompt. Tokens only.
 */
export function DiscoveryRail() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProfileSummary[] | null>(null);
  const [searching, setSearching] = useState(false);

  const run = async (query: string) => {
    const token = getToken();
    if (!token || query.trim().length < 2) return;
    setSearching(true);
    try {
      const page = await searchProfiles(token, query.trim());
      setResults(page.users);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <section
      aria-label="Find people to follow"
      className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Find people to follow</h2>
        <p className="text-xs text-[var(--muted)]">
          Follow other athletes to fill your feed with their training.
        </p>
      </div>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search athletes…"
          aria-label="Search athletes"
          className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={q.trim().length < 2 || searching}
          className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searching ? "…" : "Search"}
        </button>
      </form>

      {results === null && (
        <p className="text-xs text-[var(--faint)]">Search by name or @handle to get started.</p>
      )}
      {results !== null && results.length === 0 && (
        <p className="text-xs text-[var(--muted)]">No athletes found. Try another name.</p>
      )}
      {results !== null && results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((u) => (
            <li key={u.user_id}>
              <ProfileRow user={u} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
