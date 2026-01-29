import express from 'express';
import crypto from 'crypto';
import { queryOne, run, getDatabase, saveDatabase } from '../config/database.js';
import { loginRateLimiter, recordFailedAttempt, recordSuccessfulLogin, getRateLimitStatus, clearRateLimit } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Hash password using SHA256 with salt
 */
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
  return { hash, salt };
}

/**
 * Verify password against stored hash
 */
function verifyPassword(password, storedHash, salt) {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

/**
 * Ensure users table has password columns and create test user
 */
function ensurePasswordColumns() {
  try {
    const db = getDatabase();
    const tableInfo = db.exec("PRAGMA table_info(users)");
    const columns = tableInfo[0]?.values?.map(row => row[1]) || [];

    if (!columns.includes('password_hash')) {
      db.run("ALTER TABLE users ADD COLUMN password_hash TEXT");
      console.log('[DirectAuth] Added password_hash column');
    }
    if (!columns.includes('password_salt')) {
      db.run("ALTER TABLE users ADD COLUMN password_salt TEXT");
      console.log('[DirectAuth] Added password_salt column');
    }
    saveDatabase();

    // Create test users only in development with explicit opt-in
    if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_ENDPOINTS === 'true') {
      const testPwd = process.env.TEST_USER_PASSWORD || crypto.randomBytes(16).toString('hex');

      const testUser = queryOne('SELECT id FROM users WHERE email = ?', ['testuser@example.com']);
      if (!testUser) {
        const { hash, salt } = hashPassword(testPwd);
        run('INSERT INTO users (email, name, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)',
          ['testuser@example.com', 'Test User', 'student_free', hash, salt]);
        console.log('[DirectAuth] Created test user: testuser@example.com');
      }

      const instructorUser = queryOne('SELECT id FROM users WHERE email = ?', ['instructor@test.com']);
      if (!instructorUser) {
        const { hash, salt } = hashPassword(testPwd);
        run('INSERT INTO users (email, name, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)',
          ['instructor@test.com', 'Test Instructor', 'instructor_admin', hash, salt]);
        console.log('[DirectAuth] Created instructor test user: instructor@test.com');
      } else {
        const existing = queryOne('SELECT password_hash FROM users WHERE email = ?', ['instructor@test.com']);
        if (!existing?.password_hash) {
          const { hash, salt } = hashPassword(testPwd);
          run('UPDATE users SET password_hash = ?, password_salt = ? WHERE email = ?',
            [hash, salt, 'instructor@test.com']);
          console.log('[DirectAuth] Updated instructor user with password');
        }
      }
    }
  } catch (err) {
    console.error('[DirectAuth] Error ensuring password columns:', err.message);
  }
}

// Initialize password columns on module load
setTimeout(ensurePasswordColumns, 1000);

/**
 * POST /api/direct-auth/login
 * Direct email/password login endpoint
 * Used when OAuth is not available or as an alternative login method
 *
 * Feature #33: Rate limiting on login attempts
 * - Uses loginRateLimiter middleware to block excessive failed attempts
 * - 5 failed attempts within 15 minutes triggers a 60-second block
 */
router.post('/login', loginRateLimiter, (req, res) => {
  const { email, password } = req.body || {};

  console.log('[DirectAuth] Login attempt for email:', email);

  // Validate input - check for missing fields
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Correo electronico y contrasena son requeridos'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Formato de correo electronico invalido'
    });
  }

  try {
    // Find user by email
    const user = queryOne('SELECT id, email, name, role, password_hash, password_salt FROM users WHERE email = ?', [email]);

    // Security: Use same error message for both "user not found" and "wrong password"
    // This prevents email enumeration attacks - attacker cannot determine if email exists
    if (!user) {
      console.log('[DirectAuth] Login failed: user not found');
      recordFailedAttempt(req); // Feature #33: Record failed attempt for rate limiting
      return res.status(401).json({
        success: false,
        error: 'Credenciales incorrectas. Por favor verifica tu correo y contrasena.'
      });
    }

    // Check if user has a password set (OAuth-only users won't have one)
    if (!user.password_hash || !user.password_salt) {
      console.log('[DirectAuth] Login failed: no password set for user');
      return res.status(401).json({
        success: false,
        error: 'Esta cuenta no tiene contrasena configurada. Usa el inicio de sesion con rizo.ma.'
      });
    }

    // Verify password
    const isValid = verifyPassword(password, user.password_hash, user.password_salt);

    if (!isValid) {
      console.log('[DirectAuth] Login failed: invalid password');
      recordFailedAttempt(req); // Feature #33: Record failed attempt for rate limiting
      return res.status(401).json({
        success: false,
        error: 'Credenciales incorrectas. Por favor verifica tu correo y contrasena.'
      });
    }

    // Login successful - create session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    req.session.isAuthenticated = true;
    req.session.lastActivity = Date.now(); // Feature #12: Track session activity for inactivity timeout

    // Feature #33: Clear rate limit on successful login
    recordSuccessfulLogin(req);

    console.log('[DirectAuth] Login successful for user:', user.email);

    res.json({
      success: true,
      message: 'Inicio de sesion exitoso',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[DirectAuth] Login error:', err);
    // Don't expose internal error details to user - security best practice
    res.status(500).json({
      success: false,
      error: 'Error al procesar la solicitud. Intenta de nuevo mas tarde.'
    });
  }
});

/**
 * GET /api/direct-auth/rate-limit-status
 * Development endpoint to check rate limit status for current IP
 * Feature #33: For testing rate limiting
 */
router.get('/rate-limit-status', (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const clientIP = forwarded ? forwarded.split(',')[0].trim() : (req.ip || req.connection?.remoteAddress || 'unknown');

  const status = getRateLimitStatus(clientIP);
  res.json({
    ip: clientIP,
    ...status
  });
});

/**
 * POST /api/direct-auth/clear-rate-limit
 * Development endpoint to clear rate limit for current IP
 * Feature #33: For testing rate limiting
 */
router.post('/clear-rate-limit', (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const clientIP = forwarded ? forwarded.split(',')[0].trim() : (req.ip || req.connection?.remoteAddress || 'unknown');

  clearRateLimit(clientIP);
  res.json({
    success: true,
    message: `Rate limit cleared for IP: ${clientIP}`
  });
});

export default router;
