import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { handleAuthCallback as handleSupabaseCallback, isSupabaseConfigured } from '../lib/supabase';

/**
 * AuthCallback component handles authentication callbacks
 * Supports both:
 * 1. Traditional OAuth callback from backend
 * 2. Supabase Magic Link callback (code in URL)
 */
function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshAuth, isAuthenticated } = useAuth();
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      // Check for error parameter
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      if (errorParam) {
        setError(errorDescription || errorParam);
        setIsProcessing(false);
        return;
      }

      try {
        // Check if this is a Supabase auth callback (has code parameter)
        const code = searchParams.get('code');

        if (code && isSupabaseConfigured()) {
          // Handle Supabase PKCE callback
          console.log('[AuthCallback] Processing Supabase code exchange');
          const { session, error: supabaseError } = await handleSupabaseCallback();

          if (supabaseError) {
            setError(supabaseError);
            setIsProcessing(false);
            return;
          }

          if (session) {
            // Supabase auth successful - refresh context
            const user = await refreshAuth();
            if (user) {
              redirectToDestination();
              return;
            }
          }
        }

        // Try refreshing auth from backend session (traditional OAuth flow)
        const user = await refreshAuth();

        if (user) {
          redirectToDestination();
        } else {
          // No user data - something went wrong
          setError('No se pudo obtener la informacion del usuario');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Error al procesar la autenticacion');
        setIsProcessing(false);
      }
    };

    const redirectToDestination = () => {
      const returnUrl = sessionStorage.getItem('loginReturnUrl') || '/dashboard';
      sessionStorage.removeItem('loginReturnUrl');

      // Small delay to show success message
      setTimeout(() => {
        navigate(returnUrl, { replace: true });
      }, 1000);
    };

    processCallback();
  }, [searchParams, refreshAuth, navigate]);

  // Already authenticated and processing - show success
  if (isAuthenticated && isProcessing) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
            <svg
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Autenticacion Exitosa
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Redirigiendo al dashboard...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full mb-4">
            <svg
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Error de Autenticacion
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }

  // Loading/processing state
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
          <svg
            className="animate-spin h-10 w-10 text-primary-600"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Procesando Autenticacion
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Por favor espera mientras verificamos tu sesion...
        </p>
      </div>
    </div>
  );
}

export default AuthCallback;
