const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data', 'learning.db');
const db = new Database(dbPath);

// Get the latest deletion request
const request = db.prepare(`
  SELECT adr.*, u.email, u.name
  FROM account_deletion_requests adr
  JOIN users u ON adr.user_id = u.id
  ORDER BY adr.requested_at DESC
  LIMIT 1
`).get();

if (request) {
  console.log('Deletion Request Found:');
  console.log('  User:', request.name, '(' + request.email + ')');
  console.log('  Token:', request.token);
  console.log('  Requested at:', request.requested_at);
  console.log('  Expires at:', request.expires_at);
  console.log('  Confirmed:', request.confirmed_at || 'Not yet');
  console.log('');
  console.log('Confirmation URL: http://localhost:5173/confirm-deletion/' + request.token);
} else {
  console.log('No deletion requests found');
}

db.close();
