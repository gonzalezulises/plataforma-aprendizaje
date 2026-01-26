const Database = require('better-sqlite3');
const db = new Database('./backend/data/dev.db');

// Get a challenge
const challenge = db.prepare('SELECT id, title FROM code_challenges LIMIT 1').get();
console.log('Challenge:', challenge);

// Get submissions for the challenge
const submissions = db.prepare(`
  SELECT id, user_id, attempt_number, is_correct, execution_time_ms, created_at, substr(code, 1, 50) as code_preview
  FROM code_submissions
  WHERE challenge_id = ?
  ORDER BY created_at DESC
  LIMIT 5
`).all(challenge?.id || 1);
console.log('Submissions:', submissions);

// Get user with submissions
const user = submissions.length > 0
  ? db.prepare('SELECT id, email FROM users WHERE id = ?').get(submissions[0].user_id)
  : db.prepare('SELECT id, email FROM users WHERE role = ? LIMIT 1').get('student');
console.log('User:', user);

db.close();
