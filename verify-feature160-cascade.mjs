import initSqlJs from './backend/node_modules/sql.js/dist/sql-wasm.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync(path.join(__dirname, 'backend', 'data', 'learning.db'));
  const db = new SQL.Database(dbBuffer);

  // Check for any lessons with TEST_FEATURE160 in the title
  const lessonsResult = db.exec(`
    SELECT id, title, module_id
    FROM lessons
    WHERE title LIKE '%TEST_FEATURE160%'
  `);

  if (lessonsResult.length === 0 || lessonsResult[0].values.length === 0) {
    console.log('✅ SUCCESS: No lessons found with TEST_FEATURE160 in title - cascade delete worked!');
  } else {
    console.log('❌ FAILURE: Found lessons that should have been deleted:');
    console.log(lessonsResult[0].values);
  }

  // Check for any modules with TEST_FEATURE160 in the title
  const modulesResult = db.exec(`
    SELECT id, title, course_id
    FROM modules
    WHERE title LIKE '%TEST_FEATURE160%'
  `);

  if (modulesResult.length === 0 || modulesResult[0].values.length === 0) {
    console.log('✅ SUCCESS: No modules found with TEST_FEATURE160 in title - module was deleted!');
  } else {
    console.log('❌ FAILURE: Found modules that should have been deleted:');
    console.log(modulesResult[0].values);
  }

  // Show current state of modules and lessons for course 41
  console.log('\n--- Current state of course 41 ---');
  const currentModules = db.exec(`
    SELECT id, title FROM modules WHERE course_id = 41
  `);
  console.log('Modules:', currentModules.length > 0 ? currentModules[0].values : 'None');

  const currentLessons = db.exec(`
    SELECT l.id, l.title, l.module_id
    FROM lessons l
    JOIN modules m ON l.module_id = m.id
    WHERE m.course_id = 41
  `);
  console.log('Lessons:', currentLessons.length > 0 ? currentLessons[0].values : 'None');

  db.close();
}

main().catch(console.error);
