// Manual cleanup script to delete orphaned lesson_progress entries
// Run with: node manual-cascade-cleanup.cjs

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function cleanupOrphanedProgress() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'learning.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log('=== Before cleanup ===');

  // Find orphaned progress entries (lesson_progress where lesson doesn't exist)
  const orphaned = db.exec(`
    SELECT lp.id, lp.user_id, lp.lesson_id
    FROM lesson_progress lp
    LEFT JOIN lessons l ON lp.lesson_id = l.id
    WHERE l.id IS NULL
  `);

  if (orphaned.length > 0 && orphaned[0].values.length > 0) {
    console.log('Orphaned progress entries found:');
    orphaned[0].values.forEach(row => {
      console.log(`  id=${row[0]}, user_id=${row[1]}, lesson_id=${row[2]}`);
    });

    // Delete orphaned entries
    db.run(`
      DELETE FROM lesson_progress
      WHERE lesson_id NOT IN (SELECT id FROM lessons)
    `);

    console.log(`\nDeleted ${orphaned[0].values.length} orphaned entries`);

    // Save the database
    const data = db.export();
    const bufferOut = Buffer.from(data);
    fs.writeFileSync(dbPath, bufferOut);
    console.log('Database saved');
  } else {
    console.log('No orphaned progress entries found');
  }

  console.log('\n=== After cleanup ===');
  const remaining = db.exec('SELECT COUNT(*) FROM lesson_progress WHERE lesson_id NOT IN (SELECT id FROM lessons)');
  console.log('Orphaned entries remaining:', remaining[0].values[0][0]);

  db.close();
}

cleanupOrphanedProgress().catch(console.error);
