const Database = require('./backend/node_modules/better-sqlite3');
const db = new Database('./backend/database.sqlite');

// Find lessons with code content
const lessons = db.prepare(`
  SELECT l.id, l.title, l.content_type, m.course_id, c.title as course_title, c.slug as course_slug
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  JOIN courses c ON m.course_id = c.id
  WHERE l.content_type = 'code' OR l.content_type = 'interactive'
  LIMIT 10
`).all();

console.log('Lessons with code content:');
lessons.forEach(l => {
  console.log(`Lesson ${l.id}: ${l.title} (${l.content_type}) - Course: ${l.course_title} (${l.course_slug})`);
});

// Also check lesson_content table for code blocks
const codeContent = db.prepare(`
  SELECT lc.id, lc.lesson_id, lc.type, l.title as lesson_title, c.slug as course_slug
  FROM lesson_content lc
  JOIN lessons l ON lc.lesson_id = l.id
  JOIN modules m ON l.module_id = m.id
  JOIN courses c ON m.course_id = c.id
  WHERE lc.type = 'code' OR lc.type = 'executable'
  LIMIT 10
`).all();

console.log('\nLesson content with code:');
codeContent.forEach(c => {
  console.log(`Content ${c.id}: Lesson ${c.lesson_id} - ${c.lesson_title} (type: ${c.type}) - Course: ${c.course_slug}`);
});

db.close();
