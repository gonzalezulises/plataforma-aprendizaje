const Database = require('better-sqlite3');
const db = new Database('./backend/database.sqlite');

const users = db.prepare('SELECT id, name, email, role FROM users LIMIT 15').all();
console.log('Users:');
users.forEach(u => console.log(`  ID ${u.id}: ${u.name} (${u.email}) - ${u.role}`));

// Check for free users
const freeUsers = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'student_free'").all();
console.log('\nFree users:');
freeUsers.forEach(u => console.log(`  ID ${u.id}: ${u.name} (${u.email}) - ${u.role}`));

db.close();
