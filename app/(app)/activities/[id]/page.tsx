"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearToken, getToken, setPostLoginPath } from "@/lib/auth";
import { getActivity } from "@/lib/api";
import { activityDetailPath } from "@/lib/activity-route";

/**
 * Canonical activity permalink: resolves an activity's type and forwards to
 * that type's detail route.
 *
 * This route exists for links that live OUTSIDE the app and outlive our
 * control of them — today, the "Open in Prog Strength" footer on every synced
 * Google Calendar event. Google keeps its copy of an event body indefinitely
 * and we cannot rewrite history, so a link baked in today has to still resolve
 * correctly after web routing changes. Writing `/activities/{id}` and
 * resolving the type at CLICK time means the day a real `/cycling/{id}` page
 * ships, every calendar event ever written starts landing on it — including
 * the ones already sitting in someone's calendar.
 *
 * It is a client component because the API is authed with a JWT held in
 * localStorage: a server redirect has no token and cannot ask what type the
 * activity is. The visible cost is one hop; the redirect is `replace`, so the
 * permalink does not linger in history and Back returns where the user came
 * from rather than bouncing through here again.
 */
export default function ActivityPermalinkPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      // Preserve the destination across login. Someone arriving from a
      // calendar event is very often logged out — that is the whole point of
      // the link — so dropping them on the dashboard would defeat it.
      setPostLoginPath(`/activities/${id}`);
      router.replace("/login");
      return;
    }
    getActivity(token, id)
      .then((activity) => {
        router.replace(activityDetailPath(activity.activity_type, activity.id));
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("401")) {
          clearToken();
          setPostLoginPath(`/activities/${id}`);
          router.replace("/login");
          return;
        }
        setError(msg.toLowerCase().includes("not found") ? "notFound" : msg);
      });
  }, [id, router]);

  if (error === "notFound") {
    return (
      <CenteredMessage>
        <p className="text-sm font-medium">Activity not found</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          It may have been deleted since this link was created.
        </p>
        <Link href="/activities" className="mt-3 text-xs text-[var(--accent)] hover:underline">
          ← Back to activities
        </Link>
      </CenteredMessage>
    );
  }

  if (error) {
    return (
      <CenteredMessage>
        <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
        <Link href="/activities" className="mt-3 text-xs text-[var(--accent)] hover:underline">
          ← Back to activities
        </Link>
      </CenteredMessage>
    );
  }

  return (
    <CenteredMessage>
      <p className="text-sm text-[var(--muted)]">Opening activity…</p>
    </CenteredMessage>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      {children}
    </main>
  );
}
