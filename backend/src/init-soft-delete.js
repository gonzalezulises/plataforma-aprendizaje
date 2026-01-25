/**
 * Initialize soft delete support for submissions
 * Feature #166: Soft delete preserves historical data
 *
 * This module runs migration and registers routes for soft delete functionality.
 * Call initSoftDelete(app) after database is ready.
 */

import { getDatabase, saveDatabase } from './config/database.js';

/**
 * Run migration to add deleted_at columns
 */
export function runSoftDeleteMigration() {
  try {
    const db = getDatabase();

    // Add deleted_at column to code_submissions if it doesn't exist
    try {
      db.run(`ALTER TABLE code_submissions ADD COLUMN deleted_at TEXT DEFAULT NULL`);
      console.log('[SoftDelete] Added deleted_at column to code_submissions');
    } catch (e) {
      // Column already exists
    }

    // Add deleted_at column to project_submissions if it doesn't exist
    try {
      db.run(`ALTER TABLE project_submissions ADD COLUMN deleted_at TEXT DEFAULT NULL`);
      console.log('[SoftDelete] Added deleted_at column to project_submissions');
    } catch (e) {
      // Column already exists
    }

    // Create indexes for soft delete queries
    db.run(`CREATE INDEX IF NOT EXISTS idx_code_submissions_deleted ON code_submissions(deleted_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_project_submissions_deleted ON project_submissions(deleted_at)`);

    saveDatabase();
    console.log('[SoftDelete] Migration completed successfully');
  } catch (error) {
    console.error('[SoftDelete] Migration failed:', error);
  }
}

/**
 * Initialize soft delete routes
 */
export async function initSoftDelete(app) {
  // Run migration first
  runSoftDeleteMigration();

  // Load and register submissions routes
  try {
    const submissionsModule = await import('./routes/submissions.js');
    app.use('/api/submissions', submissionsModule.default);
    console.log('[SoftDelete] Submissions routes registered at /api/submissions');
  } catch (e) {
    console.error('[SoftDelete] Failed to load submissions routes:', e.message);
  }
}

export default { runSoftDeleteMigration, initSoftDelete };
