import { useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

/**
 * Hook for network-aware form submissions
 * - Detects network errors vs server errors
 * - Shows appropriate error messages
 * - Preserves form data on failure
 * - Provides retry functionality
 * - Prevents rapid double-clicks using synchronous ref tracking
 */
export function useNetworkAwareSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState(null);
  const [lastSubmission, setLastSubmission] = useState(null);
  const retryTimeoutRef = useRef(null);
  // Use a ref to track submission state synchronously to prevent rapid double-clicks
  // React state updates are batched and async, so multiple clicks can slip through
  const isSubmittingRef = useRef(false);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Check if error is a network error
   */
  const isNetworkError = (error) => {
    // TypeError with 'Failed to fetch' is a network error
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return true;
    }
    // AbortError can happen on network issues
    if (error.name === 'AbortError') {
      return true;
    }
    // Check for common network error messages
    const networkErrorMessages = [
      'Network request failed',
      'NetworkError',
      'net::ERR_',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Failed to fetch'
    ];
    return networkErrorMessages.some(msg =>
      error.message?.includes(msg) || error.toString().includes(msg)
    );
  };

  /**
   * Submit with network error handling
   * @param {Function} submitFn - Async function that performs the submission
   * @param {Object} options - Additional options
   * @returns {Promise<{success: boolean, data?: any, error?: Error}>}
   */
  const submit = useCallback(async (submitFn, options = {}) => {
    const {
      onSuccess,
      onError,
      onNetworkError,
      preserveData, // Data to preserve for retry
      retryable = true,
    } = options;

    // CRITICAL: Check ref synchronously to prevent rapid double-clicks
    // This happens BEFORE any async operations
    if (isSubmittingRef.current) {
      console.log('[useNetworkAwareSubmit] Blocked duplicate submission - already submitting');
      return { success: false, error: new Error('Already submitting'), isDuplicate: true };
    }

    // Set ref immediately (synchronous) to block subsequent rapid clicks
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setNetworkError(null);

    // Store submission for retry
    if (preserveData) {
      setLastSubmission({
        submitFn,
        options,
        timestamp: Date.now(),
      });
    }

    try {
      const result = await submitFn();
      setLastSubmission(null);
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      if (onSuccess) {
        onSuccess(result);
      }

      return { success: true, data: result };
    } catch (error) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      if (isNetworkError(error)) {
        const networkErrorInfo = {
          type: 'network',
          message: 'No se pudo conectar con el servidor. Verifica tu conexion a internet.',
          canRetry: retryable,
          timestamp: Date.now(),
        };

        setNetworkError(networkErrorInfo);

        toast.error(
          'Error de conexion. Tus datos no se han perdido. Intenta de nuevo.',
          { duration: 5000, id: 'network-error' }
        );

        if (onNetworkError) {
          onNetworkError(error);
        }

        return { success: false, error, isNetworkError: true };
      } else {
        // Server error or other error
        setLastSubmission(null);

        if (onError) {
          onError(error);
        }

        return { success: false, error, isNetworkError: false };
      }
    }
  }, []);

  /**
   * Retry the last failed submission
   */
  const retry = useCallback(async () => {
    if (!lastSubmission) {
      console.warn('No submission to retry');
      return { success: false, error: new Error('No submission to retry') };
    }

    // Reset the ref to allow retry
    isSubmittingRef.current = false;

    toast.loading('Reintentando...', { id: 'retry-toast' });

    const result = await submit(lastSubmission.submitFn, lastSubmission.options);

    toast.dismiss('retry-toast');

    if (result.success) {
      toast.success('Enviado exitosamente', { id: 'retry-success' });
    }

    return result;
  }, [lastSubmission, submit]);

  /**
   * Clear the network error state
   */
  const clearError = useCallback(() => {
    setNetworkError(null);
    setLastSubmission(null);
  }, []);

  /**
   * Check if there's a pending retry
   */
  const hasPendingRetry = !!lastSubmission && !!networkError;

  return {
    isSubmitting,
    networkError,
    hasPendingRetry,
    submit,
    retry,
    clearError,
  };
}

export default useNetworkAwareSubmit;
