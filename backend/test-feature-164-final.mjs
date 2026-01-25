// Final verification script for Feature #164
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== Feature #164 FINAL Verification ===\n');

  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'learning.db');

  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  let allPassed = true;

  // 1. Check thread 17 deleted
  console.log('1. Thread 17 deleted:');
  const threadResult = db.exec('SELECT * FROM forum_threads WHERE id = 17');
  if (threadResult.length === 0 || threadResult[0].values.length === 0) {
    console.log('   ✅ PASS - Thread 17 deleted\n');
  } else {
    console.log('   ❌ FAIL - Thread 17 still exists\n');
    allPassed = false;
  }

  // 2. Check replies 20 and 21 deleted
  console.log('2. Replies 20 and 21 deleted:');
  const repliesResult = db.exec('SELECT id FROM forum_replies WHERE id IN (20, 21)');
  if (repliesResult.length === 0 || repliesResult[0].values.length === 0) {
    console.log('   ✅ PASS - Replies 20 and 21 deleted\n');
  } else {
    console.log('   ❌ FAIL - Some replies still exist:', repliesResult[0].values);
    allPassed = false;
  }

  // 3. Check votes for replies 20 and 21 deleted
  console.log('3. Votes for replies 20 and 21 deleted:');
  const votesResult = db.exec('SELECT * FROM reply_votes WHERE reply_id IN (20, 21)');
  if (votesResult.length === 0 || votesResult[0].values.length === 0) {
    console.log('   ✅ PASS - Votes for replies 20 and 21 deleted\n');
  } else {
    console.log('   ❌ FAIL - Votes still exist:', votesResult[0].values);
    allPassed = false;
  }

  // 4. Check no orphaned replies
  console.log('4. No orphaned replies:');
  const orphanedReplies = db.exec(`
    SELECT r.id FROM forum_replies r
    LEFT JOIN forum_threads t ON r.thread_id = t.id
    WHERE t.id IS NULL
  `);
  if (orphanedReplies.length === 0 || orphanedReplies[0].values.length === 0) {
    console.log('   ✅ PASS - No orphaned replies\n');
  } else {
    console.log('   ❌ FAIL - Orphaned replies found:', orphanedReplies[0].values);
    allPassed = false;
  }

  // 5. Check no orphaned votes
  console.log('5. No orphaned votes:');
  const orphanedVotes = db.exec(`
    SELECT v.id, v.reply_id FROM reply_votes v
    LEFT JOIN forum_replies r ON v.reply_id = r.id
    WHERE r.id IS NULL
  `);
  if (orphanedVotes.length === 0 || orphanedVotes[0].values.length === 0) {
    console.log('   ✅ PASS - No orphaned votes\n');
  } else {
    console.log('   ❌ FAIL - Orphaned votes found:', orphanedVotes[0].values);
    allPassed = false;
  }

  db.close();

  console.log('========================================');
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED - Feature #164 verified!');
  } else {
    console.log('❌ SOME TESTS FAILED');
  }
  console.log('========================================\n');
}

main().catch(console.error);
