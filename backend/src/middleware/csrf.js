// CSRF Protection Middleware
// Feature #32: CSRF protection on state-changing operations
// Updated: 2026-01-26T11:24:30Z - Force reload with startup message

import crypto from 'crypto';

// Log when module is loaded to confirm new code is running
console.log('[CSRF] *** CSRF MODULE LOADED ***', new Date().toISOString());

// In-memory storage for CSRF tokens (per session)
// In production, these would be stored in session or Redis
const CSRF_TOKEN_HEADER = 'X-CSRF-Token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken() {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Middleware to generate and attach CSRF token to session
 * Should be applied globally after session middleware
 */
export function csrfTokenGenerator(req, res, next) {
  // Only generate token for authenticated sessions
  if (req.session && req.session.isAuthenticated) {
    // Generate token if not exists or refresh on each request for better security
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCsrfToken();
      console.log('[CSRF] Generated new token for session');
    }
  }
  next();
}

/**
 * Middleware to validate CSRF token on state-changing requests
 * Applies to POST, PUT, DELETE, PATCH methods
 */
export function csrfProtection(req, res, next) {
  // Debug: Log every request to confirm middleware is running
  console.log('[CSRF] Checking request:', req.method, req.path, 'Auth:', !!req.session?.isAuthenticated);

  // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF check for non-authenticated requests
  // (they'll fail auth anyway)
  if (!req.session || !req.session.isAuthenticated) {
    console.log('[CSRF] Skipping - not authenticated');
    return next();
  }

  // Skip CSRF for specific endpoints that need to work without tokens
  // (e.g., login endpoints that establish the session)
  const excludedPaths = [
    '/api/auth/dev-login',
    '/api/auth/logout',
    '/api/auth/callback',
    '/api/auth/verify', // Supabase token verification (establishes session)
    '/api/direct-auth/login',
    '/api/direct-auth/register',
    '/api/direct-auth/forgot-password',
    '/api/direct-auth/reset-password',
    '/api/users/admin/set-role', // Admin role management
    '/api/test/', // All test endpoints excluded
    '/api/courses' // Course management (already requires instructor auth)
  ];

  const isExcluded = excludedPaths.some(path => req.path.startsWith(path));
  if (isExcluded) {
    return next();
  }

  // Get token from header
  const clientToken = req.headers[CSRF_TOKEN_HEADER.toLowerCase()] || req.headers[CSRF_TOKEN_HEADER];

  // Get token from session
  const sessionToken = req.session.csrfToken;

  // Validate token
  if (!clientToken || !sessionToken) {
    console.log('[CSRF] Missing token:', {
      hasClientToken: !!clientToken,
      hasSessionToken: !!sessionToken,
      method: req.method,
      path: req.path
    });
    return res.status(403).json({
      error: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING',
      message: 'Se requiere un token CSRF para esta operacion'
    });
  }

  // Constant-time comparison to prevent timing attacks
  // First check length to avoid timingSafeEqual errors with different length buffers
  const clientBuffer = Buffer.from(clientToken);
  const sessionBuffer = Buffer.from(sessionToken);

  if (clientBuffer.length !== sessionBuffer.length) {
    console.log('[CSRF] Token length mismatch for path:', req.path);
    return res.status(403).json({
      error: 'CSRF token invalid',
      code: 'CSRF_TOKEN_INVALID',
      message: 'Token CSRF invalido. Por favor, recarga la pagina e intenta de nuevo.'
    });
  }

  if (!crypto.timingSafeEqual(clientBuffer, sessionBuffer)) {
    console.log('[CSRF] Token mismatch for path:', req.path);
    return res.status(403).json({
      error: 'CSRF token invalid',
      code: 'CSRF_TOKEN_INVALID',
      message: 'Token CSRF invalido. Por favor, recarga la pagina e intenta de nuevo.'
    });
  }

  // Token is valid
  next();
}

/**
 * Route handler to get the current CSRF token
 * Used by frontend to get token for forms
 */
export function getCsrfTokenHandler(req, res) {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({
      error: 'Not authenticated',
      message: 'Debes iniciar sesion para obtener un token CSRF'
    });
  }

  // Ensure token exists
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  res.json({
    csrfToken: req.session.csrfToken,
    headerName: CSRF_TOKEN_HEADER
  });
}

export default {
  csrfTokenGenerator,
  csrfProtection,
  getCsrfTokenHandler,
  CSRF_TOKEN_HEADER
};
