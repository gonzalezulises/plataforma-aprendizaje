const Database = require('better-sqlite3');
const db = new Database('./backend/database.sqlite');

console.log('=== Courses with instructors ===');
const courses = db.prepare('SELECT id, title, instructor_id FROM courses LIMIT 10').all();
courses.forEach(c => console.log('Course', c.id, '-', c.title, '- instructor:', c.instructor_id));

console.log('\n=== Users (instructors) ===');
const users = db.prepare("SELECT id, email, role FROM users WHERE role = 'instructor_admin'").all();
users.forEach(u => console.log('User', u.id, '-', u.email, '- role:', u.role));

console.log('\n=== Project submissions ===');
const submissions = db.prepare('SELECT ps.id, ps.user_id, ps.project_id, p.course_id FROM project_submissions ps JOIN projects p ON ps.project_id = p.id LIMIT 5').all();
submissions.forEach(s => console.log('Submission', s.id, '- user:', s.user_id, '- project:', s.project_id, '- course:', s.course_id));

console.log('\n=== Projects and their courses ===');
const projects = db.prepare('SELECT p.id, p.title, p.course_id, c.instructor_id FROM projects p LEFT JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT)) LIMIT 5').all();
projects.forEach(p => console.log('Project', p.id, '-', p.title, '- course:', p.course_id, '- instructor:', p.instructor_id));

db.close();
