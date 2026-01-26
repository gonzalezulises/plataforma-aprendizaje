const sqlite3 = require('better-sqlite3');
const db = sqlite3('./backend/database.sqlite');

// Check for users with certificates
const certs = db.prepare(`
  SELECT c.*, u.name as user_name, co.title as course_title
  FROM certificates c
  JOIN users u ON c.user_id = u.id
  JOIN courses co ON c.course_id = co.id
  LIMIT 10
`).all();
console.log('Existing certificates:', JSON.stringify(certs, null, 2));

// Check for users with high course progress
const progress = db.prepare(`
  SELECT cp.user_id, u.name, u.email, cp.course_id, co.title, cp.completion_percentage
  FROM course_progress cp
  JOIN users u ON cp.user_id = u.id
  JOIN courses co ON cp.course_id = co.id
  WHERE cp.completion_percentage >= 80
  ORDER BY cp.completion_percentage DESC
  LIMIT 10
`).all();
console.log('Users with high progress:', JSON.stringify(progress, null, 2));

db.close();
