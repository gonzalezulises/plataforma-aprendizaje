import express from 'express';
import { logAuditEvent, AUDIT_EVENTS } from '../utils/auditLogger.js';
// Feature #144 - Added userId parameter to dev-login for enrollment testing
// Feature #40: Sensitive operations log audit trail

const router = express.Router();

// Get OAuth configuration from environment
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'your-client-id';
const OAUTH_AUTHORIZATION_URL = process.env.OAUTH_AUTHORIZATION_URL || 'https://rizo.ma/oauth/authorize';
const OAUTH_CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3001/api/auth/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * GET /api/auth/login
 * Initiates the OAuth flow by returning the authorization URL
 * Frontend will redirect the user to rizo.ma OAuth page
 */
router.get('/login', (req, res) => {
  // Store the return URL in session for after OAuth callback
  const returnUrl = req.query.returnUrl || '/dashboard';
  req.session.returnUrl = returnUrl;

  // Generate state parameter for CSRF protection
  const state = generateState();
  req.session.oauthState = state;

  // Build the authorization URL with required OAuth parameters
  const authParams = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: OAUTH_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid profile email',
    state: state,
  });

  const authorizationUrl = `${OAUTH_AUTHORIZATION_URL}?${authParams.toString()}`;

  // Log for development purposes (since we don't have real OAuth)
  console.log('[Auth] Login initiated');
  console.log('[Auth] Authorization URL:', authorizationUrl);
  console.log('[Auth] Return URL:', returnUrl);

  // In development mode without real OAuth, we provide info about the redirect
  if (OAUTH_CLIENT_ID === 'your-client-id') {
    // Development mode - OAuth not configured
    console.log('[Auth] OAuth not configured - development mode');
    return res.json({
      authorizationUrl,
      message: 'OAuth en modo desarrollo. En produccion, seras redirigido a rizo.ma para autenticarte.',
      development: true,
      info: {
        description: 'Para configurar OAuth, actualiza las variables de entorno en .env',
        requiredVars: [
          'OAUTH_CLIENT_ID',
          'OAUTH_CLIENT_SECRET',
          'OAUTH_AUTHORIZATION_URL',
          'OAUTH_TOKEN_URL',
        ],
      },
    });
  }

  // Production mode - return the URL for redirect
  res.json({
    authorizationUrl,
    message: 'Redirigiendo a rizo.ma...',
  });
});

/**
 * GET /api/auth/callback
 * OAuth callback handler - receives the authorization code from rizo.ma
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // Handle OAuth errors
  if (error) {
    console.error('[Auth] OAuth error:', error);
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
  }

  // Verify state parameter to prevent CSRF attacks
  if (!state || state !== req.session.oauthState) {
    console.error('[Auth] Invalid state parameter');
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Estado de autenticacion invalido')}`);
  }

  // Check for authorization code
  if (!code) {
    console.error('[Auth] No authorization code received');
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('No se recibio el codigo de autorizacion')}`);
  }

  try {
    // In a real implementation, we would:
    // 1. Exchange the code for access token
    // 2. Get user info from rizo.ma
    // 3. Create or update user in our database
    // 4. Create session

    console.log('[Auth] OAuth callback received');
    console.log('[Auth] Authorization code:', code);

    // For development - simulate successful login
    // In production, this would involve actual token exchange

    // Store user info in session (simulated)
    req.session.user = {
      id: 1,
      email: 'test@rizo.ma',
      name: 'Usuario de Prueba',
      role: 'student_free',
    };

    req.session.isAuthenticated = true;
    req.session.lastActivity = Date.now(); // Feature #12: Track session activity for inactivity timeout

    // Clear OAuth state
    delete req.session.oauthState;

    // Redirect to the original destination or dashboard
    const returnUrl = req.session.returnUrl || '/dashboard';
    delete req.session.returnUrl;

    console.log('[Auth] Login successful, redirecting to:', returnUrl);

    // Feature #40: Log audit event for successful login
    logAuditEvent(req.session.user.id, AUDIT_EVENTS.LOGIN_SUCCESS, {
      action: 'User logged in via OAuth',
      email: req.session.user.email,
      role: req.session.user.role,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent']
    });

    // Redirect to frontend auth callback page which will handle the session check
    // and show appropriate feedback before redirecting to the final destination
    res.redirect(`${FRONTEND_URL}/auth/callback`);

  } catch (err) {
    console.error('[Auth] Callback error:', err);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Error durante la autenticacion')}`);
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
      userAgent: req.headers?.['user-agent']
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
 * POST /api/auth/dev-login
 * Development-only endpoint to simulate OAuth login
 * This bypasses the actual OAuth flow for testing purposes
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
  req.session.lastActivity = Date.now(); // Feature #12: Track session activity for inactivity timeout

  console.log('[Auth] Dev login successful, user:', req.session.user);

  // Feature #40: Log audit event for dev login
  logAuditEvent(finalUserId, AUDIT_EVENTS.LOGIN_SUCCESS, {
    action: 'Dev login (development mode)',
    email: req.session.user.email,
    role: userRole,
    isDev: true,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent']
  });

  res.json({
    success: true,
    message: 'Logged in successfully (development mode)',
    user: req.session.user,
  });
});

/**
 * Utility: Generate a random state string for OAuth CSRF protection
 */
function generateState() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let state = '';
  for (let i = 0; i < 32; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return state;
}

export default router;
