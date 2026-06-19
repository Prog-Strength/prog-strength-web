"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

/**
 * Root route is just an auth-gated redirect. Logged in → /dashboard.
 * Logged out → /login. Keeps the URL clean so the user never sees a "/"
 * landing page in either state.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(isAuthenticated() ? "/dashboard" : "/login");
  }, [router]);

  return null;
}
