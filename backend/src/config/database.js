import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'learning.db');

let db = null;

/**
 * Initialize the SQLite database
 */
export async function initDatabase() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  createTables();

  // Run migrations for existing databases
  runMigrations();

  // Seed sample data
  seedSampleData();

  // Save database
  saveDatabase();

  console.log('Database initialized at:', DB_PATH);
  return db;
}

/**
 * Seed sample data for development
 */
function seedSampleData() {
  const sampleCourses = [
    {
      title: 'Python: Fundamentos',
      slug: 'python-fundamentos',
      description: 'Aprende Python desde cero con ejercicios practicos y proyectos reales.',
      category: 'Programacion',
      level: 'Principiante',
      is_premium: 0,
      is_published: 1,
      duration_hours: 20
    },
    {
      title: 'Data Science con Python',
      slug: 'data-science-python',
      description: 'Domina pandas, numpy y matplotlib para analisis de datos.',
      category: 'Data Science',
      level: 'Intermedio',
      is_premium: 1,
      is_published: 1,
      duration_hours: 35
    },
    {
      title: 'SQL desde Cero',
      slug: 'sql-desde-cero',
      description: 'Aprende a consultar y manipular bases de datos con SQL.',
      category: 'Bases de Datos',
      level: 'Principiante',
      is_premium: 0,
      is_published: 1,
      duration_hours: 15
    },
    {
      title: 'Machine Learning Basico',
      slug: 'machine-learning-basico',
      description: 'Introduccion a los algoritmos de aprendizaje automatico.',
      category: 'IA / ML',
      level: 'Avanzado',
      is_premium: 1,
      is_published: 1,
      duration_hours: 40
    },
    {
      title: 'R para Estadistica',
      slug: 'r-estadistica',
      description: 'Analisis estadistico y visualizacion de datos con R.',
      category: 'Data Science',
      level: 'Intermedio',
      is_premium: 0,
      is_published: 1,
      duration_hours: 25
    },
    {
      title: 'Web3 y Solidity',
      slug: 'web3-solidity',
      description: 'Desarrolla smart contracts y aplicaciones descentralizadas.',
      category: 'Web3',
      level: 'Avanzado',
      is_premium: 1,
      is_published: 1,
      duration_hours: 30
    }
  ];

  const now = new Date().toISOString();

  for (const course of sampleCourses) {
    // Check if course already exists
    const stmt = db.prepare('SELECT id FROM courses WHERE slug = ?');
    stmt.bind([course.slug]);
    const exists = stmt.step();
    stmt.free();

    if (!exists) {
      db.run(`
        INSERT INTO courses (title, slug, description, category, level, is_premium, is_published, duration_hours, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        course.title,
        course.slug,
        course.description,
        course.category,
        course.level,
        course.is_premium,
        course.is_published,
        course.duration_hours,
        '[]',
        now,
        now
      ]);
      console.log(`Created sample course: ${course.title}`);
    }
  }
}

/**
 * Run schema migrations for existing databases.
 * Each migration checks if it's needed before applying.
 */
function runMigrations() {
  // Migration: Add objectives columns to courses table
  try {
    const cols = db.exec("PRAGMA table_info(courses)");
    const columnNames = cols.length > 0 ? cols[0].values.map(row => row[1]) : [];
    if (!columnNames.includes('objectives')) {
      db.run("ALTER TABLE courses ADD COLUMN objectives TEXT DEFAULT '[]'");
      console.log('[Migration] Added objectives column to courses table');
    }
    if (!columnNames.includes('objectives_sources')) {
      db.run("ALTER TABLE courses ADD COLUMN objectives_sources TEXT DEFAULT '[]'");
      console.log('[Migration] Added objectives_sources column to courses table');
    }
  } catch (e) {
    // Column might already exist, ignore
    console.log('[Migration] courses columns check:', e.message);
  }

  // Migration: Update structure_4c to replace open-ended questions with MCQ-format topics
  try {
    const stmt = db.prepare('SELECT id, structure_4c FROM lessons WHERE structure_4c IS NOT NULL AND structure_4c != \'{}\'');
    const updates = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const s4c = JSON.parse(row.structure_4c || '{}');
      let changed = false;

      // Fix open-ended reflection questions in conclusion
      if (s4c.conclusion && s4c.conclusion.reflection_questions) {
        const rq = s4c.conclusion.reflection_questions;
        const hasOpenEnded = rq.some(q =>
          q.includes('Que fue lo mas desafiante') ||
          q.includes('Como podrias aplicar') ||
          q.includes('Que conexiones ves') ||
          q.includes('Que opinas') ||
          q.startsWith('Como ') ||
          q.startsWith('Que ')
        );
        if (hasOpenEnded) {
          // Extract keyTerm from synthesis or use generic
          const keyTermMatch = s4c.conclusion.synthesis?.match(/sobre (.+?) con/);
          const keyTerm = keyTermMatch ? keyTermMatch[1] : 'este tema';
          s4c.conclusion.reflection_questions = [
            `Identificar el concepto central de ${keyTerm} entre varias opciones`,
            `Distinguir una aplicacion correcta vs incorrecta de ${keyTerm} en un escenario practico`,
            `Relacionar ${keyTerm} con conceptos previos del curso eligiendo la conexion correcta`
          ];
          changed = true;
        }
      }

      // Fix open-ended guiding questions in connections
      if (s4c.connections && s4c.connections.guiding_questions) {
        const gq = s4c.connections.guiding_questions;
        const hasOpenEnded = gq.some(q =>
          q.startsWith('Que sabes sobre') ||
          q.startsWith('Donde has visto') ||
          q.startsWith('Has usado') ||
          q.startsWith('Alguna vez') ||
          q.startsWith('Que tareas') ||
          q.startsWith('Como procesarias') ||
          q.startsWith('Como podrias') ||
          q.startsWith('Por que crees')
        );
        if (hasOpenEnded) {
          const keyTermMatch = s4c.connections.prior_knowledge?.match(/sobre (.+?)\./);
          const keyTerm = keyTermMatch ? keyTermMatch[1] : 'este tema';
          s4c.connections.guiding_questions = [
            `Seleccionar la definicion correcta de ${keyTerm} entre varias opciones`,
            `Identificar un caso de uso real de ${keyTerm} entre varias opciones`
          ];
          changed = true;
        }
      }

      if (changed) {
        updates.push({ id: row.id, structure_4c: JSON.stringify(s4c) });
      }
    }
    stmt.free();

    for (const update of updates) {
      db.run('UPDATE lessons SET structure_4c = ? WHERE id = ?', [update.structure_4c, update.id]);
    }
    if (updates.length > 0) {
      console.log(`[Migration] Updated structure_4c MCQ format for ${updates.length} lessons`);
    }
  } catch (e) {
    console.log('[Migration] structure_4c MCQ update:', e.message);
  }
}

/**
 * Create database tables
 */
function createTables() {
  // Video progress table - tracks where users left off in videos
  db.run(`
    CREATE TABLE IF NOT EXISTS video_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      saved_time REAL NOT NULL DEFAULT 0,
      duration REAL NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, lesson_id, video_id)
    )
  `);

  // Create index for faster lookups
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_video_progress_user_lesson
    ON video_progress(user_id, lesson_id)
  `);

  // Lesson progress table
  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      time_spent_seconds INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, lesson_id)
    )
  `);

  // Notebooks table - stores notebook definitions
  db.run(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      cells TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Notebook states table - persists user-specific cell outputs across sessions
  db.run(`
    CREATE TABLE IF NOT EXISTS notebook_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notebook_id TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT NOT NULL,
      cell_states TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for notebook state lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_notebook_states_notebook ON notebook_states(notebook_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notebook_states_session ON notebook_states(session_id)`);

  // Users table - stores user data synced from rizo.ma OAuth
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'student_free',
      bio TEXT,
      preferences TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Courses table - stores course information
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      instructor_id INTEGER,
      category TEXT,
      tags TEXT DEFAULT '[]',
      objectives TEXT DEFAULT '[]',
      objectives_sources TEXT DEFAULT '[]',
      level TEXT NOT NULL DEFAULT 'Principiante',
      is_premium INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1,
      thumbnail_url TEXT,
      duration_hours REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Enrollments table - tracks user course enrollments
  db.run(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      progress_percent REAL NOT NULL DEFAULT 0,
      last_accessed_at TEXT,
      UNIQUE(user_id, course_id)
    )
  `);

  // Create indexes for enrollments
  db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id)`);

  // Modules table - course sections
  db.run(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      bloom_objective TEXT,
      project_milestone TEXT,
      duration_hours REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for modules
  db.run(`CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id)`);

  // Lessons table - individual lessons within modules
  db.run(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      bloom_level TEXT,
      structure_4c TEXT DEFAULT '{}',
      content_type TEXT DEFAULT 'text',
      duration_minutes INTEGER DEFAULT 15,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for lessons
  db.run(`CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id)`);

  // Lesson content table - content blocks within lessons
  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL DEFAULT '{}',
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for lesson content
  db.run(`CREATE INDEX IF NOT EXISTS idx_lesson_content_lesson ON lesson_content(lesson_id)`);

  // Notifications table - stores user notifications
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      content TEXT DEFAULT '{}',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for notifications
  db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read)`);

  // Feature #28: Account deletion requests table - requires email confirmation
  db.run(`
    CREATE TABLE IF NOT EXISTS account_deletion_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      confirmed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for account deletion requests
  db.run(`CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON account_deletion_requests(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deletion_requests_token ON account_deletion_requests(token)`);
}

/**
 * Save database to disk
 */
export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

/**
 * Get the database instance
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Execute a query and return results as array of objects
 */
export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

/**
 * Execute a query and return first result
 */
export function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Run an INSERT/UPDATE/DELETE statement
 */
export function run(sql, params = []) {
  db.run(sql, params);
  // Get last_insert_rowid BEFORE saveDatabase to ensure it's still valid
  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  let lastId = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    // Convert BigInt to Number if necessary
    lastId = typeof row.id === 'bigint' ? Number(row.id) : row.id;
  }
  stmt.free();
  const changes = db.getRowsModified();
  saveDatabase();
  return { lastInsertRowid: lastId, changes };
}

/**
 * Close the database
 */
export function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

export default { initDatabase, getDatabase, saveDatabase, closeDatabase, queryAll, queryOne, run };
