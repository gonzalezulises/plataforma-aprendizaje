const Database = require('better-sqlite3');
const db = new Database('backend/src/database.sqlite');

// Check lessons
const lessons = db.prepare('SELECT id, title, type, module_id FROM lessons ORDER BY id').all();
console.log('Lessons:', JSON.stringify(lessons, null, 2));

// Check if there are any code challenges
const challenges = db.prepare("SELECT id, title, type FROM lessons WHERE type = 'code' OR type = 'challenge' OR type = 'exercise'").all();
console.log('\nCode challenges:', JSON.stringify(challenges, null, 2));

db.close();
