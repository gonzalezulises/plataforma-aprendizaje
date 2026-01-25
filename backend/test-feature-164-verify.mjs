// Test script for Feature #164: Verify deleted thread removes replies
// This script checks if replies for thread 14 still exist after deletion

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== Feature #164 Verification: Deleted thread removes replies ===\n');

  // Load the database
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'learning.db');

  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Check if thread 16 exists
  console.log('1. Checking if thread 16 exists:');
  const threadResult = db.exec('SELECT * FROM forum_threads WHERE id = 16');
  if (threadResult.length === 0 || threadResult[0].values.length === 0) {
    console.log('   ✅ Thread 16 has been deleted (as expected)\n');
  } else {
    console.log('   ❌ Thread 16 still exists!\n');
    console.table(threadResult[0].values);
  }

  // Check if replies for thread 16 exist
  console.log('2. Checking if replies for thread 16 exist:');
  const repliesResult = db.exec('SELECT * FROM forum_replies WHERE thread_id = 16');
  if (repliesResult.length === 0 || repliesResult[0].values.length === 0) {
    console.log('   ✅ No replies found for thread 16 - CASCADE DELETE worked!\n');
  } else {
    console.log('   ❌ Replies still exist for thread 16!');
    console.log('   Found', repliesResult[0].values.length, 'replies');
    console.table(repliesResult[0].values);
  }

  // Check for orphaned replies (replies without valid thread)
  console.log('3. Checking for orphaned replies (replies without valid thread):');
  const orphanedResult = db.exec(`
    SELECT r.* FROM forum_replies r
    LEFT JOIN forum_threads t ON r.thread_id = t.id
    WHERE t.id IS NULL
  `);
  if (orphanedResult.length === 0 || orphanedResult[0].values.length === 0) {
    console.log('   ✅ No orphaned replies found - Database integrity maintained!\n');
  } else {
    console.log('   ❌ Found orphaned replies!');
    console.table(orphanedResult[0].values);
  }

  // Check for orphaned votes (votes for deleted replies)
  console.log('4. Checking for orphaned reply_votes:');
  const orphanedVotesResult = db.exec(`
    SELECT v.* FROM reply_votes v
    LEFT JOIN forum_replies r ON v.reply_id = r.id
    WHERE r.id IS NULL
  `);
  if (orphanedVotesResult.length === 0 || orphanedVotesResult[0].values.length === 0) {
    console.log('   ✅ No orphaned votes found - Vote cleanup worked!\n');
  } else {
    console.log('   ❌ Found orphaned votes!');
    console.table(orphanedVotesResult[0].values);
  }

  // Check specific reply ID 19 that was in thread 16
  console.log('5. Checking specific reply ID 19 that was in thread 16:');
  const specificRepliesResult = db.exec('SELECT id, thread_id, content FROM forum_replies WHERE id = 19');
  if (specificRepliesResult.length === 0 || specificRepliesResult[0].values.length === 0) {
    console.log('   ✅ Reply 19 has been deleted\n');
  } else {
    console.log('   ❌ Reply 19 still exists!');
    console.table(specificRepliesResult[0].values);
  }

  // Check that vote for reply 19 was also deleted
  console.log('6. Checking that vote for reply 19 was deleted:');
  const voteResult = db.exec('SELECT * FROM reply_votes WHERE reply_id = 19');
  if (voteResult.length === 0 || voteResult[0].values.length === 0) {
    console.log('   ✅ Vote for reply 19 has been deleted\n');
  } else {
    console.log('   ❌ Vote for reply 19 still exists!');
    console.table(voteResult[0].values);
  }

  // Count total replies
  console.log('7. Current forum_replies count:');
  const totalRepliesResult = db.exec('SELECT COUNT(*) as count FROM forum_replies');
  console.log('   Total replies in database:', totalRepliesResult[0].values[0][0]);

  db.close();

  console.log('\n=== Feature #164 Verification Complete ===');
}

main().catch(console.error);
