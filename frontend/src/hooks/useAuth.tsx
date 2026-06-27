import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { api } from '../services/api';
import type { Profile } from '../types';

interface AuthContextType {
  user: Profile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const updateToken = (newToken: string | null) => {
    setToken(newToken);
    if (newToken) localStorage.setItem('token', newToken);
    else localStorage.removeItem('token');
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        try {
          const userData = await api.auth.me();
          if (!cancelled) setUser(userData);
        } catch {
          localStorage.removeItem('token');
          setToken(null);
        }
      }

      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          updateToken(session.access_token);
          try {
            const userData = await api.auth.me();
            if (!cancelled) setUser(userData);
          } catch {}
        }

        supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.access_token) {
            updateToken(session.access_token);
          }
        });
      }

      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    updateToken(res.token);
    setUser(res.user);
    if (supabase) {
      await supabase.auth.setSession({
        access_token: res.token,
        refresh_token: res.refreshToken || '',
      });
    }
  };

  const logout = () => {
    updateToken(null);
    setUser(null);
    supabase?.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);