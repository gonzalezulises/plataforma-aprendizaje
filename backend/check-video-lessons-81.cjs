const sqlite3 = require('better-sqlite3');
const db = sqlite3('./database.sqlite');

const lessons = db.prepare(`
  SELECT id, title, type, video_url
  FROM lessons
  WHERE video_url IS NOT NULL AND video_url != ''
  LIMIT 10
`).all();

console.log('Lessons with video:');
console.log(JSON.stringify(lessons, null, 2));

db.close();
