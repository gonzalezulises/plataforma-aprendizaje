const path = require('path');
const Database = require(path.join(__dirname, 'backend', 'node_modules', 'better-sqlite3'));
const db = new Database(path.join(__dirname, 'features.db'));

// Get all users
const users = db.prepare('SELECT id, email, name, role FROM users LIMIT 10').all();
console.log('Users:', JSON.stringify(users, null, 2));

// Get enrollments for course 3
const enrollments = db.prepare('SELECT user_id FROM enrollments WHERE course_id = 3').all();
console.log('Enrollments for course 3:', JSON.stringify(enrollments, null, 2));

db.close();
