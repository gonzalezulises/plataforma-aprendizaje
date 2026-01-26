const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

const n = db.prepare('SELECT id, user_id, type, message, is_read FROM notifications WHERE is_read = 0 ORDER BY created_at DESC LIMIT 20').all();
console.log('Unread notifications:', n.length);
n.forEach(x => console.log('  ID:', x.id, '| User:', x.user_id, '| Type:', x.type));

const c = db.prepare('SELECT user_id, COUNT(*) as cnt FROM notifications WHERE is_read = 0 GROUP BY user_id').all();
console.log('\nUnread count by user:');
c.forEach(x => console.log('  User', x.user_id, ':', x.cnt, 'unread'));

const u = db.prepare('SELECT id, name, email, role FROM users').all();
console.log('\nUsers in database:');
u.forEach(x => console.log('  ID:', x.id, '|', x.name, '|', x.email, '|', x.role));

db.close();
