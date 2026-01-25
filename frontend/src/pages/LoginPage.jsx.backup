import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isAuthenticated, refreshAuth } = useAuth();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      const returnUrl = sessionStorage.getItem('loginReturnUrl') || '/dashboard';
      sessionStorage.removeItem('loginReturnUrl');
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Check for OAuth callback params
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const returnUrl = searchParams.get('returnUrl');

    if (errorParam) {
      setError(errorParam);
    }

    // Store return URL for after login
    if (returnUrl) {
      sessionStorage.setItem('loginReturnUrl', returnUrl);
    }
  }, [searchParams]);

  const handleLoginWithRizoMa = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get the OAuth authorization URL from the backend
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al iniciar el proceso de autenticacion');
      }

      const data = await response.json();

      if (data.authorizationUrl && !data.development) {
        // Redirect to rizo.ma OAuth authorization page
        window.location.href = data.authorizationUrl;
      } else if (data.development) {
        // Development mode - use dev-login endpoint instead
        setError(null);
        await handleDevLogin();
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Error al conectar con el servidor');
      setIsLoading(false);
    }
  };

  // Development mode login - bypasses OAuth
  const handleDevLogin = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE}/auth/dev-login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error en login de desarrollo');
      }

      const data = await response.json();

      if (data.success) {
        // Refresh auth context and redirect
        await refreshAuth();
        const returnUrl = sessionStorage.getItem('loginReturnUrl') || '/dashboard';
        sessionStorage.removeItem('loginReturnUrl');
        navigate(returnUrl, { replace: true });
      }
    } catch (err) {
      console.error('Dev login error:', err);
      setError(err.message || 'Error en login de desarrollo');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-xl mb-4">
            <svg
              className="h-10 w-10 text-white"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 12L16 8L24 12V20L16 24L8 20V12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M16 16V24"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M8 12L16 16L24 12"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Plataforma de Aprendizaje
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Inicia sesion para acceder a tus cursos
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLoginWithRizoMa}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                <span>Conectando...</span>
              </>
            ) : (
              <>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                <span>Iniciar Sesion con rizo.ma</span>
              </>
            )}
          </button>

          {/* Info text */}
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Seras redirigido a rizo.ma para autenticarte de forma segura
          </p>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
            <span className="px-4 text-sm text-gray-500 dark:text-gray-400">o</span>
            <div className="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
          </div>

          {/* Register link */}
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            No tienes una cuenta?{' '}
            <a
              href="https://rizo.ma/register"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              Registrate en rizo.ma
            </a>
          </p>
        </div>

        {/* Back to home */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
