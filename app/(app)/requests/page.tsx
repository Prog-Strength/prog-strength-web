"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { RequestsInbox } from "./_components/RequestsInbox";

/**
 * Follow requests — `/requests`. Lists incoming pending requests (Accept /
 * Reject) and, on a second tab, the viewer's outgoing pending requests
 * (Cancel). Shell mirrors timeline/page.tsx: a Suspense wrapper, a token guard
 * that bounces signed-out users to /login, and a thin header; the inbox body
 * owns fetch + the optimistic accept/reject/cancel actions.
 */
export default function RequestsPage() {
  return (
    <Suspense fallback={null}>
      <RequestsPageInner />
    </Suspense>
  );
}

function RequestsPageInner() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-1 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Requests</h1>
        <p className="text-xs text-[var(--muted)]">
          People asking to follow you, and your pending requests.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <RequestsInbox />
        </div>
      </div>
    </main>
  );
}
