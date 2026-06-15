"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { SearchResults } from "./_components/SearchResults";

/**
 * People search — `/search`. A debounced query input over `searchProfiles`
 * with ranked result rows carrying inline follow buttons. Shell mirrors
 * timeline/page.tsx: a Suspense wrapper, a token guard that bounces signed-out
 * users to /login, and a thin header; the search body owns the rest.
 */
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-1 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Search</h1>
        <p className="text-xs text-[var(--muted)]">Find people to follow.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <SearchResults />
        </div>
      </div>
    </main>
  );
}
