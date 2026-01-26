const Database = require('better-sqlite3');
const db = new Database('backend/data/database.sqlite');
const users = db.prepare('SELECT id, email, name, role FROM users LIMIT 10').all();
console.log(JSON.stringify(users, null, 2));
db.close();
