import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServerErrorBanner } from '../components/ServerErrorBanner';
import { isServerError, formatApiError } from '../utils/apiErrorHandler';

/**
 * ErrorTestPage - A test page for verifying 500 error handling (DEV ONLY)
 * This page allows testing the server error display without needing actual server failures
 */
export default function ErrorTestPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [result, setResult] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  // Test triggering a real 500 error from the backend
  const triggerServerError = async () => {
    setIsLoading(true);
    setServerError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/test/error-500`, {
        credentials: 'include'
      });

      if (response.status >= 500) {
        const errorData = await response.json().catch(() => ({}));
        const formattedError = formatApiError({
          status: response.status,
          message: errorData.message,
          id: errorData.id
        });
        setServerError(formattedError);
        setResult({
          success: false,
          status: response.status,
          message: 'Server returned 500 error',
          responseData: errorData
        });
      } else {
        setResult({
          success: true,
          status: response.status,
          message: 'Request succeeded (unexpected)'
        });
      }
    } catch (err) {
      console.error('Error triggering 500:', err);
      if (isServerError(err)) {
        setServerError(formatApiError(err));
      } else {
        setResult({
          success: false,
          message: err.message,
          error: err
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Retry after error
  const handleRetry = async () => {
    setIsRetrying(true);

    // Simulate a successful retry after waiting
    await new Promise(resolve => setTimeout(resolve, 1500));

    setServerError(null);
    setIsRetrying(false);
    setResult({
      success: true,
      message: 'Retry successful! (simulated)'
    });
  };

  // Dismiss error and go home
  const handleDismiss = () => {
    setServerError(null);
    setResult(null);
  };

  // Navigate to full-page error
  const goToServerErrorPage = () => {
    navigate('/server-error', {
      state: {
        from: '/test-error',
        error: { message: 'Test server error' }
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Test de Errores del Servidor
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Prueba la visualizacion de errores 500 del servidor
            </p>
          </div>

          {/* Server Error Banner (if error occurred) */}
          {serverError && (
            <div className="mb-8">
              <ServerErrorBanner
                error={serverError}
                onRetry={handleRetry}
                onDismiss={handleDismiss}
                isRetrying={isRetrying}
              />
            </div>
          )}

          {/* Result Display */}
          {result && !serverError && (
            <div
              className={`mb-8 p-4 rounded-lg ${
                result.success
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
              }`}
            >
              <h3
                className={`font-semibold mb-2 ${
                  result.success
                    ? 'text-green-800 dark:text-green-300'
                    : 'text-yellow-800 dark:text-yellow-300'
                }`}
              >
                {result.success ? '✓ Exito' : '⚠ Resultado'}
              </h3>
              <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          {/* Test Buttons */}
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                1. Error de API (Banner)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Llama al endpoint /api/test/error-500 y muestra el error en un banner.
              </p>
              <button
                onClick={triggerServerError}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="w-5 h-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Probando...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                      />
                    </svg>
                    Simular Error 500
                  </>
                )}
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                2. Pagina de Error Completa
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Navega a la pagina de error 500 completa para ver el diseno full-page.
              </p>
              <button
                onClick={goToServerErrorPage}
                className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                Ver Pagina de Error 500
              </button>
            </div>
          </div>

          {/* Info Note */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-500 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-semibold">Nota de Desarrollo</p>
                <p className="mt-1">
                  Esta pagina solo esta disponible en modo desarrollo. El endpoint
                  /api/test/error-500 no existe en produccion.
                </p>
              </div>
            </div>
          </div>

          {/* Back Link */}
          <div className="mt-8 text-center">
            <button
              onClick={() => navigate(-1)}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
