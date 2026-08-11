/**
 * Whoop connection CAPABILITY — the scope a surface needs, and the one copy of
 * the reconnect sentence both surfaces print.
 *
 * `missing_scopes` is a capability axis separate from `status`: a Whoop OAuth
 * grant is fixed at consent and a token refresh re-sends the scope string but
 * cannot WIDEN it, so a connection made before `read:sleep` was requested is
 * connected, valid, still syncing recovery — and permanently sleepless until
 * the user re-consents.
 *
 * Two rules live here because getting either wrong is a user-visible lie:
 *
 *   - **Ask about a scope BY NAME.** "Some scope is missing" is not "sleep is
 *     missing". A connection missing only `read:workout` still ingests sleep
 *     perfectly, and a surface that reads the array's length rather than its
 *     contents would hide that user's real data behind a reconnect prompt.
 *   - **One copy of the copy.** The dashboard tile and the Settings row say the
 *     same sentence, so it is a constant here rather than two literals that
 *     drift apart with nothing enforcing the match.
 */

import type { WhoopConnection } from "./api";

/**
 * The scope the sleep ingestion path needs, spelled exactly as the API's
 * `RequiredScopes` spells it. Never rendered — `read:sleep` is not a
 * user-facing noun.
 */
export const SLEEP_SCOPE = "read:sleep";

/** The Settings → Integrations tab, where the Reconnect control lives. */
export const SETTINGS_INTEGRATIONS_HREF = "/settings?tab=integrations";

/** The reconnect call to action, in product terms. */
export const SLEEP_RECONNECT_CTA = "Reconnect to enable sleep tracking";

/** Why the user is being asked — the sentence under the tile's CTA. */
export const SLEEP_RECONNECT_REASON = "Your Whoop connection predates it.";

/** The same two sentences on one line, for a row that has only one. */
export const SLEEP_RECONNECT_LINE = `${SLEEP_RECONNECT_CTA}. ${SLEEP_RECONNECT_REASON}`;

/**
 * The line for a connection under-scoped on something OTHER than sleep. It
 * names no capability on purpose: a truthful generic sentence beats a specific
 * wrong one, and the scope names themselves are not user-facing nouns.
 */
export const SCOPE_RECONNECT_LINE = "Reconnect to enable the rest of your Whoop sync.";

/**
 * Whether a connection is connected but never consented to the sleep scope —
 * the ONLY test a sleep surface may make. A connection missing some other
 * scope is fully able to ingest sleep.
 */
export function missingSleepScope(conn: WhoopConnection | null | undefined): boolean {
  return conn?.status === "connected" && (conn.missing_scopes?.includes(SLEEP_SCOPE) ?? false);
}

/**
 * Whether a connection is connected but missing any scope ingestion requires.
 * This is the Settings row's question — it speaks for every capability, so
 * "something is missing" is the right granularity there, and
 * {@link underScopedLine} decides how honestly it can be described.
 */
export function missingAnyScope(conn: WhoopConnection | null | undefined): boolean {
  return conn?.status === "connected" && (conn.missing_scopes?.length ?? 0) > 0;
}

/**
 * The status line for an under-scoped connection: the sleep sentence when sleep
 * is what is missing, the generic one otherwise. Callers gate on
 * {@link missingAnyScope} first; this only chooses the words.
 */
export function underScopedLine(conn: WhoopConnection | null | undefined): string {
  return missingSleepScope(conn) ? SLEEP_RECONNECT_LINE : SCOPE_RECONNECT_LINE;
}
