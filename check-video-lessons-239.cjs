const Database = require('better-sqlite3');
const db = new Database('backend/database.db');

// Find lessons with video content
const lessons = db.prepare(`
  SELECT l.id, l.title, l.video_url, m.title as module_title, c.title as course_title
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  JOIN courses c ON m.course_id = c.id
  WHERE l.video_url IS NOT NULL AND l.video_url != ''
  LIMIT 10
`).all();

console.log('Lessons with video content:');
console.log(JSON.stringify(lessons, null, 2));

db.close();
