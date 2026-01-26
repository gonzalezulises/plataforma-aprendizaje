const Database = require('./backend/node_modules/better-sqlite3');
const db = new Database('./backend/data/learning.db');

const users = db.prepare('SELECT id, email, name, role, bio, preferences FROM users LIMIT 5').all();
console.log('Users in database:');
console.log(JSON.stringify(users, null, 2));

db.close();
