import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { signInWithMagicLink, isSupabaseConfigured } from '../lib/supabase';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const { isAuthenticated, refreshAuth, isSupabaseConfigured: supabaseReady } = useAuth();

  // Login method state: 'magic-link' | 'password' | 'dev'
  const [loginMethod, setLoginMethod] = useState('magic-link');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  // Email validation regex
  const isValidEmail = (emailToValidate) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailToValidate);
  };

  // Handle email field change with validation
  const handleEmailChange = (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
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

  // Track if we've initiated a login attempt
  const [loginInitiated, setLoginInitiated] = useState(false);

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated && !loginInitiated) {
      const returnUrl = sessionStorage.getItem('loginReturnUrl') || '/dashboard';
      sessionStorage.removeItem('loginReturnUrl');
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, loginInitiated, navigate]);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitInfo && rateLimitInfo.remainingSeconds > 0) {
      const timer = setInterval(() => {
        setRateLimitInfo(prev => {
          if (!prev || prev.remainingSeconds <= 1) {
            clearInterval(timer);
            return null;
          }
          return {
            ...prev,
            remainingSeconds: prev.remainingSeconds - 1
          };
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimitInfo?.remainingSeconds > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for callback params and location state
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const returnUrlFromParams = searchParams.get('returnUrl');
    const returnUrlFromState = location.state?.from;

    if (errorParam) {
      setError(errorParam);
    }

    const returnUrl = returnUrlFromParams || returnUrlFromState;
    if (returnUrl) {
      sessionStorage.setItem('loginReturnUrl', returnUrl);
    }
  }, [searchParams, location.state]);

  // Handle Magic Link login
  const handleMagicLinkLogin = async (e) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setEmailError('Formato de correo electronico invalido');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setLoginInitiated(true);

    try {
      const redirectTo = window.location.origin + '/auth/callback';
      await signInWithMagicLink(email, redirectTo);

      setSuccessMessage(
        'Te hemos enviado un enlace magico a tu correo. ' +
        'Revisa tu bandeja de entrada y haz clic en el enlace para iniciar sesion.'
      );
      setIsLoading(false);
    } catch (err) {
      console.error('Magic link error:', err);
      setError(err.message || 'Error al enviar el enlace magico');
      setIsLoading(false);
    }
  };

  // Development mode login
  const handleDevLogin = async () => {
    setIsLoading(true);
    setError(null);
    setLoginInitiated(true);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
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

    if (!isValidEmail(email)) {
      setEmailError('Formato de correo electronico invalido');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoginInitiated(true);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
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
        if (response.status === 429 && data.rateLimited) {
          setRateLimitInfo({
            remainingSeconds: data.retryAfter || 60,
            message: data.error
          });
        } else {
          setError(data.error || 'Error al iniciar sesion');
        }
        setIsLoading(false);
        return;
      }

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
              <path d="M16 16V24" stroke="currentColor" strokeWidth="2" />
              <path d="M8 12L16 16L24 12" stroke="currentColor" strokeWidth="2" />
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
          {/* Success Message */}
          {successMessage && (
            <div
              className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3"
              role="alert"
            >
              <svg className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Enlace enviado
                </p>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  {successMessage}
                </p>
              </div>
            </div>
          )}

          {/* Rate Limit Warning */}
          {rateLimitInfo && (
            <div
              className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-3"
              role="alert"
            >
              <svg className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                  Demasiados intentos
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                  Espera <span className="font-bold">{rateLimitInfo.remainingSeconds}</span> segundos.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !rateLimitInfo && (
            <div
              className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3"
              role="alert"
            >
              <svg className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Login Method Tabs */}
          <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
            {isSupabaseConfigured() && (
              <button
                onClick={() => { setLoginMethod('magic-link'); setError(null); setSuccessMessage(null); }}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  loginMethod === 'magic-link'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Magic Link
              </button>
            )}
            <button
              onClick={() => { setLoginMethod('password'); setError(null); setSuccessMessage(null); }}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                loginMethod === 'password'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Email y Contrasena
            </button>
          </div>

          {/* Magic Link Form */}
          {loginMethod === 'magic-link' && isSupabaseConfigured() && (
            <form onSubmit={handleMagicLinkLogin} className="space-y-4">
              <div>
                <label htmlFor="magic-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Correo electronico
                </label>
                <input
                  type="email"
                  id="magic-email"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  placeholder="tu@email.com"
                  required
                  disabled={isLoading}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 ${
                    emailError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {emailError && (
                  <p className="mt-1 text-sm text-red-500">{emailError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !!successMessage}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Enviar enlace magico</span>
                  </>
                )}
              </button>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                Te enviaremos un enlace a tu correo para iniciar sesion sin contrasena
              </p>
            </form>
          )}

          {/* Password Form */}
          {loginMethod === 'password' && (
            <form onSubmit={handleDirectLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Correo electronico
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  placeholder="tu@email.com"
                  required
                  disabled={isLoading}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 ${
                    emailError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {emailError && (
                  <p className="mt-1 text-sm text-red-500">{emailError}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contrasena
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contrasena"
                  required
                  disabled={isLoading}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || emailError || rateLimitInfo}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Iniciando sesion...</span>
                  </>
                ) : (
                  <span>Iniciar sesion</span>
                )}
              </button>
            </form>
          )}

          {/* Development Login (only in dev mode) */}
          {process.env.NODE_ENV !== 'production' && (
            <>
              <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
                <span className="px-4 text-sm text-gray-500 dark:text-gray-400">o</span>
                <div className="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
              </div>

              <button
                onClick={handleDevLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span>Login de Desarrollo</span>
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
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
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
