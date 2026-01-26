import initSqlJs from 'sql.js';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'learning.db');

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
  return { hash, salt };
}

async function main() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  const email = 'freeuser16@test.com';
  const name = 'Free User 16';
  const password = 'password123';

  // Check if user already exists
  const stmt = db.prepare('SELECT id, role FROM users WHERE email = ?');
  stmt.bind([email]);

  if (stmt.step()) {
    const existing = stmt.getAsObject();
    console.log('User already exists:', existing);
    // Reset to student_free role
    db.run('UPDATE users SET role = ? WHERE email = ?', ['student_free', email]);
    console.log('Reset role to student_free');
  } else {
    const { hash, salt } = hashPassword(password);
    db.run(
      'INSERT INTO users (email, name, role, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [email, name, 'student_free', hash, salt]
    );
    console.log('Created new free user:', email);
  }
  stmt.free();

  // Verify the user
  const verifyStmt = db.prepare('SELECT id, email, name, role FROM users WHERE email = ?');
  verifyStmt.bind([email]);
  if (verifyStmt.step()) {
    console.log('User details:', verifyStmt.getAsObject());
  }
  verifyStmt.free();

  // Save to file
  const data = db.export();
  const buffer2 = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer2);
  console.log('Database saved');

  db.close();
}

main().catch(console.error);
