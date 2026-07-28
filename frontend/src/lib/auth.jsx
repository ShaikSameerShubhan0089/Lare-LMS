import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokens } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokens.access && !tokens.refresh) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api.me());
    } catch (e) {
      // Only log out on a genuine auth failure (401 — token invalid/expired and
      // refresh also failed). A transient network/server error must NOT clear the
      // session or bounce the user to login (e.g. a tunnel blip mid-exam); keep
      // the tokens so the next request/refresh recovers.
      if (e?.status === 401) {
        tokens.clear();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const t = await api.login(email, password);
    tokens.set(t);
    setUser(await api.me());
  };

  const register = async (email, password, full_name) => {
    await api.register(email, password, full_name);
    await login(email, password);
  };

  const logout = async () => {
    try {
      if (tokens.refresh) await api.logout(tokens.refresh);
    } catch {
      /* ignore */
    }
    tokens.clear();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, reload: loadMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
