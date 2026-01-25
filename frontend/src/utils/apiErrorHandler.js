/**
 * API Error Handler Utilities
 * Provides helper functions to detect and handle different types of API errors
 */

/**
 * Check if an error is a server error (500)
 * @param {Error|Response|Object} error - The error to check
 * @returns {boolean} True if it's a 500 server error
 */
export function isServerError(error) {
  if (!error) return false;

  // Check status code from fetch response
  if (error.status === 500) return true;
  if (error.statusCode === 500) return true;

  // Check error message
  if (typeof error.message === 'string') {
    return error.message.includes('500') ||
      error.message.includes('Internal Server Error');
  }

  return false;
}

/**
 * Check if an error is a network error (connection failed)
 * @param {Error} error - The error to check
 * @returns {boolean} True if it's a network error
 */
export function isNetworkError(error) {
  if (!error) return false;

  // Fetch API network errors
  if (error.name === 'TypeError' && error.message?.includes('fetch')) {
    return true;
  }

  // AbortError is usually timeout
  if (error.name === 'AbortError') return true;

  // Check for common network error messages
  if (typeof error.message === 'string') {
    return error.message.includes('NetworkError') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network request failed') ||
      error.message.includes('ERR_NETWORK') ||
      error.message.includes('net::ERR_');
  }

  return false;
}

/**
 * Check if an error is a timeout error
 * @param {Error} error - The error to check
 * @returns {boolean} True if it's a timeout error
 */
export function isTimeoutError(error) {
  if (!error) return false;

  if (error.name === 'AbortError') return true;
  if (error.code === 'ECONNABORTED') return true;

  if (typeof error.message === 'string') {
    return error.message.includes('timeout') ||
      error.message.includes('Timeout') ||
      error.message.includes('ETIMEDOUT');
  }

  return false;
}

/**
 * Create a user-friendly error message based on error type
 * @param {Error|Response|Object} error - The error to format
 * @returns {Object} Formatted error with title and message
 */
export function formatApiError(error) {
  if (isServerError(error)) {
    return {
      title: 'Error del Servidor',
      message: 'Lo sentimos, ha ocurrido un error en el servidor. Por favor, intenta de nuevo mas tarde.',
      type: 'server',
      canRetry: true,
      status: 500
    };
  }

  if (isTimeoutError(error)) {
    return {
      title: 'Tiempo de espera agotado',
      message: 'La solicitud ha tardado demasiado. Por favor, verifica tu conexion e intenta de nuevo.',
      type: 'timeout',
      canRetry: true,
      status: 408
    };
  }

  if (isNetworkError(error)) {
    return {
      title: 'Error de Conexion',
      message: 'No se pudo conectar con el servidor. Por favor, verifica tu conexion a internet.',
      type: 'network',
      canRetry: true,
      status: 0
    };
  }

  // Generic error
  return {
    title: 'Error',
    message: error?.message || 'Ha ocurrido un error inesperado.',
    type: 'unknown',
    canRetry: true,
    status: error?.status || 500
  };
}

/**
 * Wrapper for fetch that handles common error scenarios
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {Object} config - Additional configuration
 * @param {number} config.timeout - Request timeout in ms (default: 30000)
 * @returns {Promise<Response>} The fetch response
 * @throws {Error} Formatted error with additional properties
 */
export async function fetchWithErrorHandling(url, options = {}, config = {}) {
  const { timeout = 30000 } = config;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Check for server errors
    if (response.status >= 500) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || 'Internal Server Error');
      error.status = response.status;
      error.statusCode = response.status;
      error.data = errorData;
      error.id = errorData.id;
      throw error;
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Add formatted error info
    const formattedError = formatApiError(error);
    error.formatted = formattedError;
    throw error;
  }
}

export default {
  isServerError,
  isNetworkError,
  isTimeoutError,
  formatApiError,
  fetchWithErrorHandling
};
