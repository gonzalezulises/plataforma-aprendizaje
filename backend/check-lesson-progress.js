import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

// Check lesson_progress for lesson 26
console.log('=== Lesson Progress for Lesson 26 ===');
const progress = db.prepare('SELECT * FROM lesson_progress WHERE lesson_id = ?').all('26');
console.log(JSON.stringify(progress, null, 2));

// Check enrollment progress for course 29
console.log('\n=== Enrollment Progress for Course 29 ===');
const enrollment = db.prepare('SELECT * FROM enrollments WHERE course_id = ?').all(29);
console.log(JSON.stringify(enrollment, null, 2));

// Count total lessons in course 29
console.log('\n=== Total Lessons in Course 29 ===');
const lessonCount = db.prepare(`
  SELECT COUNT(*) as count
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = ?
`).get(29);
console.log(JSON.stringify(lessonCount, null, 2));

db.close();
