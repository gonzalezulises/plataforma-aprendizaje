const db = require('./backend/node_modules/better-sqlite3')('./backend/database.sqlite');
const rows = db.prepare(`
  SELECT l.id, l.title, l.content_type, l.course_id, c.slug, l.content
  FROM lessons l
  JOIN courses c ON l.course_id = c.id
  LIMIT 10
`).all();
console.log(JSON.stringify(rows, null, 2));
db.close();
