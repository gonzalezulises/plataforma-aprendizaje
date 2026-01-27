/**
 * Supabase Browser Client for React Frontend
 *
 * Provides client-side authentication using shared Supabase project.
 * Uses the same Supabase instance as rizo-web for unified auth.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient = null;

/**
 * Get or create the Supabase browser client
 * Uses cookie storage for session sync with server
 */
export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Credentials not configured. Auth will use development mode.');
    return null;
  }

  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Get current session
 */
export async function getSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[Supabase] Error getting session:', error);
    return null;
  }

  return session;
}

/**
 * Get current user
 */
export async function getUser() {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Sign in with Magic Link (email)
 * @param {string} email - User email
 * @param {string} redirectTo - URL to redirect after login
 */
export async function signInWithMagicLink(email, redirectTo) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Use /academia base path for redirect
  const baseUrl = window.location.origin + '/academia';
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo || baseUrl + '/auth/callback',
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 */
export async function signInWithPassword(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign up with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {object} metadata - Additional user metadata
 */
export async function signUp(email, password, metadata = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Use /academia base path for redirect
  const baseUrl = window.location.origin + '/academia';
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: baseUrl + '/auth/callback',
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Reset password - sends email with reset link
 * @param {string} email - User email
 */
export async function resetPassword(email) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const baseUrl = window.location.origin + '/academia';
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: baseUrl + '/auth/callback?type=recovery',
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Update user password (after reset)
 * @param {string} newPassword - New password
 */
export async function updatePassword(newPassword) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('[Supabase] Sign out error:', error);
    throw error;
  }
}

/**
 * Handle auth callback (for Magic Link)
 * Exchanges code for session
 */
export async function handleAuthCallback() {
  const supabase = getSupabaseClient();
  if (!supabase) return { session: null, error: 'Supabase not configured' };

  // Check if there's a code in the URL (PKCE flow)
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[Supabase] Code exchange error:', error);
      return { session: null, error: error.message };
    }
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return { session: data.session, error: null };
  }

  // Check for existing session
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error: error?.message || null };
}

/**
 * Subscribe to auth state changes
 * @param {function} callback - Called with (event, session)
 */
export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) return { unsubscribe: () => {} };

  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}

/**
 * Verify session with backend and sync local session
 * Called after Supabase auth to create backend session
 */
export async function verifyWithBackend() {
  console.log('[Supabase] verifyWithBackend called');
  const session = await getSession();
  console.log('[Supabase] Session for verify:', session ? 'exists' : 'null');

  if (!session?.access_token) {
    console.log('[Supabase] No access token, returning failure');
    return { success: false, error: 'No session' };
  }

  try {
    // Use VITE_API_URL to ensure correct backend URL
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    const verifyUrl = `${apiUrl}/auth/verify`;
    console.log('[Supabase] Verifying with backend at:', verifyUrl);

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      credentials: 'include',
    });

    console.log('[Supabase] Verify response status:', response.status);
    const data = await response.json();
    console.log('[Supabase] Verify response data:', data);

    if (!response.ok) {
      return { success: false, error: data.error || 'Verification failed' };
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('[Supabase] Backend verification error:', error);
    return { success: false, error: error.message };
  }
}

export default {
  getSupabaseClient,
  isSupabaseConfigured,
  getSession,
  getUser,
  signInWithMagicLink,
  signInWithPassword,
  signUp,
  signOut,
  resetPassword,
  updatePassword,
  handleAuthCallback,
  onAuthStateChange,
  verifyWithBackend,
};
