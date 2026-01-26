const sqlite3 = require('./backend/node_modules/better-sqlite3');
const db = sqlite3('./backend/database.sqlite');
const instructors = db.prepare("SELECT id, email, name, role FROM users WHERE role = 'instructor' LIMIT 5").all();
console.log(JSON.stringify(instructors, null, 2));
