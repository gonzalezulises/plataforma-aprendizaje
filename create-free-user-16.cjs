const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('./backend/data/learning.db');

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
  return { hash, salt };
}

// Create a new free user
const email = 'freeuser16@test.com';
const name = 'Free User 16';
const password = 'password123';

// Check if user already exists
const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
if (existing) {
  console.log('User already exists:', existing);
  // Reset to student_free role if needed
  db.prepare('UPDATE users SET role = ? WHERE email = ?').run('student_free', email);
  console.log('Reset role to student_free');
} else {
  const { hash, salt } = hashPassword(password);
  db.prepare('INSERT INTO users (email, name, role, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))').run(email, name, 'student_free', hash, salt);
  console.log('Created new free user:', email);
}

// Verify the user
const user = db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get(email);
console.log('User details:', user);

db.close();
