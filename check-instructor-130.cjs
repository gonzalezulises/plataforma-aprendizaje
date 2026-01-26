const Database = require('./backend/node_modules/better-sqlite3');
const db = new Database('./backend/database.sqlite');

// Find instructor accounts
const users = db.prepare('SELECT id, email, role FROM users WHERE role = ? LIMIT 3').all('instructor');
console.log('Instructor accounts:');
console.log(JSON.stringify(users, null, 2));

db.close();
