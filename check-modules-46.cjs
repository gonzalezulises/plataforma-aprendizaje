const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'backend', 'learning.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Get courses with modules
  const result = db.exec(`
    SELECT c.id, c.title, c.slug, COUNT(m.id) as module_count
    FROM courses c
    LEFT JOIN modules m ON m.course_id = c.id
    GROUP BY c.id
    ORDER BY module_count DESC
    LIMIT 10
  `);

  console.log('Courses with modules:');
  if (result.length > 0) {
    console.log(JSON.stringify(result[0].values, null, 2));
  }

  // Get sample modules with lessons
  const modules = db.exec(`
    SELECT m.id, m.course_id, m.title, COUNT(l.id) as lesson_count
    FROM modules m
    LEFT JOIN lessons l ON l.module_id = m.id
    GROUP BY m.id
    LIMIT 10
  `);

  console.log('\nModules with lessons:');
  if (modules.length > 0) {
    console.log(JSON.stringify(modules[0].values, null, 2));
  }

  // Get sample lessons
  const lessons = db.exec(`
    SELECT l.id, l.module_id, l.title, l.order
    FROM lessons l
    LIMIT 15
  `);

  console.log('\nSample lessons:');
  if (lessons.length > 0) {
    console.log(JSON.stringify(lessons[0].values, null, 2));
  }
})();
