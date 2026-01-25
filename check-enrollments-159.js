const path = require('path');
const Database = require(path.join(__dirname, 'backend', 'node_modules', 'better-sqlite3'));
const db = new Database(path.join(__dirname, 'backend', 'database.sqlite'));

// Check enrollments for course 28
const enrollments = db.prepare('SELECT * FROM enrollments WHERE course_id = 28').all();
console.log('Enrollments for course 28:', JSON.stringify(enrollments, null, 2));
console.log('Total enrollments for course 28:', enrollments.length);

db.close();
