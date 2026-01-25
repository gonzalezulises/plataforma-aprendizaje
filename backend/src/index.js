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

// Import database
import { initDatabase } from './config/database.js';

// Load environment variables
dotenv.config();

// Initialize database
initDatabase().catch(err => {
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
      'http://localhost:5175'
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/video-progress', videoProgressRoutes);
app.use('/api/notebooks', notebooksRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/lessons', lessonsRoutes);

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
      notifications: '/api/notifications/*',
      analytics: '/api/analytics/*',
      ai: '/api/ai/*'
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

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);

      // Echo back for now - to be replaced with actual handlers
      ws.send(JSON.stringify({ type: 'ack', received: data }));
    } catch (e) {
      console.error('Invalid WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  // Send welcome message
  ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to Plataforma de Aprendizaje' }));
});

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
// nodemon restart trigger - sab., 25 de ene. de 2026  01:20:00
