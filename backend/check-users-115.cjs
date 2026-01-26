const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');
const users = db.prepare('SELECT id, email, name, role FROM users WHERE role IN (?, ?) LIMIT 5').all('instructor', 'admin');
console.log(JSON.stringify(users, null, 2));
db.close();
