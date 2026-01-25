/**
 * Analytics table migration
 * This script adds analytics tables if they don't exist
 */

import { getDatabase, saveDatabase } from '../config/database.js';

export function runAnalyticsMigration() {
  try {
    const db = getDatabase();

    // Analytics events table - tracks all user activity
    db.run(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for analytics
    db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at)`);

    // Create index for lesson_progress if not exists
    db.run(`CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id)`);

    saveDatabase();
    console.log('Analytics migration completed successfully');
  } catch (error) {
    console.error('Analytics migration failed:', error.message);
  }
}
