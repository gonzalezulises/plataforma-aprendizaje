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

  // Save database
  saveDatabase();

  console.log('Database initialized at:', DB_PATH);
  return db;
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
  saveDatabase();
  const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0];
  const changes = db.getRowsModified();
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
