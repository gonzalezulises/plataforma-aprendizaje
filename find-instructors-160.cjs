const Database = require('./backend/node_modules/better-sqlite3');
const db = new Database('backend/database.db');

const instructors = db.prepare('SELECT id, name, role FROM users WHERE role = ? LIMIT 5').all('instructor');
console.log('Instructors:', JSON.stringify(instructors, null, 2));

// Also check courses and modules structure
const courses = db.prepare('SELECT id, title, instructor_id FROM courses LIMIT 5').all();
console.log('Courses:', JSON.stringify(courses, null, 2));

const modules = db.prepare('SELECT id, title, course_id FROM modules LIMIT 5').all();
console.log('Modules:', JSON.stringify(modules, null, 2));

const lessons = db.prepare('SELECT id, title, module_id FROM lessons LIMIT 10').all();
console.log('Lessons:', JSON.stringify(lessons, null, 2));

db.close();
