// API Utility with CSRF Protection and Supabase Auth
// Feature #32: CSRF protection on state-changing operations
// Cross-domain auth: Includes Supabase token in Authorization header

import { getCsrfHeaders } from './csrf';
import { getSession as getSupabaseSession, isSupabaseConfigured } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Get Authorization header with Supabase token if available
 */
async function getAuthHeaders() {
  console.log('[API] getAuthHeaders called, Supabase configured:', isSupabaseConfigured());

  if (!isSupabaseConfigured()) {
    console.log('[API] Supabase not configured, skipping auth header');
    return {};
  }

  try {
    const session = await getSupabaseSession();
    console.log('[API] Supabase session:', session ? 'exists' : 'null', session?.user?.email);
    if (session?.access_token) {
      console.log('[API] Adding Authorization header with token');
      return { 'Authorization': `Bearer ${session.access_token}` };
    }
  } catch (error) {
    console.warn('[API] Could not get Supabase token:', error);
  }

  console.log('[API] No token available');
  return {};
}

/**
 * Make an API request with automatic CSRF token and auth handling
 * @param {string} endpoint - API endpoint (relative to base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} The fetch response
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  // Only add CSRF token for state-changing methods
  const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  const headers = {
    ...(options.headers || {}),
  };

  // Add Supabase auth header for cross-domain requests
  try {
    const authHeaders = await getAuthHeaders();
    Object.assign(headers, authHeaders);
  } catch (error) {
    console.warn('[API] Could not get auth header:', error);
  }

  if (needsCsrf) {
    try {
      const csrfHeaders = await getCsrfHeaders();
      Object.assign(headers, csrfHeaders);
    } catch (error) {
      console.warn('[API] Could not get CSRF token:', error);
    }
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  });
}

/**
 * Intercept global fetch to automatically add CSRF tokens and Supabase auth
 * Call this once at app initialization
 */
export function setupCsrfInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const method = ((init && init.method) || 'GET').toUpperCase();

    // Only intercept API calls
    const isApiCall = url.includes('/api/') || url.includes('localhost:3001') || url.includes('railway.app');
    const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

    // Skip CSRF for auth endpoints (they establish the session)
    const skipCsrf = [
      '/api/auth/dev-login',
      '/api/auth/logout',
      '/api/auth/callback',
      '/api/direct-auth/login',
      '/api/direct-auth/register',
      '/api/direct-auth/forgot-password',
      '/api/direct-auth/reset-password',
      '/api/test/'
    ].some(path => url.includes(path));

    if (isApiCall) {
      console.log('[API Interceptor] Intercepting API call:', url);
      const headers = new Headers(init.headers || {});

      // Add Supabase Authorization header for cross-domain auth
      // Skip if request already has Authorization header (to avoid deadlock)
      if (!headers.has('Authorization')) {
        try {
          const authHeaders = await getAuthHeaders();
          console.log('[API Interceptor] Auth headers to add:', Object.keys(authHeaders));
          Object.entries(authHeaders).forEach(([key, value]) => {
            headers.set(key, value);
            console.log('[API Interceptor] Added header:', key);
          });
        } catch (error) {
          console.warn('[API Interceptor] Could not add auth header:', error);
        }
      } else {
        console.log('[API Interceptor] Skipping auth - request already has Authorization header');
      }

      // Add CSRF token for state-changing methods
      if (needsCsrf && !skipCsrf) {
        try {
          const csrfHeaders = await getCsrfHeaders();
          Object.entries(csrfHeaders).forEach(([key, value]) => {
            headers.set(key, value);
          });
        } catch (error) {
          console.warn('[CSRF Interceptor] Could not add CSRF token:', error);
        }
      }

      init = {
        ...init,
        headers,
      };
    }

    return originalFetch.call(window, input, init);
  };

  console.log('[API] Fetch interceptor installed (CSRF + Auth)');
}

export default {
  apiFetch,
  setupCsrfInterceptor,
  API_BASE_URL,
};
// Build: 1769557465
