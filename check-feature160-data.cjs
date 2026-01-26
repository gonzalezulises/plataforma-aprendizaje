const path = require('path');
const Database = require(path.join(__dirname, 'backend', 'node_modules', 'better-sqlite3'));
const db = new Database(path.join(__dirname, 'backend', 'database.db'));

// Get all modules for course 41
const modules = db.prepare(`
  SELECT m.id, m.title, m.course_id, m.order_index
  FROM modules m
  WHERE m.course_id = 41
  ORDER BY m.order_index
`).all();
console.log('Modules in course 41:', JSON.stringify(modules, null, 2));

// Get all lessons for those modules
const lessons = db.prepare(`
  SELECT l.id, l.title, l.module_id, l.order_index
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = 41
  ORDER BY m.order_index, l.order_index
`).all();
console.log('Lessons in course 41:', JSON.stringify(lessons, null, 2));

db.close();
