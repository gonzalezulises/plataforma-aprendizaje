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

  // Check lesson_progress for lesson 26 (should be EMPTY after deletion)
  console.log('=== Lesson Progress for Lesson 26 (SHOULD BE EMPTY) ===');
  const progress = db.exec('SELECT * FROM lesson_progress WHERE lesson_id = 26');
  console.log(progress.length === 0 ? 'EMPTY - Progress entries removed!' : JSON.stringify(progress, null, 2));

  // Check if lesson 26 still exists (should be EMPTY)
  console.log('\n=== Check if Lesson 26 Exists (SHOULD BE EMPTY) ===');
  const lesson = db.exec('SELECT * FROM lessons WHERE id = 26');
  console.log(lesson.length === 0 ? 'EMPTY - Lesson deleted!' : JSON.stringify(lesson, null, 2));

  // Check enrollment progress for course 29 (should be recalculated)
  console.log('\n=== Enrollment Progress for Course 29 (SHOULD BE RECALCULATED) ===');
  const enrollment = db.exec('SELECT * FROM enrollments WHERE course_id = 29');
  console.log(JSON.stringify(enrollment, null, 2));

  // Count total lessons in course 29 (should be 0)
  console.log('\n=== Total Lessons in Course 29 (SHOULD BE 0) ===');
  const lessonCount = db.exec(`
    SELECT COUNT(*) as count
    FROM lessons l
    JOIN modules m ON l.module_id = m.id
    WHERE m.course_id = 29
  `);
  console.log(JSON.stringify(lessonCount, null, 2));

  // Summary
  console.log('\n=== SUMMARY ===');
  const progressRemoved = progress.length === 0;
  const lessonDeleted = lesson.length === 0;
  const enrollmentExists = enrollment.length > 0;

  console.log('Progress entries removed:', progressRemoved ? 'YES ✓' : 'NO ✗');
  console.log('Lesson deleted:', lessonDeleted ? 'YES ✓' : 'NO ✗');
  console.log('Enrollment exists:', enrollmentExists ? 'YES ✓' : 'NO ✗');

  if (enrollmentExists) {
    const enrollmentData = enrollment[0].values[0];
    const progressPercent = enrollmentData[5]; // progress_percent column
    console.log('Progress percent after deletion:', progressPercent + '%');
    console.log('Progress recalculated correctly:', progressPercent === 0 ? 'YES ✓ (0% because no lessons)' : 'NO ✗');
  }

  db.close();
}

main().catch(console.error);
