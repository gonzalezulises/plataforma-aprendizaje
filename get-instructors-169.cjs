const Database = require('better-sqlite3');
const db = new Database('backend/database.sqlite');
const users = db.prepare("SELECT id, email, name, role FROM users WHERE role = 'instructor' LIMIT 5").all();
console.log(JSON.stringify(users, null, 2));
db.close();
