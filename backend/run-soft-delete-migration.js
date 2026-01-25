/**
 * Standalone script to run soft delete migration
 * Feature #166: Soft delete preserves historical data
 *
 * Run this script: node run-soft-delete-migration.js
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'learning.db');

console.log('[SoftDelete Migration] Starting...');
console.log('[SoftDelete Migration] Database path:', dbPath);

async function runMigration() {
  try {
    const SQL = await initSqlJs();

    if (!fs.existsSync(dbPath)) {
      console.error('[SoftDelete Migration] Database file not found:', dbPath);
      process.exit(1);
    }

    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Add deleted_at column to code_submissions
    try {
      db.run(`ALTER TABLE code_submissions ADD COLUMN deleted_at TEXT DEFAULT NULL`);
      console.log('[SoftDelete Migration] Added deleted_at to code_submissions');
    } catch (e) {
      console.log('[SoftDelete Migration] code_submissions.deleted_at likely already exists:', e.message);
    }

    // Add deleted_at column to project_submissions
    try {
      db.run(`ALTER TABLE project_submissions ADD COLUMN deleted_at TEXT DEFAULT NULL`);
      console.log('[SoftDelete Migration] Added deleted_at to project_submissions');
    } catch (e) {
      console.log('[SoftDelete Migration] project_submissions.deleted_at likely already exists:', e.message);
    }

    // Create indexes
    try {
      db.run(`CREATE INDEX IF NOT EXISTS idx_code_submissions_deleted ON code_submissions(deleted_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_project_submissions_deleted ON project_submissions(deleted_at)`);
      console.log('[SoftDelete Migration] Created indexes');
    } catch (e) {
      console.error('[SoftDelete Migration] Error creating indexes:', e.message);
    }

    // Save database
    const data = db.export();
    const saveBuffer = Buffer.from(data);
    fs.writeFileSync(dbPath, saveBuffer);
    db.close();

    console.log('[SoftDelete Migration] Complete!');
  } catch (error) {
    console.error('[SoftDelete Migration] Failed:', error);
    process.exit(1);
  }
}

runMigration();
