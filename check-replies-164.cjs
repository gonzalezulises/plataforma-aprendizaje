const path = require('path');
const initSqlJs = require(path.join(__dirname, 'backend', 'node_modules', 'sql.js'));
const fs = require('fs');

async function checkReplies() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'backend', 'data', 'learning.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Check if replies 34 and 35 still exist
  const replies = db.exec('SELECT * FROM forum_replies WHERE id IN (34, 35)');
  console.log('Replies with IDs 34, 35:', replies.length > 0 ? replies[0].values : 'NONE (deleted)');

  // Check reply count for thread 43
  const countResult = db.exec('SELECT COUNT(*) as count FROM forum_replies WHERE thread_id = 43');
  const count = countResult.length > 0 ? countResult[0].values[0][0] : 0;
  console.log('Reply count for thread 43:', count);

  // Check if thread 43 exists
  const thread = db.exec('SELECT id FROM forum_threads WHERE id = 43');
  console.log('Thread 43:', thread.length > 0 && thread[0].values.length > 0 ? 'EXISTS' : 'DELETED');

  db.close();
}

checkReplies().catch(console.error);
