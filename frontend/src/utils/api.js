// API Utility with CSRF Protection
// Feature #32: CSRF protection on state-changing operations

import { getCsrfHeaders } from './csrf';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Make an API request with automatic CSRF token handling
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
 * Intercept global fetch to automatically add CSRF tokens
 * Call this once at app initialization
 */
export function setupCsrfInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const method = ((init && init.method) || 'GET').toUpperCase();

    // Only intercept API calls with state-changing methods
    const isApiCall = url.includes('/api/') || url.includes('localhost:3001');
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

    if (isApiCall && needsCsrf && !skipCsrf) {
      try {
        const csrfHeaders = await getCsrfHeaders();
        const headers = new Headers(init.headers || {});

        // Add CSRF token if we have one
        Object.entries(csrfHeaders).forEach(([key, value]) => {
          headers.set(key, value);
        });

        init = {
          ...init,
          headers,
        };
      } catch (error) {
        console.warn('[CSRF Interceptor] Could not add CSRF token:', error);
      }
    }

    return originalFetch.call(window, input, init);
  };

  console.log('[CSRF] Fetch interceptor installed');
}

export default {
  apiFetch,
  setupCsrfInterceptor,
  API_BASE_URL,
};
