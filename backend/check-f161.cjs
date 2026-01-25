const Database = require('better-sqlite3');
const db = new Database('./database.sqlite', { readonly: true });

// Check lesson_progress for lesson 27
const progress = db.prepare('SELECT * FROM lesson_progress WHERE lesson_id = 27').all();
console.log('=== Lesson Progress for Lesson 27 ===');
console.log(JSON.stringify(progress, null, 2));

// Check enrollment for course 29
const enrollment = db.prepare('SELECT * FROM enrollments WHERE course_id = 29').all();
console.log('\n=== Enrollments for Course 29 ===');
console.log(JSON.stringify(enrollment, null, 2));

db.close();
