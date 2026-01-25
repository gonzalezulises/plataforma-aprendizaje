// Cleanup script for orphaned reply_votes
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== Cleaning up orphaned reply_votes ===\n');

  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'learning.db');

  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Find orphaned votes
  const orphanedVotes = db.exec(`
    SELECT v.* FROM reply_votes v
    LEFT JOIN forum_replies r ON v.reply_id = r.id
    WHERE r.id IS NULL
  `);

  if (orphanedVotes.length === 0 || orphanedVotes[0].values.length === 0) {
    console.log('No orphaned votes found.');
    db.close();
    return;
  }

  console.log('Found', orphanedVotes[0].values.length, 'orphaned votes');
  console.log('Deleting them...');

  // Delete orphaned votes
  db.run(`
    DELETE FROM reply_votes WHERE reply_id NOT IN (SELECT id FROM forum_replies)
  `);

  // Save the database
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log('Orphaned votes deleted successfully!');

  // Verify
  const remaining = db.exec(`
    SELECT v.* FROM reply_votes v
    LEFT JOIN forum_replies r ON v.reply_id = r.id
    WHERE r.id IS NULL
  `);

  if (remaining.length === 0 || remaining[0].values.length === 0) {
    console.log('✅ Verification passed: No orphaned votes remaining');
  }

  db.close();
}

main().catch(console.error);
