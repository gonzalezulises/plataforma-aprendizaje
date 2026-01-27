import express from 'express';
import { logAuditEvent, AUDIT_EVENTS } from '../utils/auditLogger.js';
import { verifySupabaseToken, extractBearerToken } from '../lib/supabase.js';

// Feature #144 - Added userId parameter to dev-login for enrollment testing
// Feature #40: Sensitive operations log audit trail
// Migration: Now using shared Supabase auth instead of custom OAuth

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SUPABASE_URL = process.env.SUPABASE_URL;

/**
 * GET /api/auth/login
 * Returns Supabase auth configuration for frontend to initiate login
 * Frontend uses Supabase Auth UI or redirects to Magic Link
 */
router.get('/login', (req, res) => {
  const returnUrl = req.query.returnUrl || '/dashboard';

  // Store return URL in session for after auth
  req.session.returnUrl = returnUrl;

  console.log('[Auth] Login initiated');
  console.log('[Auth] Return URL:', returnUrl);

  // Check if Supabase is configured
  if (!SUPABASE_URL) {
    console.log('[Auth] Supabase not configured - development mode');
    return res.json({
      message: 'Auth en modo desarrollo. Usa /api/auth/dev-login para testing.',
      development: true,
      supabaseConfigured: false,
      info: {
        description: 'Para configurar Supabase, actualiza las variables de entorno en .env',
        requiredVars: [
          'SUPABASE_URL',
          'SUPABASE_ANON_KEY',
          'SUPABASE_SERVICE_KEY',
        ],
      },
    });
  }

  // Return Supabase config for frontend to use
  res.json({
    supabaseUrl: SUPABASE_URL,
    returnUrl,
    message: 'Usa Supabase Auth para iniciar sesion',
    supabaseConfigured: true,
  });
});

/**
 * POST /api/auth/verify
 * Verifies a Supabase JWT token and creates/updates local session
 * Called by frontend after successful Supabase authentication
 */
router.post('/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = extractBearerToken(authHeader);

  if (!token) {
    return res.status(401).json({
      error: 'No se proporcionó token de autenticación',
      isAuthenticated: false,
    });
  }

  try {
    const { user, error } = await verifySupabaseToken(token);

    if (error || !user) {
      console.error('[Auth] Token verification failed:', error);
      return res.status(401).json({
        error: error || 'Token inválido',
        isAuthenticated: false,
      });
    }

    // Create local session with Supabase user info
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
      role: user.user_metadata?.role || 'student_free',
      supabaseId: user.id,
      avatar: user.user_metadata?.avatar_url,
    };

    req.session.isAuthenticated = true;
    req.session.lastActivity = Date.now();
    req.session.supabaseToken = token;

    console.log('[Auth] Supabase token verified, user:', req.session.user.email);

    // Feature #40: Log audit event for successful login
    logAuditEvent(user.id, AUDIT_EVENTS.LOGIN_SUCCESS, {
      action: 'User logged in via Supabase',
      email: user.email,
      role: req.session.user.role,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    });

    res.json({
      success: true,
      isAuthenticated: true,
      user: req.session.user,
    });
  } catch (err) {
    console.error('[Auth] Verification error:', err);
    res.status(500).json({
      error: 'Error durante la verificación',
      isAuthenticated: false,
    });
  }
});

/**
 * GET /api/auth/callback
 * Handles redirect from Supabase auth (Magic Link, OAuth providers)
 * Stores session and redirects to frontend
 */
router.get('/callback', async (req, res) => {
  const { access_token, refresh_token, error, error_description } = req.query;

  // Handle auth errors
  if (error) {
    console.error('[Auth] Supabase callback error:', error, error_description);
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error_description || error)}`);
  }

  // If no token, redirect to frontend to handle the hash fragment
  // (Supabase puts tokens in URL hash, not query params for Magic Link)
  if (!access_token) {
    console.log('[Auth] No access_token in query, redirecting to frontend callback');
    return res.redirect(`${FRONTEND_URL}/auth/callback`);
  }

  try {
    const { user, error: verifyError } = await verifySupabaseToken(access_token);

    if (verifyError || !user) {
      console.error('[Auth] Token verification failed:', verifyError);
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Token de autenticación inválido')}`);
    }

    // Create local session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
      role: user.user_metadata?.role || 'student_free',
      supabaseId: user.id,
    };

    req.session.isAuthenticated = true;
    req.session.lastActivity = Date.now();
    req.session.supabaseToken = access_token;
    if (refresh_token) {
      req.session.supabaseRefreshToken = refresh_token;
    }

    const returnUrl = req.session.returnUrl || '/dashboard';
    delete req.session.returnUrl;

    console.log('[Auth] Supabase login successful, redirecting to:', returnUrl);

    // Feature #40: Log audit event
    logAuditEvent(user.id, AUDIT_EVENTS.LOGIN_SUCCESS, {
      action: 'User logged in via Supabase callback',
      email: user.email,
      role: req.session.user.role,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    });

    res.redirect(`${FRONTEND_URL}${returnUrl}`);
  } catch (err) {
    console.error('[Auth] Callback error:', err);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Error durante la autenticación')}`);
  }
});

/**
 * POST /api/auth/logout
 * Logs out the current user
 */
router.post('/logout', (req, res) => {
  // Feature #40: Log audit event BEFORE destroying session (so we have user info)
  const userId = req.session?.user?.id;
  if (userId) {
    logAuditEvent(userId, AUDIT_EVENTS.LOGOUT, {
      action: 'User logged out',
      email: req.session.user.email,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('[Auth] Logout error:', err);
      return res.status(500).json({ error: 'Error al cerrar sesion' });
    }

    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Sesion cerrada exitosamente' });
  });
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user
 */
router.get('/me', (req, res) => {
  if (!req.session.isAuthenticated || !req.session.user) {
    return res.status(401).json({
      error: 'No autenticado',
      isAuthenticated: false,
    });
  }

  res.json({
    isAuthenticated: true,
    user: req.session.user,
  });
});

/**
 * POST /api/auth/refresh
 * Refresh session activity timestamp
 */
router.post('/refresh', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  req.session.lastActivity = Date.now();
  res.json({ success: true, lastActivity: req.session.lastActivity });
});

/**
 * POST /api/auth/dev-login
 * Development-only endpoint to simulate login
 * This bypasses Supabase auth for testing purposes
 *
 * Optional body parameters:
 * - role: 'student_free', 'student_premium', or 'instructor_admin'
 * - name: Custom name for the user
 * - email: Custom email for the user
 * - userId: Custom user ID for testing (e.g., enrollment verification tests)
 */
router.post('/dev-login', (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  console.log('[Auth] Development login triggered');

  const { role = 'student_free', name, email, userId } = req.body || {};

  // Validate role
  const validRoles = ['student_free', 'student_premium', 'instructor_admin'];
  const userRole = validRoles.includes(role) ? role : 'student_free';

  // Determine user ID: custom userId > role-based default
  const defaultId = userRole === 'instructor_admin' ? 99 : 1;
  const finalUserId = userId && Number.isInteger(userId) && userId > 0 ? userId : defaultId;

  // Simulate successful login with test user
  req.session.user = {
    id: finalUserId,
    email: email || (userRole === 'instructor_admin' ? 'instructor@rizo.ma' : 'test@rizo.ma'),
    name: name || (userRole === 'instructor_admin' ? 'Instructor Admin' : 'Usuario de Prueba'),
    role: userRole,
  };

  req.session.isAuthenticated = true;
  req.session.lastActivity = Date.now();

  console.log('[Auth] Dev login successful, user:', req.session.user);

  // Feature #40: Log audit event for dev login
  logAuditEvent(finalUserId, AUDIT_EVENTS.LOGIN_SUCCESS, {
    action: 'Dev login (development mode)',
    email: req.session.user.email,
    role: userRole,
    isDev: true,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
  });

  res.json({
    success: true,
    message: 'Logged in successfully (development mode)',
    user: req.session.user,
  });
});

export default router;
