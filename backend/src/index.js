// Last reload: 2026-01-26T11:15:00.000Z - Feature #32 CSRF protection
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

// Import CSRF middleware
import { csrfTokenGenerator, csrfProtection, getCsrfTokenHandler } from './middleware/csrf.js';

// Import Supabase token verification
import { verifySupabaseToken, extractBearerToken } from './lib/supabase.js';

// Import database functions for user sync
import { queryOne, run } from './config/database.js';

// Import routes
import authRoutes from './routes/auth.js';
import videoProgressRoutes from './routes/video-progress.js';
import notebooksRoutes from './routes/notebooks.js';
import enrollmentsRoutes from './routes/enrollments.js';
import coursesRoutes from './routes/courses.js';
import lessonsRoutes from './routes/lessons.js';
import quizzesRoutes from './routes/quizzes.js';
import challengesRoutes, { initChallengesTables } from './routes/challenges.js';
import projectsRoutes from './routes/projects.js';
import feedbackRoutes from './routes/feedback.js';
import analyticsRoutes from './routes/analytics.js';
import notificationsRoutes from './routes/notifications.js';
import forumRoutes, { initForumTables } from './routes/forum.js';
import webinarsRoutes, { initWebinarsTables } from './routes/webinars.js';
import certificatesRoutes, { initCertificatesTables } from './routes/certificates.js';
import upgradeRoutes, { initUpgradeTables } from './routes/upgrade.js';
import aiRoutes from './routes/ai.js';
import careerPathsRoutes, { initCareerPathsTables } from './routes/career-paths.js';
import directAuthRoutes from './routes/direct-auth.js';
import aiCourseStructureRoutes from './routes/ai-course-structure.js';
import uploadsRoutes, { initUploadsTables } from './routes/uploads.js';
import usersRoutes from './routes/users.js';
import instructorsRoutes from './routes/instructors.js';
import lessonCommentsRoutes, { initLessonCommentsTables } from './routes/lesson-comments.js';
import inlineExercisesRoutes, { initInlineExerciseTables } from './routes/inline-exercises.js';
import youtubeSearchRoutes from './routes/youtube-search.js';
import videoUploadRoutes from './routes/video-upload.js';

// Import database
import { initDatabase } from './config/database.js';

// Import WebSocket event bus
import { wsEventBus } from './utils/websocket-events.js';

// Load environment variables

// Initialize database
initDatabase().then(db => {
  // Initialize challenges tables
  initChallengesTables(db);
  // Initialize forum tables
  initForumTables(db);
  // Initialize webinars tables
  initWebinarsTables(db);
  // Initialize certificates tables
  initCertificatesTables(db);
  // Initialize upgrade tables
  initUpgradeTables(db);
  // Initialize career paths tables
  initCareerPathsTables(db);
  // Initialize uploads tables
  initUploadsTables(db);
  // Initialize lesson comments tables
  initLessonCommentsTables(db);
  // Initialize inline exercise progress tables
  initInlineExerciseTables(db);
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // List of allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:5178',
      'http://localhost:5179',
      'http://localhost:5180',
      'http://localhost:5181',
      'http://localhost:5182',
      'http://localhost:5183',
      'http://localhost:5184',
      'http://localhost:5185',
      'http://localhost:5186',
      'http://localhost:5187',
      'http://localhost:5188',
      'http://localhost:5189',
      'http://localhost:5190',
      'http://localhost:5191',
      'http://localhost:5192',
      'http://localhost:5193',
      'http://localhost:5194',
      'http://localhost:5195',
      'http://localhost:5196',
      'http://localhost:5197',
      'http://localhost:5198',
      'http://localhost:5199',
      'http://localhost:5200',
      'http://localhost:5201',
      'http://localhost:5202',
      'http://localhost:5203',
      'http://localhost:5204',
      'http://localhost:5205',
      'http://localhost:5206',
      'http://localhost:5207',
      'http://localhost:5208',
      'http://localhost:5209',
      'http://localhost:5210',
      'https://www.rizo.ma',
      'https://rizo.ma',
      'https://cursos.rizo.ma',
      'https://academia.rizo.ma',
      'https://academia-rizoma.vercel.app',
      'https://frontend-one-sigma-58.vercel.app',
      'https://plataforma-aprendizaje-api-production.up.railway.app',
      'https://api.rizo.ma'
    ];

    // Also allow any trycloudflare.com origin (quick tunnels)
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.trycloudflare.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting - completely disabled in development
// Only apply in production to avoid blocking automated testing
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // SPA makes ~15-20 requests per page load; 100 was too low
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
} else {
  console.log('[Server] Rate limiting DISABLED in development mode');
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session middleware with 24-hour inactivity timeout
// Feature #12: Session expires after 24 hours of inactivity
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

app.use(session({
  secret: process.env.SESSION_SECRET || 'development-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset session expiry on each request (implements inactivity timeout)
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: SESSION_TIMEOUT, // 24 hours of inactivity
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Session inactivity check middleware
// Validates that the session hasn't expired due to inactivity
app.use((req, res, next) => {
  if (req.session && req.session.isAuthenticated) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;

    // Check if session has been inactive for more than 24 hours
    if (now - lastActivity > SESSION_TIMEOUT) {
      console.log('[Session] Session expired due to inactivity after', Math.round((now - lastActivity) / 1000 / 60 / 60), 'hours');

      // Clear session data but regenerate session to avoid middleware issues
      req.session.regenerate((err) => {
        if (err) {
          console.error('[Session] Error regenerating expired session:', err);
        }
        // Session is now clean/unauthenticated
        next();
      });
      return; // Don't call next() twice
    }

    // Update last activity timestamp
    req.session.lastActivity = now;
  }
  next();
});

// Supabase Token Authentication Middleware
// Checks Authorization header and creates session from valid Supabase token
// This enables cross-domain authentication (Vercel frontend -> Railway backend)
app.use(async (req, res, next) => {
  // If already authenticated, refresh role from database (in case it changed)
  if (req.session && req.session.isAuthenticated && req.session.user) {
    try {
      const freshUser = queryOne('SELECT role FROM users WHERE id = ?', [req.session.user.id]);
      if (freshUser && freshUser.role !== req.session.user.role) {
        console.log('[Auth Middleware] Refreshing role from DB:', req.session.user.role, '->', freshUser.role);
        req.session.user.role = freshUser.role;
      }
    } catch (e) {
      // Ignore errors, continue with existing session
    }
    return next();
  }

  // Check for Authorization header with Supabase token
  const authHeader = req.headers.authorization;
  const token = extractBearerToken(authHeader);

  if (!token) {
    return next();
  }

  try {
    const { user, error } = await verifySupabaseToken(token);

    if (error || !user) {
      // Token invalid, continue without session
      return next();
    }

    // Sync Supabase user with local database
    // Check if user exists by email or external_id (Supabase UUID)
    let localUser = queryOne(
      'SELECT id, email, name, role, avatar_url, external_id FROM users WHERE email = ? OR external_id = ?',
      [user.email, user.id]
    );

    if (!localUser) {
      // Create user in local database
      const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario';
      const userRole = user.user_metadata?.role || 'student_free';
      const now = new Date().toISOString();

      run(`
        INSERT INTO users (email, name, role, external_id, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [user.email, userName, userRole, user.id, user.user_metadata?.avatar_url || null, now, now]);

      // Get the newly created user
      localUser = queryOne('SELECT id, email, name, role, avatar_url FROM users WHERE email = ?', [user.email]);
      console.log('[Auth Middleware] Created new local user:', localUser?.id, user.email);
    } else {
      // Update external_id if not set
      if (!localUser.external_id) {
        run('UPDATE users SET external_id = ? WHERE id = ?', [user.id, localUser.id]);
      }
    }

    // Create session using LOCAL user ID (integer), not Supabase UUID
    req.session.user = {
      id: localUser?.id || user.id, // Prefer local ID
      email: user.email,
      name: localUser?.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
      role: localUser?.role || user.user_metadata?.role || 'student_free',
      supabaseId: user.id,
      avatar: localUser?.avatar_url || user.user_metadata?.avatar_url,
    };

    req.session.isAuthenticated = true;
    req.session.lastActivity = Date.now();
    req.session.supabaseToken = token;

    console.log('[Auth Middleware] Session created for:', user.email, 'Local ID:', req.session.user.id);
  } catch (err) {
    console.error('[Auth Middleware] Supabase token verification error:', err);
  }

  next();
});

// Feature #32: CSRF Token Generator Middleware
// Generates CSRF token for authenticated sessions
app.use(csrfTokenGenerator);

// Feature #32: CSRF Protection Middleware
// Validates CSRF token on state-changing requests (POST, PUT, DELETE, PATCH)
app.use(csrfProtection);

// Feature #32: CSRF Token Endpoint
// Returns the CSRF token for the current session
app.get('/api/csrf-token', getCsrfTokenHandler);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoint for simulating server errors (DEV ONLY)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/test/error-500', (req, res) => {
    // Simulate an internal server error without exposing stack trace
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Something went wrong',
      id: `ERR_${Date.now().toString(36).toUpperCase()}`
    });
  });

  app.post('/api/test/error-500', (req, res) => {
    // Simulate an internal server error on POST
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Something went wrong',
      id: `ERR_${Date.now().toString(36).toUpperCase()}`
    });
  });

  app.get('/api/test/error-500-crash', (req, res, next) => {
    // Simulate an unexpected crash that goes through error handler
    next(new Error('Simulated server crash for testing'));
  });

  // Feature #228: Test endpoint for simulating slow API responses
  app.get('/api/test/slow-response', (req, res) => {
    const delayMs = parseInt(req.query.delay) || 3000; // Default 3 second delay
    const requestId = req.query.requestId || 'unknown';

    console.log(`[Slow API Test] Request ${requestId}: Starting with ${delayMs}ms delay`);

    setTimeout(() => {
      console.log(`[Slow API Test] Request ${requestId}: Responding after ${delayMs}ms delay`);
      res.json({
        message: 'Slow response completed',
        requestId,
        delayMs,
        timestamp: new Date().toISOString()
      });
    }, delayMs);
  });

  // Feature #12: Test endpoint for simulating session inactivity timeout
  // This sets the lastActivity timestamp to simulate 24+ hours of inactivity
  app.post('/api/test/simulate-session-inactivity', (req, res) => {
    if (!req.session || !req.session.isAuthenticated) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Simulate 25 hours of inactivity (more than 24 hour timeout)
    const hoursOfInactivity = req.body.hours || 25;
    const inactivityMs = hoursOfInactivity * 60 * 60 * 1000;
    req.session.lastActivity = Date.now() - inactivityMs;

    console.log(`[Session Test] Simulated ${hoursOfInactivity} hours of inactivity for session`);
    res.json({
      success: true,
      message: `Session lastActivity set to ${hoursOfInactivity} hours ago`,
      lastActivity: req.session.lastActivity,
      sessionTimeoutMs: SESSION_TIMEOUT
    });
  });

  // Feature #12: Get session info for testing
  app.get('/api/test/session-info', (req, res) => {
    res.json({
      isAuthenticated: req.session?.isAuthenticated || false,
      lastActivity: req.session?.lastActivity || null,
      lastActivityAgo: req.session?.lastActivity ? Date.now() - req.session.lastActivity : null,
      sessionTimeoutMs: SESSION_TIMEOUT,
      user: req.session?.user || null
    });
  });

  // Feature #24: Setup test data for instructor course ownership
  app.post('/api/test/setup-feature24', async (req, res) => {
    try {
      const { queryOne, queryAll, run, getDatabase, saveDatabase } = await import('./config/database.js');
      const crypto = await import('crypto');

      function hashPassword(password, salt = null) {
        if (!salt) {
          salt = crypto.randomBytes(16).toString('hex');
        }
        const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
        return { hash, salt };
      }

      const now = new Date().toISOString();
      const results = { actions: [] };

      // 1. Ensure instructor user exists and get their ID
      let instructor = queryOne('SELECT * FROM users WHERE email = ?', ['instructor@test.com']);
      if (!instructor) {
        const { hash, salt } = hashPassword('password123');
        run('INSERT INTO users (email, name, role, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          ['instructor@test.com', 'Test Instructor', 'instructor_admin', hash, salt, now]);
        instructor = queryOne('SELECT * FROM users WHERE email = ?', ['instructor@test.com']);
        results.actions.push('Created instructor user');
      }
      results.instructor = { id: instructor.id, name: instructor.name, email: instructor.email };

      // 2. Create a second instructor to test access restriction
      let instructor2 = queryOne('SELECT * FROM users WHERE email = ?', ['instructor2@test.com']);
      if (!instructor2) {
        const { hash, salt } = hashPassword('password123');
        run('INSERT INTO users (email, name, role, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          ['instructor2@test.com', 'Other Instructor', 'instructor_admin', hash, salt, now]);
        instructor2 = queryOne('SELECT * FROM users WHERE email = ?', ['instructor2@test.com']);
        results.actions.push('Created instructor2 user');
      }
      results.instructor2 = { id: instructor2.id, name: instructor2.name, email: instructor2.email };

      // 2.5. Ensure main admin user exists (Ulises González)
      let mainAdmin = queryOne('SELECT * FROM users WHERE email = ?', ['ulises@rizo.ma']);
      if (!mainAdmin) {
        const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
        if (!adminPassword) {
          results.actions.push('SKIPPED main admin creation: ADMIN_DEFAULT_PASSWORD env var not set');
        } else {
          const { hash, salt } = hashPassword(adminPassword);
          run('INSERT INTO users (email, name, role, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            ['ulises@rizo.ma', 'Ulises González', 'instructor_admin', hash, salt, now]);
          mainAdmin = queryOne('SELECT * FROM users WHERE email = ?', ['ulises@rizo.ma']);
          results.actions.push('Created main admin user: ulises@rizo.ma');
        }
      }
      if (mainAdmin) {
        results.mainAdmin = { id: mainAdmin.id, name: mainAdmin.name, email: mainAdmin.email };
      }

      // 3. Create or get student user
      let student = queryOne('SELECT * FROM users WHERE email = ?', ['student@test.com']);
      if (!student) {
        const { hash, salt } = hashPassword('password123');
        run('INSERT INTO users (email, name, role, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          ['student@test.com', 'Test Student', 'student_free', hash, salt, now]);
        student = queryOne('SELECT * FROM users WHERE email = ?', ['student@test.com']);
        results.actions.push('Created student user');
      }
      results.student = { id: student.id, name: student.name, email: student.email };

      // 4. Get courses and assign to instructors
      const courses = queryAll('SELECT id, title, slug FROM courses ORDER BY id LIMIT 4');

      // Assign courses 1 and 3 to instructor 1
      if (courses[0]) {
        run('UPDATE courses SET instructor_id = ? WHERE id = ?', [instructor.id, courses[0].id]);
        results.actions.push(`Assigned "${courses[0].title}" to instructor1`);
      }
      if (courses[2]) {
        run('UPDATE courses SET instructor_id = ? WHERE id = ?', [instructor.id, courses[2].id]);
        results.actions.push(`Assigned "${courses[2].title}" to instructor1`);
      }

      // Assign courses 2 and 4 to instructor 2
      if (courses[1]) {
        run('UPDATE courses SET instructor_id = ? WHERE id = ?', [instructor2.id, courses[1].id]);
        results.actions.push(`Assigned "${courses[1].title}" to instructor2`);
      }
      if (courses[3]) {
        run('UPDATE courses SET instructor_id = ? WHERE id = ?', [instructor2.id, courses[3].id]);
        results.actions.push(`Assigned "${courses[3].title}" to instructor2`);
      }

      // 5. Create projects for courses
      let project1 = queryOne('SELECT * FROM projects WHERE title = ?', ['Feature 24 Test - Instructor 1']);
      if (!project1 && courses[0]) {
        run('INSERT INTO projects (course_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [courses[0].slug, 'Feature 24 Test - Instructor 1', 'Test project owned by instructor 1', now, now]);
        project1 = queryOne('SELECT * FROM projects WHERE title = ?', ['Feature 24 Test - Instructor 1']);
        results.actions.push('Created project for instructor1 course');
      }

      let project2 = queryOne('SELECT * FROM projects WHERE title = ?', ['Feature 24 Test - Instructor 2']);
      if (!project2 && courses[1]) {
        run('INSERT INTO projects (course_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [courses[1].slug, 'Feature 24 Test - Instructor 2', 'Test project owned by instructor 2', now, now]);
        project2 = queryOne('SELECT * FROM projects WHERE title = ?', ['Feature 24 Test - Instructor 2']);
        results.actions.push('Created project for instructor2 course');
      }

      // 6. Create student submissions for both projects
      if (project1) {
        const existingSub1 = queryOne('SELECT * FROM project_submissions WHERE project_id = ? AND user_id = ?', [project1.id, student.id]);
        if (!existingSub1) {
          run('INSERT INTO project_submissions (user_id, project_id, content, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [student.id, project1.id, 'TEST_SUBMISSION_F24_INST1_' + Date.now(), 'submitted', now, now]);
          results.actions.push('Created submission for instructor1 project');
        }
      }

      if (project2) {
        const existingSub2 = queryOne('SELECT * FROM project_submissions WHERE project_id = ? AND user_id = ?', [project2.id, student.id]);
        if (!existingSub2) {
          run('INSERT INTO project_submissions (user_id, project_id, content, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [student.id, project2.id, 'TEST_SUBMISSION_F24_INST2_' + Date.now(), 'submitted', now, now]);
          results.actions.push('Created submission for instructor2 project');
        }
      }

      saveDatabase();

      // Get final state
      results.courses = queryAll(`
        SELECT c.id, c.title, c.slug, c.instructor_id, u.name as instructor_name
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.id
        ORDER BY c.id LIMIT 4
      `);

      results.projects = queryAll(`
        SELECT p.*, c.instructor_id, c.title as course_title
        FROM projects p
        JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
        WHERE p.title LIKE 'Feature 24%'
      `);

      results.submissions = queryAll(`
        SELECT ps.id, ps.user_id, ps.project_id, ps.status, p.title as project_title, c.instructor_id
        FROM project_submissions ps
        JOIN projects p ON ps.project_id = p.id
        JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
        WHERE ps.content LIKE 'TEST_SUBMISSION_F24%'
      `);

      results.success = true;
      res.json(results);
    } catch (error) {
      console.error('Error setting up Feature #24 test data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Feature #27: Test endpoint for sandbox security verification
  app.post('/api/test/sandbox-security', async (req, res) => {
    try {
      const { code, language = 'python' } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Code is required' });
      }

      // Import and test the security checker
      const { checkSandboxSecurity, formatSecurityError } = await import('./utils/sandbox-security.js');

      const securityResult = checkSandboxSecurity(code);

      res.json({
        isBlocked: securityResult.isBlocked,
        violations: securityResult.violations,
        formattedError: securityResult.isBlocked ? formatSecurityError(securityResult.violations) : null,
        message: securityResult.isBlocked
          ? 'Codigo bloqueado por violaciones de seguridad'
          : 'Codigo permitido - no se detectaron violaciones'
      });
    } catch (error) {
      console.error('Error testing sandbox security:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Feature #27: Execute code and verify sandbox isolation
  app.post('/api/test/execute-with-sandbox', async (req, res) => {
    try {
      const { code, language = 'python', timeoutSeconds = 10 } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Code is required' });
      }

      // Import the code executor
      const { executeCode } = await import('./utils/code-executor.js');

      const result = await executeCode(code, language, timeoutSeconds);

      res.json({
        ...result,
        sandbox_verification: {
          security_checked: true,
          blocked: result.security_violation || false,
          message: result.security_violation
            ? 'Ejecucion bloqueada por sandbox'
            : 'Ejecucion permitida'
        }
      });
    } catch (error) {
      console.error('Error executing code with sandbox:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Feature #34: Test endpoint for code execution rate limiting
  app.get('/api/test/code-exec-rate-limit-status', async (req, res) => {
    const { getCodeExecRateLimitStatus } = await import('./middleware/rateLimiter.js');

    // Get identifier (same logic as rate limiter)
    let identifier;
    if (req.session?.user?.id) {
      identifier = `user_${req.session.user.id}`;
    } else {
      const forwarded = req.headers['x-forwarded-for'];
      const clientIP = forwarded ? forwarded.split(',')[0].trim() : (req.ip || req.connection?.remoteAddress || 'unknown');
      identifier = `ip_${clientIP}`;
    }

    const status = getCodeExecRateLimitStatus(identifier);
    res.json({
      identifier,
      ...status
    });
  });

  // Feature #34: Clear code execution rate limit for testing
  app.post('/api/test/clear-code-exec-rate-limit', async (req, res) => {
    const { clearAllCodeExecRateLimits, clearCodeExecRateLimit } = await import('./middleware/rateLimiter.js');

    const { identifier, clearAll } = req.body;

    if (clearAll) {
      clearAllCodeExecRateLimits();
      return res.json({ success: true, message: 'Cleared all code execution rate limits' });
    }

    if (identifier) {
      clearCodeExecRateLimit(identifier);
      return res.json({ success: true, message: `Cleared rate limit for ${identifier}` });
    }

    // Clear for current user/IP
    let currentIdentifier;
    if (req.session?.user?.id) {
      currentIdentifier = `user_${req.session.user.id}`;
    } else {
      const forwarded = req.headers['x-forwarded-for'];
      const clientIP = forwarded ? forwarded.split(',')[0].trim() : (req.ip || req.connection?.remoteAddress || 'unknown');
      currentIdentifier = `ip_${clientIP}`;
    }
    clearCodeExecRateLimit(currentIdentifier);
    res.json({ success: true, message: `Cleared rate limit for ${currentIdentifier}` });
  });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/video-progress', videoProgressRoutes);
app.use('/api/notebooks', notebooksRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/challenges', challengesRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/webinars', webinarsRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/upgrade', upgradeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/career-paths', careerPathsRoutes);
app.use('/api/direct-auth', directAuthRoutes);
app.use('/api/ai', aiCourseStructureRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/instructors', instructorsRoutes);
app.use('/api/lesson-comments', lessonCommentsRoutes);
app.use('/api/inline-exercises', inlineExercisesRoutes);
app.use('/api/youtube', youtubeSearchRoutes);
app.use('/api/video-upload', videoUploadRoutes);

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Plataforma de Aprendizaje API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/*',
      users: '/api/users/*',
      courses: '/api/courses/*',
      modules: '/api/modules/*',
      lessons: '/api/lessons/*',
      notebooks: '/api/notebooks/*',
      execute: '/api/execute',
      quizzes: '/api/quizzes/*',
      projects: '/api/projects/*',
      forum: '/api/forum/*',
      webinars: '/api/webinars/*',
      notifications: '/api/notifications/*',
      analytics: '/api/analytics/*',
      upgrade: '/api/upgrade/*',
      ai: '/api/ai/*',
      careerPaths: '/api/career-paths/*'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Create HTTP server and WebSocket server
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Store subscriptions: Map of threadId -> Set of WebSocket clients
const threadSubscriptions = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('[WebSocket] New connection');

  // Track which threads this client is subscribed to
  ws.subscribedThreads = new Set();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('[WebSocket] Received:', data);

      // Handle subscription to thread updates
      if (data.type === 'subscribe' && data.threadId) {
        const threadId = String(data.threadId);

        // Add to thread subscriptions
        if (!threadSubscriptions.has(threadId)) {
          threadSubscriptions.set(threadId, new Set());
        }
        threadSubscriptions.get(threadId).add(ws);
        ws.subscribedThreads.add(threadId);

        console.log(`[WebSocket] Client subscribed to thread ${threadId}`);
        ws.send(JSON.stringify({
          type: 'subscribed',
          threadId,
          message: `Subscribed to thread ${threadId} updates`
        }));
      }
      // Handle unsubscription
      else if (data.type === 'unsubscribe' && data.threadId) {
        const threadId = String(data.threadId);

        if (threadSubscriptions.has(threadId)) {
          threadSubscriptions.get(threadId).delete(ws);
          if (threadSubscriptions.get(threadId).size === 0) {
            threadSubscriptions.delete(threadId);
          }
        }
        ws.subscribedThreads.delete(threadId);

        console.log(`[WebSocket] Client unsubscribed from thread ${threadId}`);
        ws.send(JSON.stringify({
          type: 'unsubscribed',
          threadId,
          message: `Unsubscribed from thread ${threadId}`
        }));
      }
      // Ping/pong for keep-alive
      else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      // Echo back other messages
      else {
        ws.send(JSON.stringify({ type: 'ack', received: data }));
      }
    } catch (e) {
      console.error('[WebSocket] Invalid message:', e);
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Connection closed');

    // Clean up subscriptions for this client
    for (const threadId of ws.subscribedThreads) {
      if (threadSubscriptions.has(threadId)) {
        threadSubscriptions.get(threadId).delete(ws);
        if (threadSubscriptions.get(threadId).size === 0) {
          threadSubscriptions.delete(threadId);
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Plataforma de Aprendizaje real-time updates',
    timestamp: Date.now()
  }));
});

// Broadcast function to send updates to all clients subscribed to a thread
function broadcastToThread(threadId, message) {
  const threadIdStr = String(threadId);
  const clients = threadSubscriptions.get(threadIdStr);

  if (!clients || clients.size === 0) {
    console.log(`[WebSocket] No subscribers for thread ${threadId}`);
    return 0;
  }

  let sentCount = 0;
  const messageStr = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(messageStr);
        sentCount++;
      } catch (e) {
        console.error('[WebSocket] Error sending to client:', e);
      }
    }
  }

  console.log(`[WebSocket] Broadcast to thread ${threadId}: ${sentCount} clients`);
  return sentCount;
}

// Listen to the WebSocket event bus for thread broadcasts
wsEventBus.on('broadcast:thread', ({ threadId, message }) => {
  broadcastToThread(threadId, message);
});

// Listen for global broadcasts
wsEventBus.on('broadcast:global', (message) => {
  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  for (const client of wss.clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(messageStr);
        sentCount++;
      } catch (e) {
        console.error('[WebSocket] Error sending global broadcast:', e);
      }
    }
  }
  console.log(`[WebSocket] Global broadcast sent to ${sentCount} clients`);
});

// Export broadcast function for use in routes (deprecated - use wsEventBus instead)
export { broadcastToThread };

// Start server
server.listen(PORT, () => {
  console.log(`
  ======================================
    Plataforma de Aprendizaje API
  ======================================
    Server running on port ${PORT}
    Environment: ${process.env.NODE_ENV || 'development'}
    WebSocket: ws://localhost:${PORT}/ws
  ======================================
  `);
});

export default app;
// webinars routes added - feature #96
// Trigger reload do., 25 de ene. de 2026  4:53:04

// Reload trigger do., 25 de ene. de 2026  10:35:00
// restart trigger do., 25 de ene. de 2026 14:34:42

// RELOAD_MARKER: 2026-01-25T20:42:42.010Z
// Feature #191 trigger reload at do., 25 de ene. de 2026 16:44:59
// Trigger reload
// Trigger reload \2026-01-25 19:25:53
// Trigger reload for Feature #202: do., 25 de ene. de 2026 19:29:06
// Reload: do., 25 de ene. de 2026 19:29:42
// Feature #126 reload: do., 25 de ene. de 2026 19:32:50
// Reload: Feature #230 2026-01-25T21:20:15
// Reload: Feature #230 route fix 2026-01-25T21:22:16
// Feature #229 export reload: 1769394381
// Fix order column: 1769394687
// Feature #26 auth fix: 2026-01-26T01:29:22-05:00
// Feature #12 session inactivity timeout: 2026-01-26T10:21:30
// Feature #12 fix session regenerate: 2026-01-26T10:24:00
// Feature #32 CSRF protection: 2026-01-26T11:25:00 - fixed length check
// Feature #34 code execution rate limiting: lu., 26 de ene. de 2026  6:13:52
// Feature #34 ES modules fix: 1769426123
// Feature #39 notifications auth: 2026-01-26T11:48:00
