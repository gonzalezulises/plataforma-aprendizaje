const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'learning.db');

async function main() {
  const SQL = await initSqlJs();

  if (!fs.existsSync(DB_PATH)) {
    console.log('Database not found at:', DB_PATH);
    return;
  }

  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  // Check lesson_progress for lesson 26
  console.log('=== Lesson Progress for Lesson 26 ===');
  const progress = db.exec('SELECT * FROM lesson_progress WHERE lesson_id = 26');
  console.log(JSON.stringify(progress, null, 2));

  // Check enrollment progress for course 29
  console.log('\n=== Enrollment Progress for Course 29 ===');
  const enrollment = db.exec('SELECT * FROM enrollments WHERE course_id = 29');
  console.log(JSON.stringify(enrollment, null, 2));

  // Count total lessons in course 29
  console.log('\n=== Total Lessons in Course 29 ===');
  const lessonCount = db.exec(`
    SELECT COUNT(*) as count
    FROM lessons l
    JOIN modules m ON l.module_id = m.id
    WHERE m.course_id = 29
  `);
  console.log(JSON.stringify(lessonCount, null, 2));

  db.close();
}

main().catch(console.error);
