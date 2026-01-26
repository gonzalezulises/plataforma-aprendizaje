const Database = require('better-sqlite3');
const db = new Database('backend/database.sqlite');
const lessons = db.prepare("SELECT id, title, content_type, video_url FROM lessons WHERE content_type = 'video' OR video_url IS NOT NULL LIMIT 10").all();
console.log(JSON.stringify(lessons, null, 2));
db.close();
