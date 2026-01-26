const Database = require('better-sqlite3');
const db = new Database('./learning.db');

const users = db.prepare('SELECT id, name, email, role FROM users LIMIT 10').all();
console.log('Users:', JSON.stringify(users, null, 2));

db.close();
