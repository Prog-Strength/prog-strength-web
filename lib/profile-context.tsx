"use client";

/**
 * Shared resolved-profile state for the authenticated app.
 *
 * The sidebar account anchor, the chat payload, and the Settings page all
 * read one resolved profile (`GET /me`) instead of each calling `getMe`
 * independently — so editing the display name in Settings updates the
 * sidebar row instantly, and the chat request always carries the current
 * name/height. The provider is mounted once in `app/(app)/layout.tsx`
 * (the authed subtree — the profile requires a token), wrapping the
 * sidebar + route content.
 *
 * Mirrors `usage-context.tsx`: fetch on mount when a token exists, expose
 * a hook, and on a 401 clear the token and route to /login. The mutating
 * methods (`update`, `uploadAvatar`, `removeAvatar`) call the API and
 * store the returned resolved profile into state, so every consumer
 * re-renders off one source of truth without a follow-up refetch.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAvatar, getMe, updateMe, uploadAvatar, type ResolvedProfile } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

type ProfilePatch = {
  display_name?: string;
  height_cm?: number | null;
  weight_unit?: "lb" | "kg";
  distance_unit?: "mi" | "km";
};

type ProfileContextValue = {
  profile: ResolvedProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  update: (patch: ProfilePatch) => Promise<ResolvedProfile>;
  uploadAvatar: (file: File) => Promise<ResolvedProfile>;
  removeAvatar: () => Promise<ResolvedProfile>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Keep `router` in a ref so the mutating callbacks stay referentially
  // stable (useRouter() returns a fresh object each render; depending on
  // it directly would re-run the mount effect and double-fetch). Synced
  // in an effect, not during render, per the rules of hooks.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const [profile, setProfile] = useState<ResolvedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On a 401 from any profile call, drop the token and bounce to /login.
  // Returns true when it handled an auth failure so callers can stop.
  const handleAuthError = useCallback((err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("401")) {
      clearToken();
      routerRef.current.replace("/login");
      return true;
    }
    return false;
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const token = getToken();
    if (!token) {
      // No token → stay idle. Drop the loading flag so a signed-out
      // render doesn't spin forever; the (app) layout's auth gate is what
      // actually keeps unauthed users out.
      setLoading(false);
      return;
    }
    try {
      const data = await getMe(token);
      setProfile(data);
      setError(null);
    } catch (err: unknown) {
      if (handleAuthError(err)) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  // Shared write path for the three mutating methods: run the API call,
  // store the returned resolved profile, and rethrow (after handling 401)
  // so the caller can surface the error (e.g. an inline 400 in Settings).
  const mutate = useCallback(
    async (op: (token: string) => Promise<ResolvedProfile>): Promise<ResolvedProfile> => {
      const token = getToken();
      if (!token) {
        routerRef.current.replace("/login");
        throw new Error("not authenticated");
      }
      try {
        const next = await op(token);
        setProfile(next);
        setError(null);
        return next;
      } catch (err: unknown) {
        if (handleAuthError(err)) {
          throw err;
        }
        throw err;
      }
    },
    [handleAuthError],
  );

  const update = useCallback(
    (patch: ProfilePatch) => mutate((token) => updateMe(token, patch)),
    [mutate],
  );

  const doUploadAvatar = useCallback(
    (file: File) => mutate((token) => uploadAvatar(token, file)),
    [mutate],
  );

  const removeAvatar = useCallback(() => mutate((token) => deleteAvatar(token)), [mutate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value: ProfileContextValue = {
    profile,
    loading,
    error,
    refresh,
    update,
    uploadAvatar: doUploadAvatar,
    removeAvatar,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

/**
 * Returns the shared resolved profile + mutators. Throws if used outside a
 * `<ProfileProvider>` so a missing provider fails loudly rather than
 * silently rendering an empty account row.
 */
export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}
