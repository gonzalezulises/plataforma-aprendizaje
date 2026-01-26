const Database = require('C:/Users/gonza/claude-projects/backend/node_modules/better-sqlite3');
const db = new Database('C:/Users/gonza/claude-projects/backend/data/learning_platform.db');

// Check users
const users = db.prepare('SELECT id, email, name, role FROM users').all();
console.log('Users:', JSON.stringify(users, null, 2));

// Check courses
const courses = db.prepare('SELECT id, title, slug FROM courses LIMIT 10').all();
console.log('\nCourses:', JSON.stringify(courses, null, 2));

db.close();
