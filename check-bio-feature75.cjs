const path = require('path');
const db = require(path.join(__dirname, 'backend', 'node_modules', 'better-sqlite3'))('backend/database.sqlite');
const user = db.prepare('SELECT id, name, email, bio FROM users WHERE id = 1').get();
console.log(JSON.stringify(user, null, 2));
db.close();
