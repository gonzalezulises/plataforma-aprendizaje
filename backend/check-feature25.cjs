const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');

console.log('=== INSTRUCTORS ===');
const instructors = db.prepare(`SELECT id, email, name, role FROM users WHERE role = 'instructor'`).all();
console.log(JSON.stringify(instructors, null, 2));

console.log('\n=== COURSES WITH INSTRUCTORS ===');
const courses = db.prepare(`
  SELECT c.id, c.title, c.instructor_id, u.name as instructor_name, u.email as instructor_email
  FROM courses c
  JOIN users u ON c.instructor_id = u.id
`).all();
console.log(JSON.stringify(courses, null, 2));

console.log('\n=== SUBMISSIONS ===');
const submissions = db.prepare(`
  SELECT s.id, s.user_id, s.course_id, c.instructor_id, u.name as student_name
  FROM submissions s
  JOIN courses c ON s.course_id = c.id
  JOIN users u ON s.user_id = u.id
`).all();
console.log(JSON.stringify(submissions, null, 2));

db.close();
