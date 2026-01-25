const fs = require('fs');
const initSqlJs = require('sql.js');

async function checkEnrollments() {
  const SQL = await initSqlJs();
  const dbPath = 'C:/Users/gonza/claude-projects/backend/data/learning.db';
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log('=== Enrollments for course 26 (TEST_159_CASCADE_ENROLLMENT_DELETE) ===');
  const enrollments = db.exec('SELECT * FROM enrollments WHERE course_id = 26');
  if (enrollments.length > 0) {
    console.log('Columns:', enrollments[0].columns);
    console.log('Rows:', JSON.stringify(enrollments[0].values, null, 2));
    console.log('Total enrollments:', enrollments[0].values.length);
  } else {
    console.log('No enrollments found for course 26');
  }

  console.log('\n=== All enrollments ===');
  const allEnrollments = db.exec('SELECT e.*, c.title FROM enrollments e JOIN courses c ON e.course_id = c.id');
  if (allEnrollments.length > 0) {
    console.log('Total:', allEnrollments[0].values.length);
  }

  db.close();
}

checkEnrollments().catch(console.error);
