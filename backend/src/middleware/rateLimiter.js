/**
 * Rate Limiter Middleware for Login Attempts
 * Feature #33: Rate limiting on login attempts
 *
 * Implements an in-memory rate limiter that tracks failed login attempts
 * by IP address and temporarily blocks excessive attempts.
 */

// In-memory store for tracking login attempts
// Key: IP address, Value: { attempts: number, lastAttempt: timestamp, blockedUntil: timestamp }
const loginAttempts = new Map();

// Configuration
const MAX_ATTEMPTS = 5; // Maximum failed attempts before blocking
const BLOCK_DURATION_MS = 60 * 1000; // Block duration: 60 seconds (1 minute)
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // Window to track attempts: 15 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup old entries every 5 minutes

/**
 * Clean up old entries from the rate limiter store
 */
function cleanupOldEntries() {
  const now = Date.now();
  for (const [ip, data] of loginAttempts.entries()) {
    // Remove entries older than the attempt window and not currently blocked
    if (now - data.lastAttempt > ATTEMPT_WINDOW_MS && (!data.blockedUntil || now > data.blockedUntil)) {
      loginAttempts.delete(ip);
    }
  }
}

// Run cleanup periodically
setInterval(cleanupOldEntries, CLEANUP_INTERVAL_MS);

/**
 * Get client IP address from request
 * Handles proxied requests (X-Forwarded-For) and direct connections
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Rate limiter middleware for login endpoints
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
export function loginRateLimiter(req, res, next) {
  const clientIP = getClientIP(req);
  const now = Date.now();

  console.log(`[RateLimiter] Login attempt from IP: ${clientIP}`);

  // Get or create entry for this IP
  let entry = loginAttempts.get(clientIP);

  if (entry) {
    // Check if currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      const remainingSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
      console.log(`[RateLimiter] IP ${clientIP} is blocked. Remaining: ${remainingSeconds}s`);

      return res.status(429).json({
        success: false,
        error: `Demasiados intentos de inicio de sesion. Por favor espera ${remainingSeconds} segundos antes de intentar nuevamente.`,
        retryAfter: remainingSeconds,
        rateLimited: true
      });
    }

    // Check if attempts are within the window
    if (now - entry.lastAttempt > ATTEMPT_WINDOW_MS) {
      // Reset if outside window
      entry = { attempts: 0, lastAttempt: now, blockedUntil: null };
      loginAttempts.set(clientIP, entry);
    }
  } else {
    // First attempt from this IP
    entry = { attempts: 0, lastAttempt: now, blockedUntil: null };
    loginAttempts.set(clientIP, entry);
  }

  // Store entry reference for post-login recording
  req.rateLimitEntry = entry;
  req.rateLimitIP = clientIP;

  next();
}

/**
 * Record a failed login attempt
 * Should be called after a failed login to increment the counter
 * @param {Request} req - Express request object
 */
export function recordFailedAttempt(req) {
  const clientIP = req.rateLimitIP || getClientIP(req);
  const now = Date.now();

  let entry = loginAttempts.get(clientIP);
  if (!entry) {
    entry = { attempts: 0, lastAttempt: now, blockedUntil: null };
  }

  entry.attempts += 1;
  entry.lastAttempt = now;

  console.log(`[RateLimiter] Failed attempt #${entry.attempts} from IP: ${clientIP}`);

  // Check if should be blocked
  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    console.log(`[RateLimiter] IP ${clientIP} is now BLOCKED for ${BLOCK_DURATION_MS / 1000} seconds`);
  }

  loginAttempts.set(clientIP, entry);
}

/**
 * Record a successful login attempt
 * Should be called after a successful login to reset the counter
 * @param {Request} req - Express request object
 */
export function recordSuccessfulLogin(req) {
  const clientIP = req.rateLimitIP || getClientIP(req);

  // Clear all attempts on successful login
  loginAttempts.delete(clientIP);
  console.log(`[RateLimiter] Cleared attempts for IP: ${clientIP} (successful login)`);
}

/**
 * Get rate limit status for an IP (for testing/debugging)
 * @param {string} ip - IP address to check
 * @returns {Object} Rate limit status
 */
export function getRateLimitStatus(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) {
    return { attempts: 0, blocked: false, remainingAttempts: MAX_ATTEMPTS };
  }

  const now = Date.now();
  const blocked = entry.blockedUntil && now < entry.blockedUntil;
  const remainingSeconds = blocked ? Math.ceil((entry.blockedUntil - now) / 1000) : 0;

  return {
    attempts: entry.attempts,
    blocked,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - entry.attempts),
    remainingSeconds,
    maxAttempts: MAX_ATTEMPTS,
    blockDuration: BLOCK_DURATION_MS / 1000
  };
}

/**
 * Clear rate limit for an IP (for testing)
 * @param {string} ip - IP address to clear
 */
export function clearRateLimit(ip) {
  loginAttempts.delete(ip);
}

/**
 * Clear all rate limits (for testing)
 */
export function clearAllRateLimits() {
  loginAttempts.clear();
  console.log('[RateLimiter] Cleared all rate limits');
}

export default {
  loginRateLimiter,
  recordFailedAttempt,
  recordSuccessfulLogin,
  getRateLimitStatus,
  clearRateLimit,
  clearAllRateLimits
};
