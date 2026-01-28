/**
 * Supabase Server Client for Express Backend
 *
 * Provides server-side authentication verification using shared Supabase project.
 * Uses the same Supabase instance as rizo-web for unified auth.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.warn('[Supabase] SUPABASE_URL not configured. Auth will not work.');
}

/**
 * Create Supabase admin client with service role key
 * Use for server-side operations that need elevated privileges
 */
export function createSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase admin credentials not configured');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create Supabase client with anon key
 * Use for operations that should respect RLS policies
 */
export function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Verify a Supabase JWT token and return the user
 * @param {string} token - The JWT token from the Authorization header
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function verifySupabaseToken(token) {
  if (!token) {
    return { user: null, error: 'No token provided' };
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error('[Supabase] Token verification error:', error.message);
      return { user: null, error: error.message };
    }

    return { user, error: null };
  } catch (err) {
    console.error('[Supabase] Token verification failed:', err);
    return { user: null, error: 'Token verification failed' };
  }
}

/**
 * Get user by email from Supabase
 * @param {string} email - User email
 * @returns {Promise<object|null>}
 */
export async function getUserByEmail(email) {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('[Supabase] Error listing users:', error.message);
      return null;
    }

    const user = data.users.find(u => u.email === email);
    return user || null;
  } catch (err) {
    console.error('[Supabase] getUserByEmail failed:', err);
    return null;
  }
}

/**
 * Extract bearer token from Authorization header
 * @param {string} authHeader - The Authorization header value
 * @returns {string|null}
 */
export function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Get user profile from Supabase profiles table
 * @param {string} userId - The Supabase user UUID
 * @returns {Promise<{profile: object|null, error: string|null}>}
 */
export async function getSupabaseProfile(userId) {
  if (!userId) {
    return { profile: null, error: 'No user ID provided' };
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Supabase] Profile fetch error:', error.message);
      return { profile: null, error: error.message };
    }

    console.log('[Supabase] Profile fetched:', data);
    return { profile: data, error: null };
  } catch (err) {
    console.error('[Supabase] getSupabaseProfile failed:', err);
    return { profile: null, error: 'Profile fetch failed' };
  }
}

export default {
  createSupabaseAdmin,
  createSupabaseClient,
  verifySupabaseToken,
  getUserByEmail,
  extractBearerToken,
  getSupabaseProfile,
};
