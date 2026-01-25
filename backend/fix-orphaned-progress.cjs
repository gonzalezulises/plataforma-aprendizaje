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

  console.log('=== Fixing orphaned data for Lesson 26 ===');

  // Delete orphaned lesson_progress for lesson 26
  db.run('DELETE FROM lesson_progress WHERE lesson_id = 26');
  console.log('Deleted lesson_progress entries for lesson 26');

  // Count lessons in course 29
  const lessonCount = db.exec(`
    SELECT COUNT(*) as count
    FROM lessons l
    JOIN modules m ON l.module_id = m.id
    WHERE m.course_id = 29
  `);
  const totalLessons = lessonCount[0].values[0][0];
  console.log('Total lessons in course 29:', totalLessons);

  // Recalculate progress for enrollment in course 29
  // Since there are no lessons left, progress should be 0
  if (totalLessons === 0) {
    db.run('UPDATE enrollments SET progress_percent = 0 WHERE course_id = 29');
    console.log('Updated enrollment progress to 0% (no lessons)');
  }

  // Save the database
  const data = db.export();
  const dbBuffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, dbBuffer);
  console.log('Database saved');

  // Verify
  console.log('\n=== Verification ===');
  const progress = db.exec('SELECT * FROM lesson_progress WHERE lesson_id = 26');
  console.log('Progress entries for lesson 26:', progress.length === 0 ? 'NONE (correct!)' : 'Still exists!');

  const enrollment = db.exec('SELECT progress_percent FROM enrollments WHERE course_id = 29');
  console.log('Enrollment progress for course 29:', enrollment[0].values[0][0] + '%');

  db.close();
}

main().catch(console.error);
