
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { API } from '../services/api';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
  adminViewClass: string | null;
  setAdminViewClass: (classId: string | null) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminViewClass, setAdminViewClass] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Theme initialization
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await API.auth.getSession();
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (e) {
        console.error("Auth initialization failed", e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setAdminViewClass(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const profile = await API.auth.getSession();
          setUser(profile);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const foundUser = await API.auth.login(email, pass);
    setUser(foundUser);
  };

  const logout = async () => {
    try {
      // 1. Sign out from Supabase (Server side)
      await supabase.auth.signOut();
      
      // 2. Local State Reset
      setUser(null);
      setAdminViewClass(null);
      
      // 3. Complete Storage Wipe
      // Nettoyage de tous les tokens possibles de Supabase
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      // 4. Final redirect and FORCE RELOAD to clear any remaining in-memory state
      window.location.hash = '#/login';
      window.location.reload(); 
    } catch (e) {
      console.warn("Forced cleanup due to signout error:", e);
      localStorage.clear();
      window.location.hash = '#/login';
      window.location.reload();
    }
  };

  const updateCurrentUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = await API.auth.updateProfile(user.id, updates);
    if (updatedUser) setUser(updatedUser);
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      document.documentElement.classList.toggle('dark', newMode);
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      return newMode;
    });
  };

  if (loading) {
      return (
          <div id="app-loader">
              <div className="spinner"></div>
              <p className="mt-4 text-sm font-black text-gray-500 uppercase tracking-widest italic animate-pulse">Synchronisation JangHup...</p>
          </div>
      );
  }

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, login, logout, updateCurrentUser,
      adminViewClass, setAdminViewClass, toggleTheme, isDarkMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
