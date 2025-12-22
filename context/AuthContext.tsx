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
        const sessionUser = await API.auth.getSession();
        setUser(sessionUser);
      } catch (e) {
        console.error("Auth initialization failed", e);
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();

    // Listen for auth changes (native Supabase session management)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Fix: Removed 'USER_DELETED' as it's not a valid type in the current Supabase AuthChangeEvent union
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setAdminViewClass(null);
      } else if (session?.user) {
        const profile = await API.auth.getSession();
        setUser(profile);
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
      // 1. Déconnexion côté serveur via Supabase
      await supabase.auth.signOut();
      
      // 2. Réinitialisation de l'état local
      setUser(null);
      setAdminViewClass(null);
      
      // 3. Nettoyage manuel du stockage local pour forcer une déconnexion complète
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('supabase.auth.token') || key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
      
      // Petit hack pour s'assurer que l'app est clean
      window.location.href = '#/login';
    } catch (e) {
      console.warn("Logout process had issues, force clearing state.", e);
      setUser(null);
      window.location.href = '#/login';
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
              <p className="mt-4 text-sm font-black text-gray-500 uppercase tracking-widest italic animate-pulse">Session UniConnect...</p>
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