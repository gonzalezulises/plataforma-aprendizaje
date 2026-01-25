const Database = require('/c/Users/gonza/claude-projects/backend/node_modules/better-sqlite3');
const db = new Database('/c/Users/gonza/claude-projects/backend/database.sqlite');

// Check users
const users = db.prepare('SELECT id, email, name, role FROM users LIMIT 10').all();
console.log('Users:', JSON.stringify(users, null, 2));

// Check enrollments
const enrollments = db.prepare('SELECT e.user_id, e.course_id, c.title FROM enrollments e JOIN courses c ON e.course_id = c.id LIMIT 10').all();
console.log('Enrollments:', JSON.stringify(enrollments, null, 2));

// Check lessons
const lessons = db.prepare('SELECT l.id, l.title, m.course_id, c.slug FROM lessons l JOIN modules m ON l.module_id = m.id JOIN courses c ON m.course_id = c.id LIMIT 5').all();
console.log('Lessons with course info:', JSON.stringify(lessons, null, 2));

db.close();
