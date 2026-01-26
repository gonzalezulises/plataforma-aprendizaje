// CSRF Token Utility
// Feature #32: CSRF protection on state-changing operations

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Cache for CSRF token
let csrfToken = null;
let csrfHeaderName = 'X-CSRF-Token';
let tokenFetchPromise = null;

/**
 * Fetch CSRF token from the server
 * @returns {Promise<string>} The CSRF token
 */
export async function fetchCsrfToken() {
  // If already fetching, return existing promise to avoid multiple requests
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }

  tokenFetchPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/csrf-token`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        // User not authenticated - that's okay, just return null
        if (response.status === 401) {
          csrfToken = null;
          return null;
        }
        throw new Error('Failed to fetch CSRF token');
      }

      const data = await response.json();
      csrfToken = data.csrfToken;
      csrfHeaderName = data.headerName || 'X-CSRF-Token';
      return csrfToken;
    } catch (error) {
      console.error('[CSRF] Error fetching token:', error);
      return null;
    } finally {
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}

/**
 * Get the cached CSRF token, fetching if needed
 * @returns {Promise<string|null>} The CSRF token or null
 */
export async function getCsrfToken() {
  if (csrfToken) {
    return csrfToken;
  }
  return fetchCsrfToken();
}

/**
 * Clear the cached CSRF token (e.g., on logout)
 */
export function clearCsrfToken() {
  csrfToken = null;
}

/**
 * Get CSRF headers for a fetch request
 * @returns {Promise<Object>} Headers object with CSRF token
 */
export async function getCsrfHeaders() {
  const token = await getCsrfToken();
  if (!token) {
    return {};
  }
  return { [csrfHeaderName]: token };
}

/**
 * Make an authenticated fetch request with CSRF token
 * Automatically includes CSRF token for non-GET requests
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} The fetch response
 */
export async function csrfFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  // Only add CSRF token for state-changing methods
  const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  const headers = {
    ...options.headers,
  };

  if (needsCsrf) {
    const csrfHeaders = await getCsrfHeaders();
    Object.assign(headers, csrfHeaders);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  });
}

export default {
  fetchCsrfToken,
  getCsrfToken,
  clearCsrfToken,
  getCsrfHeaders,
  csrfFetch,
};
