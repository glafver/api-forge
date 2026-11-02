/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";

interface Profile {
  id: string;
  username: string;
  must_change_password: boolean;
  is_blocked: boolean;
  email: string;
  created_at: string;
}

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

  const mapProfile = useCallback(
    (data: {
      Id?: string;
      Username?: string;
      Email?: string;
      MustChangePassword?: boolean;
      IsBlocked?: boolean;
      CreatedAt?: string;
      id?: string;
      username?: string;
      email?: string;
      mustChangePassword?: boolean;
      isBlocked?: boolean;
      createdAt?: string;
    }): Profile => ({
      id: data.Id ?? data.id ?? "",
      username: data.Username ?? data.username ?? "",
      email: data.Email ?? data.email ?? "",
      must_change_password:
        data.MustChangePassword ?? data.mustChangePassword ?? false,
      is_blocked: data.IsBlocked ?? data.isBlocked ?? false,
      created_at: data.CreatedAt ?? data.createdAt ?? "",
    }),
    [],
  );

  const readJsonIfPossible = useCallback(async (response: Response) => {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return null;
    }

    try {
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  const parseErrorMessage = useCallback(
    async (response: Response) => {
      try {
        const data = await readJsonIfPossible(response);
        if (typeof data?.Message === "string") return data.Message;
        if (typeof data?.message === "string") return data.message;
        if (typeof data?.error === "string") return data.error;
      } catch {
        console.error("Failed to parse error message from response");
      }
      const fallbackText = await response.text().catch(() => "");
      return fallbackText || response.statusText || "Request failed";
    },
    [readJsonIfPossible],
  );

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${apiBase}/api/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        return { error: await parseErrorMessage(response) };
      }

      const data = await readJsonIfPossible(response);
      if (!data) {
        return { error: "Unexpected response from server" };
      }
      setProfile(mapProfile(data));
      return {};
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Login failed" };
    }
  };

  const signOut = async () => {
    try {
      await fetch(`${apiBase}/api/user/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      console.error("Failed to log out");
    } finally {
      setProfile(null);
    }
  };

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/user/info`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setProfile(null);
        return;
      }

      const data = await readJsonIfPossible(response);
      if (!data) {
        setProfile(null);
        return;
      }
      setProfile(mapProfile(data));
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, mapProfile, readJsonIfPossible]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
