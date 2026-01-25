// Test script for Feature #164: Deleted thread removes replies
const Database = require('./backend/node_modules/better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== Feature #164 Test: Deleted thread removes replies ===\n');

// Check current forum_threads and forum_replies
console.log('Current forum_threads:');
const threads = db.prepare('SELECT id, course_id, title, reply_count FROM forum_threads ORDER BY id').all();
console.table(threads);

console.log('\nCurrent forum_replies:');
const replies = db.prepare('SELECT id, thread_id, user_name, content FROM forum_replies ORDER BY id').all();
console.table(replies);

console.log('\nCurrent reply_votes:');
const votes = db.prepare('SELECT * FROM reply_votes ORDER BY id').all();
console.table(votes);

// Check for orphaned replies (replies without a valid thread)
console.log('\nChecking for orphaned replies:');
const orphanedReplies = db.prepare(`
  SELECT r.* FROM forum_replies r
  LEFT JOIN forum_threads t ON r.thread_id = t.id
  WHERE t.id IS NULL
`).all();
console.log('Orphaned replies:', orphanedReplies.length);
if (orphanedReplies.length > 0) {
  console.table(orphanedReplies);
}

// Check for orphaned votes (votes without a valid reply)
console.log('\nChecking for orphaned votes:');
const orphanedVotes = db.prepare(`
  SELECT v.* FROM reply_votes v
  LEFT JOIN forum_replies r ON v.reply_id = r.id
  WHERE r.id IS NULL
`).all();
console.log('Orphaned votes:', orphanedVotes.length);
if (orphanedVotes.length > 0) {
  console.table(orphanedVotes);
}

db.close();
console.log('\n=== Test complete ===');
