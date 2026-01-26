const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'backend', 'database.sqlite'));

// Reset test user back to student_free
console.log('Resetting testuser@example.com to student_free...');
db.prepare("UPDATE users SET role = 'student_free' WHERE email = ?").run('testuser@example.com');

// Check current state
const user = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get('testuser@example.com');
console.log('User:', user);

// Check subscriptions
const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(user.id);
console.log('\nSubscriptions:', subs.length);
subs.forEach(s => console.log(`  - ID ${s.id}: ${s.plan_id} - ${s.status} (expires: ${s.expires_at})`));

// Check payment transactions
const txns = db.prepare('SELECT * FROM payment_transactions WHERE user_id = ?').all(user.id);
console.log('\nTransactions:', txns.length);
txns.forEach(t => console.log(`  - ${t.transaction_id}: ${t.status} - $${t.amount} ${t.currency}`));

db.close();
console.log('\nDone!');
