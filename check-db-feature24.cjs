const { getDatabase } = require('./backend/src/config/database.js');
const db = getDatabase();

console.log('=== Courses with instructor_id ===');
const courses = db.prepare('SELECT id, title, instructor_id FROM courses LIMIT 5').all();
console.log(courses);

console.log('\n=== Projects ===');
const projects = db.prepare('SELECT * FROM projects LIMIT 3').all();
console.log(projects);

console.log('\n=== Project Submissions ===');
const subs = db.prepare('SELECT * FROM project_submissions LIMIT 5').all();
console.log(subs);

console.log('\n=== Code Submissions ===');
const codeSubs = db.prepare('SELECT COUNT(*) as count FROM code_submissions').get();
console.log(codeSubs);

console.log('\n=== Users ===');
const users = db.prepare('SELECT id, name, email, role FROM users LIMIT 5').all();
console.log(users);
