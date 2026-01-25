import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkEnrollments() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'learning.db');
  console.log('Reading database from:', dbPath);
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log('=== Enrollments for course 26 (TEST_159_CASCADE_ENROLLMENT_DELETE) ===');
  const enrollments = db.exec('SELECT * FROM enrollments WHERE course_id = 26');
  if (enrollments.length > 0) {
    console.log('Columns:', enrollments[0].columns);
    console.log('Rows:', JSON.stringify(enrollments[0].values, null, 2));
    console.log('Total enrollments for course 26:', enrollments[0].values.length);
  } else {
    console.log('No enrollments found for course 26');
  }

  console.log('\n=== Course 26 exists? ===');
  const course = db.exec('SELECT id, title FROM courses WHERE id = 26');
  if (course.length > 0) {
    console.log('Course:', course[0].values[0]);
  } else {
    console.log('Course 26 not found');
  }

  db.close();
}

checkEnrollments().catch(console.error);
