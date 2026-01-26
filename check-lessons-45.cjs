const db = require('./backend/src/config/database');

// Query for lessons with their module and course info
const lessons = db.queryAll(`
  SELECT l.id, l.title, l.module_id,
         m.title as module_title, m.course_id,
         c.title as course_title, c.slug as course_slug
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  JOIN courses c ON m.course_id = c.id
  LIMIT 10
`);

console.log('Lessons found:', lessons.length);
console.log(JSON.stringify(lessons, null, 2));
