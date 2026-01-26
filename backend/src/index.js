// Last reload: 2026-01-26T10:15:00.000Z - Feature #33 rate limiting on login attempts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';

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

// Import database
import { initDatabase } from './config/database.js';

// Import WebSocket event bus
import { wsEventBus } from './utils/websocket-events.js';

// Load environment variables
dotenv.config();

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
      'http://localhost:5210'
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
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
    max: 100,
    message: 'Too many requests, please try again later.',
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
