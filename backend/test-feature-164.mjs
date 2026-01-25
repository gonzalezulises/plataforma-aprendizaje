// Test script for Feature #164: Deleted thread removes replies
import { queryAll, queryOne, run, getDatabase, saveDatabase } from './src/config/database.js';

console.log('=== Feature #164 Test: Deleted thread removes replies ===\n');

// Check current forum_threads and forum_replies
console.log('Current forum_threads:');
const threads = queryAll('SELECT id, course_id, title, reply_count FROM forum_threads ORDER BY id');
console.table(threads);

console.log('\nCurrent forum_replies:');
const replies = queryAll('SELECT id, thread_id, user_name, content FROM forum_replies ORDER BY id');
console.table(replies);

console.log('\nCurrent reply_votes:');
const votes = queryAll('SELECT * FROM reply_votes ORDER BY id');
console.table(votes);

// Check for orphaned replies (replies without a valid thread)
console.log('\nChecking for orphaned replies:');
const orphanedReplies = queryAll(`
  SELECT r.* FROM forum_replies r
  LEFT JOIN forum_threads t ON r.thread_id = t.id
  WHERE t.id IS NULL
`);
console.log('Orphaned replies:', orphanedReplies.length);
if (orphanedReplies.length > 0) {
  console.table(orphanedReplies);
}

// Check for orphaned votes (votes without a valid reply)
console.log('\nChecking for orphaned votes:');
const orphanedVotes = queryAll(`
  SELECT v.* FROM reply_votes v
  LEFT JOIN forum_replies r ON v.reply_id = r.id
  WHERE r.id IS NULL
`);
console.log('Orphaned votes:', orphanedVotes.length);
if (orphanedVotes.length > 0) {
  console.table(orphanedVotes);
}

console.log('\n=== Test complete ===');
