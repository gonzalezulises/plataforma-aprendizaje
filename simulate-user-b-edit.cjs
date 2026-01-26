// Script to simulate User B editing course 42 while User A has the form open
const Database = require('better-sqlite3');
const db = new Database('./backend/data/learning_platform.db');

// Get the course's current state
const course = db.prepare('SELECT * FROM courses WHERE id = 42').get();
console.log('Before update:', JSON.stringify(course, null, 2));

// Simulate User B updating the course directly
const now = new Date().toISOString();
db.prepare('UPDATE courses SET description = ?, category = ?, updated_at = ? WHERE id = 42')
  .run('MODIFIED BY USER B - This simulates another user editing while User A has the form open', 'Data Science', now);

// Show updated course
const updatedCourse = db.prepare('SELECT * FROM courses WHERE id = 42').get();
console.log('After update:', JSON.stringify(updatedCourse, null, 2));

db.close();
console.log('\nUser B edit simulated successfully!');
