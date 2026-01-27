import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchCsrfToken, clearCsrfToken } from '../utils/csrf';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  onAuthStateChange,
  signOut as supabaseSignOut,
  verifyWithBackend,
} from '../lib/supabase';

const AuthContext = createContext(null);

// Use env variable for API URL - remove /api suffix since we add it below
const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [supabaseSession, setSupabaseSession] = useState(null);

  // Fetch current user from the backend session
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isAuthenticated && data.user) {
          setUser(data.user);
          setIsAuthenticated(true);
          // Feature #32: Fetch CSRF token when authenticated
          fetchCsrfToken();
          return data.user;
        }
      }

      // Not authenticated via session
      setUser(null);
      setIsAuthenticated(false);
      return null;
    } catch (error) {
      console.error('Error fetching current user:', error);
      setUser(null);
      setIsAuthenticated(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verify Supabase session with backend and create local session
  const verifySupabaseSession = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const result = await verifyWithBackend();
      if (result.success && result.user) {
        setUser(result.user);
        setIsAuthenticated(true);
        fetchCsrfToken();
        return result.user;
      }
      return null;
    } catch (error) {
      console.error('Error verifying Supabase session:', error);
      return null;
    }
  }, []);

  // Initialize auth - check backend session first, then Supabase
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      // First check if we have a backend session
      const backendUser = await fetchCurrentUser();

      if (backendUser) {
        setIsLoading(false);
        return;
      }

      // If no backend session and Supabase is configured, check Supabase
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setSupabaseSession(session);
            // Verify with backend to create session
            await verifySupabaseSession();
          }
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, [fetchCurrentUser, verifySupabaseSession]);

  // Listen for Supabase auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const subscription = onAuthStateChange(async (event, session) => {
      console.log('[Auth] Supabase auth event:', event);
      setSupabaseSession(session);

      if (event === 'SIGNED_IN' && session) {
        // Verify with backend to create session
        await verifySupabaseSession();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        clearCsrfToken();
      }
    });

    return () => {
      subscription?.unsubscribe?.();
    };
  }, [verifySupabaseSession]);

  // Logout function - handles both Supabase and session logout
  const logout = useCallback(async () => {
    try {
      // Logout from backend session
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      // Also logout from Supabase if configured
      if (isSupabaseConfigured()) {
        await supabaseSignOut();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setSupabaseSession(null);
      clearCsrfToken();
    }
  }, []);

  // Login - refreshes user data after OAuth/Supabase callback
  const refreshAuth = useCallback(async () => {
    setIsLoading(true);

    // First try backend session
    const backendUser = await fetchCurrentUser();
    if (backendUser) {
      return backendUser;
    }

    // If Supabase session exists, verify with backend
    if (isSupabaseConfigured() && supabaseSession) {
      const supabaseUser = await verifySupabaseSession();
      if (supabaseUser) {
        setIsLoading(false);
        return supabaseUser;
      }
    }

    setIsLoading(false);
    return null;
  }, [fetchCurrentUser, verifySupabaseSession, supabaseSession]);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    logout,
    refreshAuth,
    supabaseSession,
    isSupabaseConfigured: isSupabaseConfigured(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
