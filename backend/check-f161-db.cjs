// Run with: node check-f161-db.cjs
// Must be run from backend directory

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function checkDatabase() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'learning.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log('=== Checking lesson_progress table ===');

  // Check all progress for user_id = 1 (student)
  const progress = db.exec('SELECT * FROM lesson_progress WHERE user_id = 1');
  if (progress.length > 0) {
    console.log('Columns:', progress[0].columns);
    console.log('Rows:');
    progress[0].values.forEach(row => {
      console.log(row);
    });
  } else {
    console.log('No progress entries found for user 1');
  }

  console.log('\n=== Checking if lesson 27, 28, 29, 30, 31 exist ===');
  const lessons = db.exec('SELECT id, title FROM lessons WHERE id IN (27, 28, 29, 30, 31)');
  if (lessons.length > 0) {
    lessons[0].values.forEach(row => {
      console.log(`Lesson ${row[0]}: ${row[1]}`);
    });
  } else {
    console.log('None of these lessons exist');
  }

  db.close();
}

checkDatabase().catch(console.error);
