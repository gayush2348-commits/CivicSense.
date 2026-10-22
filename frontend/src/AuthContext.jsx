import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);

async function authRequest(endpoint, payload) {
  let response;

  try {
    response = await fetch(`/api/auth/${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Backend se connect nahi ho pa raha. Check karo ki backend running hai.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Authentication request failed.");
  }

  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.user) {
        setUser(null);
        return null;
      }

      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializeAuth() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });

        const data = await response.json().catch(() => ({}));

        if (!cancelled) {
          setUser(response.ok && data.success && data.user ? data.user : null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (credentials) => {
      await authRequest("login", credentials);
      const currentUser = await refreshUser();

      if (!currentUser) {
        throw new Error(
          "Login response mila, lekin session verify nahi ho saka. Dobara try karo.",
        );
      }

      return currentUser;
    },
    [refreshUser],
  );

  const signup = useCallback(
    async (details) => {
      await authRequest("signup", details);

      // Ensure the newly created account also has an authenticated session.
      // This works whether signup itself sets the cookie or not.
      await authRequest("login", {
        email: details.email.trim().toLowerCase(),
        password: details.password,
      });

      const currentUser = await refreshUser();

      if (!currentUser) {
        throw new Error(
          "Account ban gaya, lekin login session verify nahi hua. Login page se sign in karo.",
        );
      }

      return currentUser;
    },
    [refreshUser],
  );

  const logout = useCallback(async () => {
    await authRequest("logout", {});
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    signup,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
