/**
 * Soft Delete Migration
 * Feature #166: Soft delete preserves historical data
 *
 * This migration adds deleted_at columns to submission tables
 * to support soft delete functionality for audit trails.
 */

import { getDatabase, saveDatabase } from './database.js';

export function runSoftDeleteMigration() {
  try {
    const db = getDatabase();

    // Add deleted_at column to code_submissions if it doesn't exist
    try {
      db.run(`ALTER TABLE code_submissions ADD COLUMN deleted_at TEXT DEFAULT NULL`);
      console.log('Added deleted_at column to code_submissions');
    } catch (e) {
      // Column already exists, ignore error
      console.log('code_submissions.deleted_at column already exists');
    }

    // Add deleted_at column to project_submissions if it doesn't exist
    try {
      db.run(`ALTER TABLE project_submissions ADD COLUMN deleted_at TEXT DEFAULT NULL`);
      console.log('Added deleted_at column to project_submissions');
    } catch (e) {
      // Column already exists, ignore error
      console.log('project_submissions.deleted_at column already exists');
    }

    // Create indexes for soft delete queries
    try {
      db.run(`CREATE INDEX IF NOT EXISTS idx_code_submissions_deleted ON code_submissions(deleted_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_project_submissions_deleted ON project_submissions(deleted_at)`);
      console.log('Created soft delete indexes');
    } catch (e) {
      console.log('Soft delete indexes already exist');
    }

    saveDatabase();
    console.log('Soft delete migration completed successfully');
  } catch (error) {
    console.error('Error running soft delete migration:', error);
  }
}

export default { runSoftDeleteMigration };
