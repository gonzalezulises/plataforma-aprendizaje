import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixOrphanEnrollment() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'learning.db');
  console.log('Reading database from:', dbPath);
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log('=== Before cleanup ===');
  const orphansBefore = db.exec(`
    SELECT e.id, e.course_id, e.user_id
    FROM enrollments e
    LEFT JOIN courses c ON e.course_id = c.id
    WHERE c.id IS NULL
  `);

  if (orphansBefore.length > 0) {
    console.log('Orphan enrollments found:', orphansBefore[0].values);

    // Delete orphan enrollments
    db.run(`
      DELETE FROM enrollments
      WHERE course_id NOT IN (SELECT id FROM courses)
    `);
    console.log('Deleted orphan enrollments');
  } else {
    console.log('No orphan enrollments found');
  }

  console.log('\n=== After cleanup ===');
  const allEnrollments = db.exec('SELECT id, user_id, course_id FROM enrollments');
  if (allEnrollments.length > 0) {
    console.log('Remaining enrollments:', allEnrollments[0].values);
  } else {
    console.log('No enrollments');
  }

  // Save the database back to disk
  const data = db.export();
  const bufferOut = Buffer.from(data);
  fs.writeFileSync(dbPath, bufferOut);
  console.log('\nDatabase saved to disk');

  db.close();
}

fixOrphanEnrollment().catch(console.error);
