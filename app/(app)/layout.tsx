"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

/**
 * Shared shell for every authenticated app page: sidebar on the left,
 * route content on the right. Route groups (the parentheses on the
 * directory name) don't appear in URLs — `(app)/chat/page.tsx` still
 * serves at `/chat`.
 *
 * Auth-gating happens here rather than per-page so we don't duplicate
 * the localStorage check across /chat, /workouts, /calendar, etc.
 * `ready` blocks the first paint until we know the user is authed,
 * which avoids a flash of the chat UI before we redirect them to
 * /login.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
