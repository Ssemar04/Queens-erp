import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  AUTH_USER_KEY,
  AUTH_INVALID_EVENT,
  clearStoredAuth,
  getCurrentUser,
  getStoredAuthToken,
  getStoredBackendUser,
  loginUser,
  logoutUser,
  setStoredBackendSession,
  type BackendUser,
} from "@/services/api";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  updateUserProfile: (updates: { full_name?: string; username?: string; avatar_url?: string; phone?: string; role?: string; mustChangePassword?: boolean }) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function createBackendSession(token: string, backendUser: BackendUser): Session {
  return {
    access_token: token,
    refresh_token: "",
    expires_in: 60 * 60 * 24 * 7,
    token_type: "bearer",
    user: {
      id: backendUser.id,
      aud: "authenticated",
      role: "authenticated",
      email: backendUser.email,
      app_metadata: {},
      user_metadata: {
        full_name: backendUser.name,
        role: backendUser.role ?? "staff",
        isActive: backendUser.isActive ?? true,
        mustChangePassword: backendUser.mustChangePassword ?? false,
        chatUserId: backendUser.chatUserId ?? backendUser.id,
        branchId: backendUser.branchId,
      },
      created_at: new Date().toISOString(),
    } as User,
  } as Session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleInvalidAuth = () => {
      clearStoredAuth();
      setSession(null);
      setIsLoading(false);
    };

    window.addEventListener(AUTH_INVALID_EVENT, handleInvalidAuth);

    if (!supabase) {
      const token = getStoredAuthToken();

      if (!token) {
        setSession(null);
        setIsLoading(false);
        return () => {
          window.removeEventListener(AUTH_INVALID_EVENT, handleInvalidAuth);
        };
      }

      let isMounted = true;

      getCurrentUser()
        .then((response) => {
          if (!isMounted) return;

          if (response.success && response.user) {
            setStoredBackendSession(token, response.user);
            setSession(createBackendSession(token, response.user));
            return;
          }

          clearStoredAuth();
          setSession(null);
        })
        .catch(() => {
          if (!isMounted) return;
          clearStoredAuth();
          setSession(null);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return () => {
        isMounted = false;
        window.removeEventListener(AUTH_INVALID_EVENT, handleInvalidAuth);
      };
    }

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return () => {
        window.removeEventListener(AUTH_INVALID_EVENT, handleInvalidAuth);
      };
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener(AUTH_INVALID_EVENT, handleInvalidAuth);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      try {
        const response = await loginUser(email, password);

        if (!response.success || !response.user || !response.token) {
          return {
            error: new Error(response.message || "Login failed") as AuthError,
          };
        }

        setStoredBackendSession(response.token, response.user);
        setSession(createBackendSession(response.token, response.user));
        return { error: null };
      } catch (error) {
        const message =
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
            : null;

        return {
          error: new Error(
            message || (error instanceof Error ? error.message : "Unable to connect to the backend"),
          ) as AuthError,
        };
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      await logoutUser().catch(() => null);
      clearStoredAuth();
      setSession(null);
      return { error: null };
    }

    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const updateUserProfile = useCallback((updates: { full_name?: string; username?: string; avatar_url?: string; phone?: string; role?: string; mustChangePassword?: boolean }) => {
    setSession((prev) => {
      if (!prev || !prev.user) return prev;
      const updatedUser_metadata = {
        ...prev.user.user_metadata,
        ...updates,
      };
      const updatedUser = {
        ...prev.user,
        user_metadata: updatedUser_metadata,
      };

      // Also sync the stored backend session profile.
      const stored = getStoredBackendUser();
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (updates.full_name !== undefined) parsed.name = updates.full_name;
          if (updates.avatar_url !== undefined) parsed.avatar_url = updates.avatar_url;
          if (updates.role !== undefined) parsed.role = updates.role;
          if (updates.mustChangePassword !== undefined) parsed.mustChangePassword = updates.mustChangePassword;
          window.sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(parsed));
          window.localStorage.removeItem(AUTH_USER_KEY);
        } catch {
          // ignore
        }
      }

      return {
        ...prev,
        user: updatedUser as User,
      };
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      isAuthenticated: Boolean(session?.user),
      signIn,
      signOut,
      updateUserProfile,
    }),
    [isLoading, session, signIn, signOut, updateUserProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
