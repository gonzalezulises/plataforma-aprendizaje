const Database = require('better-sqlite3');
const db = new Database('./backend/learning.db');
const users = db.prepare('SELECT id, name, email, role FROM users LIMIT 5').all();
console.log(JSON.stringify(users, null, 2));
db.close();
