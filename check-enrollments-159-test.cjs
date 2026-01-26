const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data', 'learning.db');
const db = new Database(dbPath);

// Check enrollments for course 38
console.log('=== Enrollments for Course 38 (TEST_159_CASCADE_ENROLLMENTS) ===');
const enrollments = db.prepare('SELECT * FROM enrollments WHERE course_id = 38').all();
console.log('Enrollments found:', enrollments.length);
enrollments.forEach(e => {
  console.log(`  - Enrollment ID: ${e.id}, User ID: ${e.user_id}, Enrolled at: ${e.enrolled_at}`);
});

// Check total enrollments
console.log('\n=== Total Enrollments in DB ===');
const total = db.prepare('SELECT COUNT(*) as count FROM enrollments').get();
console.log('Total enrollments:', total.count);

db.close();
