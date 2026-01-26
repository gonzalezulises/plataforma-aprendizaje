const Database = require('better-sqlite3');
const db = new Database('backend/database.sqlite');

// Check unread notifications
const notifications = db.prepare('SELECT id, user_id, type, message, is_read, created_at FROM notifications WHERE is_read = 0 ORDER BY created_at DESC LIMIT 20').all();
console.log('Unread notifications:', notifications.length);
notifications.forEach(n => console.log('  ID:', n.id, '| User:', n.user_id, '| Type:', n.type, '| Read:', n.is_read));

// Get count per user
const countPerUser = db.prepare('SELECT user_id, COUNT(*) as count FROM notifications WHERE is_read = 0 GROUP BY user_id').all();
console.log('\nUnread count per user:');
countPerUser.forEach(u => console.log('  User', u.user_id, ':', u.count, 'unread'));

// Get user info
const users = db.prepare('SELECT id, name, email, role FROM users').all();
console.log('\nUsers:');
users.forEach(u => console.log('  ID:', u.id, '| Name:', u.name, '| Email:', u.email, '| Role:', u.role));

db.close();
