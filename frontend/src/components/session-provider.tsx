"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import {
  apiFetch,
  clearToken,
  getToken,
  isAuthErrorMessage,
  SESSION_CHANGED_EVENT,
  signOut
} from "@/lib/api";
import type { UserProfile } from "@/lib/types";

type SessionState = "idle" | "loading" | "authed" | "unauth";

type SessionContextValue = {
  token: string | null;
  profile: UserProfile | null;
  status: SessionState;
  error: string | null;
  refresh: () => Promise<void>;
  logout: (redirectTo?: string, options?: { hard?: boolean }) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<SessionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const loadSeqRef = useRef(0);

  useEffect(() => {
    setTokenState(getToken());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onSessionChanged = () => {
      const nextToken = getToken();
      setTokenState(nextToken);
      if (!nextToken) {
        loadSeqRef.current += 1;
        setProfile(null);
        setStatus("unauth");
        setError(null);
      }
    };

    window.addEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
  }, []);

  const load = useCallback(async () => {
    if (!hydrated) return;

    const currentToken = getToken();
    setTokenState(currentToken);

    if (!currentToken) {
      setStatus("unauth");
      setProfile(null);
      setError(null);
      return;
    }

    const seq = ++loadSeqRef.current;
    setStatus("loading");
    setError(null);

    try {
      const me = await apiFetch<UserProfile>("/auth/me", { token: currentToken });
      if (seq !== loadSeqRef.current) return;
      setProfile(me);
      setStatus("authed");
    } catch (e: unknown) {
      if (seq !== loadSeqRef.current) return;
      const message = e instanceof Error ? e.message : "Failed to load session";
      setError(message);
      if (isAuthErrorMessage(message) || !getToken()) {
        clearToken();
      }
      setProfile(null);
      setStatus("unauth");
    }
  }, [hydrated]);

  useEffect(() => {
    void load();
  }, [load, token, hydrated]);

  const logout = useCallback(
    (redirectTo?: string | unknown, options?: { hard?: boolean }) => {
      const path = typeof redirectTo === "string" ? redirectTo : "/auth/login";
      loadSeqRef.current += 1;
      setTokenState(null);
      setProfile(null);
      setStatus("unauth");
      setError(null);

      if (options?.hard) {
        signOut(path);
        return;
      }

      clearToken();
      router.replace(path);
      router.refresh();
    },
    [router]
  );

  const value = useMemo(
    () => ({
      token,
      profile,
      status,
      error,
      refresh: load,
      logout
    }),
    [token, profile, status, error, load, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
