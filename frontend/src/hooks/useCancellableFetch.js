/**
 * Custom hook for cancellable data fetching
 * Automatically cancels pending requests when the component unmounts or dependencies change.
 * This prevents race conditions where slow responses override newer data.
 *
 * Usage:
 *   const { data, loading, error, refetch, requestId } = useCancellableFetch(
 *     '/api/courses',
 *     [slug],
 *     { includeCredentials: true }
 *   );
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Hook for fetching data with automatic request cancellation
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Array} deps - Dependencies array for refetching
 * @param {Object} options - Additional options
 * @param {boolean} options.includeCredentials - Whether to include cookies (default: true)
 * @param {boolean} options.enabled - Whether to fetch (default: true)
 * @param {function} options.transformResponse - Optional transform function for response data
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
 */
export function useCancellableFetch(endpoint, deps = [], options = {}) {
  const {
    includeCredentials = true,
    enabled = true,
    transformResponse = (data) => data,
    timeout = 30000
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(0);

  // Use refs to track the current request and avoid stale closures
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async (signal) => {
    const currentRequestId = ++requestIdRef.current;
    setRequestId(currentRequestId);

    console.log(`[useCancellableFetch] Starting request #${currentRequestId} for ${endpoint}`);

    try {
      setLoading(true);
      setError(null);

      const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout'));
        }, timeout);
      });

      // Create fetch promise
      const fetchPromise = fetch(url, {
        credentials: includeCredentials ? 'include' : 'same-origin',
        signal
      });

      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      // Check if this request is still the current one
      if (currentRequestId !== requestIdRef.current) {
        console.log(`[useCancellableFetch] Request #${currentRequestId} superseded by #${requestIdRef.current}, ignoring response`);
        return; // Response is stale, don't update state
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      const responseData = await response.json();

      // Double-check again after parsing JSON
      if (currentRequestId !== requestIdRef.current) {
        console.log(`[useCancellableFetch] Request #${currentRequestId} superseded during JSON parse, ignoring`);
        return;
      }

      const transformed = transformResponse(responseData);
      setData(transformed);
      console.log(`[useCancellableFetch] Request #${currentRequestId} completed successfully`);

    } catch (err) {
      // Don't update state if the request was aborted
      if (err.name === 'AbortError') {
        console.log(`[useCancellableFetch] Request #${currentRequestId} was aborted (navigation)`);
        return;
      }

      // Check if this is still the current request before setting error
      if (currentRequestId !== requestIdRef.current) {
        console.log(`[useCancellableFetch] Request #${currentRequestId} superseded during error handling`);
        return;
      }

      console.error(`[useCancellableFetch] Request #${currentRequestId} failed:`, err.message);
      setError(err);
    } finally {
      // Only update loading state if this is still the current request
      if (requestIdRef.current === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [endpoint, includeCredentials, timeout, transformResponse]);

  const refetch = useCallback(() => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    fetchData(abortControllerRef.current.signal);
  }, [fetchData]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      console.log('[useCancellableFetch] Aborting previous request due to dependency change');
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    fetchData(abortControllerRef.current.signal);

    // Cleanup function - abort on unmount or dependency change
    return () => {
      if (abortControllerRef.current) {
        console.log('[useCancellableFetch] Aborting request due to cleanup (unmount or deps change)');
        abortControllerRef.current.abort();
      }
    };
  }, [...deps, enabled]);

  return { data, loading, error, refetch, requestId };
}

/**
 * Helper function for making a single cancellable fetch request
 * @param {string} url - Full URL or endpoint
 * @param {Object} options - Fetch options
 * @param {AbortController} abortController - Optional abort controller
 * @returns {Promise} Fetch promise
 */
export async function cancellableFetch(url, options = {}, abortController = null) {
  const controller = abortController || new AbortController();
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    signal: controller.signal
  });

  return response;
}

export default useCancellableFetch;
