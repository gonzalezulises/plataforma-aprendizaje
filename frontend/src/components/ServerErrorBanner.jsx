import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ServerErrorBanner - Displays a user-friendly banner when a 500 server error occurs
 * Shows retry option and navigation to home without exposing stack traces
 */
export function ServerErrorBanner({
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
  className = '',
}) {
  const navigate = useNavigate();

  if (!error) {
    return null;
  }

  // Determine if it's a server error (500)
  const isServerError = error.status === 500 || error.statusCode === 500 ||
    error.message?.includes('500') || error.message?.includes('Internal Server Error');

  return (
    <div
      className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-col items-center text-center">
        {/* Error Icon - Server Error */}
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
        </div>

        {/* Error Title */}
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
          Error del Servidor
        </h3>

        {/* User-friendly message - no technical details */}
        <p className="text-sm text-red-700 dark:text-red-400 mb-4 max-w-md">
          Lo sentimos, ha ocurrido un error en el servidor. Nuestro equipo ha sido notificado
          y estamos trabajando para solucionarlo.
        </p>

        {/* Helpful suggestions */}
        <div className="text-xs text-red-600 dark:text-red-500 mb-6">
          <p>¿Que puedes hacer?</p>
          <ul className="list-disc list-inside mt-2 text-left inline-block">
            <li>Intentar de nuevo en unos momentos</li>
            <li>Refrescar la pagina</li>
            <li>Volver a la pagina principal</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {isRetrying ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
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
                  Reintentando...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Reintentar
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Ir al Inicio
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>

        {/* Error Reference ID (safe to show, helps support) */}
        {error.id && (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-500">
            Referencia: {error.id}
          </p>
        )}
      </div>
    </div>
  );
}

export default ServerErrorBanner;
