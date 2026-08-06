import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, logoutUser, getMe, tokenStore } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const loadUser = useCallback(async () => {
    if (!tokenStore.getAccess()) {
      setUser(null);
      setInitializing(false);
      return;
    }
    try {
      const res = await getMe();
      setUser(res.data);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    const onForceLogout = () => setUser(null);
    window.addEventListener('map-bank-logout', onForceLogout);
    return () => window.removeEventListener('map-bank-logout', onForceLogout);
  }, [loadUser]);

  const login = async (username, password) => {
    const res = await loginUser(username, password);
    tokenStore.setTokens(res.data.access, res.data.refresh);
    const me = await getMe();
    setUser(me.data);
    return me.data;
  };

  const register = async (payload) => {
    await registerUser(payload);
    // Auto-login right after successful registration.
    return login(payload.username, payload.password);
  };

  const logout = async () => {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) await logoutUser(refresh);
    } catch {
      // Ignore - we clear local tokens regardless.
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, initializing, login, register, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
