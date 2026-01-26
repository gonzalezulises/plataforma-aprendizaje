const Database = require('C:/Users/gonza/claude-projects/backend/node_modules/better-sqlite3');
const db = new Database('C:/Users/gonza/claude-projects/backend/learning.db');

// Check enrollments with 100% progress
const enrollments = db.prepare(`
  SELECT e.user_id, e.course_id, e.progress_percent, e.completed_at, u.name, u.email
  FROM enrollments e
  LEFT JOIN users u ON e.user_id = u.id
  WHERE e.progress_percent >= 100
`).all();

console.log('Enrollments with 100% progress:');
console.log(JSON.stringify(enrollments, null, 2));

// Check existing certificates
const certificates = db.prepare(`SELECT * FROM certificates`).all();
console.log('\nExisting certificates:');
console.log(JSON.stringify(certificates, null, 2));
