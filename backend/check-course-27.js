import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkCourse27() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'learning.db');
  console.log('Reading database from:', dbPath);
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log('=== Course 27 exists? ===');
  const course = db.exec('SELECT id, title FROM courses WHERE id = 27');
  if (course.length > 0) {
    console.log('Course:', course[0].values[0]);
  } else {
    console.log('Course 27 not found');
  }

  console.log('\n=== Enrollments for course 27 ===');
  const enrollments = db.exec('SELECT * FROM enrollments WHERE course_id = 27');
  if (enrollments.length > 0) {
    console.log('Columns:', enrollments[0].columns);
    console.log('Rows:', JSON.stringify(enrollments[0].values, null, 2));
    console.log('Total enrollments for course 27:', enrollments[0].values.length);
  } else {
    console.log('No enrollments found for course 27');
  }

  console.log('\n=== All enrollments ===');
  const allEnrollments = db.exec('SELECT e.id, e.user_id, e.course_id, c.title FROM enrollments e LEFT JOIN courses c ON e.course_id = c.id');
  if (allEnrollments.length > 0) {
    console.log('Columns:', allEnrollments[0].columns);
    allEnrollments[0].values.forEach(row => {
      console.log(`  Enrollment ${row[0]}: user=${row[1]}, course=${row[2]}, title=${row[3] || 'NULL (orphan)'}`);
    });
  }

  db.close();
}

checkCourse27().catch(console.error);
