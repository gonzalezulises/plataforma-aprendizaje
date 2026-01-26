const db = require('./backend/src/config/database.js');
const users = db.prepare('SELECT id, email, name, role FROM users WHERE role = ? OR role = ?').all('instructor', 'admin');
console.log(JSON.stringify(users, null, 2));
