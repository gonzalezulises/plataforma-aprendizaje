import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isAuthenticated, refreshAuth } = useAuth();

  // Direct login form state
  const [showDirectLogin, setShowDirectLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');

  // Email validation regex
  const isValidEmail = (emailToValidate) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailToValidate);
  };

  // Handle email field change with validation
  const handleEmailChange = (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    // Clear error when user starts typing
    if (emailError) {
      setEmailError('');
    }
  };

  // Validate email on blur
  const handleEmailBlur = () => {
    if (email && !isValidEmail(email)) {
      setEmailError('Formato de correo electronico invalido');
    }
  };

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      const returnUrl = sessionStorage.getItem('loginReturnUrl') || '/dashboard';
      sessionStorage.removeItem('loginReturnUrl');
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Check for OAuth callback params and location state (Feature #55)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const returnUrlFromParams = searchParams.get('returnUrl');
    // Also check React Router location state (used by protected routes like DashboardPage)
    const returnUrlFromState = location.state?.from;

    if (errorParam) {
      setError(errorParam);
    }

    // Store return URL for after login (prefer params over state)
    const returnUrl = returnUrlFromParams || returnUrlFromState;
    if (returnUrl) {
      sessionStorage.setItem('loginReturnUrl', returnUrl);
    }
  }, [searchParams, location.state]);

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

  // Direct email/password login
  const handleDirectLogin = async (e) => {
    e.preventDefault();

    // Validate email format before submitting
    if (!isValidEmail(email)) {
      setEmailError('Formato de correo electronico invalido');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE}/direct-auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Display error message from server
        setError(data.error || 'Error al iniciar sesion');
        setIsLoading(false);
        return;
      }

      // Login successful - refresh auth context and redirect
      await refreshAuth();
      const returnUrl = sessionStorage.getItem('loginReturnUrl') || '/dashboard';
      sessionStorage.removeItem('loginReturnUrl');
      navigate(returnUrl, { replace: true });
    } catch (err) {
      console.error('Direct login error:', err);
      setError('Error al conectar con el servidor. Intenta de nuevo.');
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
          {/* Error Message - Screen reader accessible */}
          {error && (
            <div
              className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3"
              role="alert"
              aria-live="assertive"
            >
              <svg className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {!showDirectLogin ? (
            <>
              {/* OAuth Login Button */}
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

              {/* Direct login toggle button */}
              <button
                onClick={() => setShowDirectLogin(true)}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Iniciar sesion con email</span>
              </button>
            </>
          ) : (
            <>
              {/* Direct Login Form */}
              <form onSubmit={handleDirectLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Correo electronico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    placeholder="tu@email.com"
                    required
                    disabled={isLoading}
                    aria-invalid={emailError ? 'true' : 'false'}
                    aria-describedby={emailError ? 'email-error' : undefined}
                    className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                      emailError
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {emailError && (
                    <p
                      id="email-error"
                      className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1"
                      role="alert"
                      aria-live="polite"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {emailError}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contrasena <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contrasena"
                    required
                    disabled={isLoading}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || emailError}
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
                      <span>Iniciando sesion...</span>
                    </>
                  ) : (
                    <span>Iniciar sesion</span>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
                <span className="px-4 text-sm text-gray-500 dark:text-gray-400">o</span>
                <div className="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
              </div>

              {/* Back to OAuth button */}
              <button
                onClick={() => {
                  setShowDirectLogin(false);
                  setError(null);
                  setEmailError('');
                }}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Volver a opciones de login</span>
              </button>
            </>
          )}

          {/* Register link */}
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
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
