import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'learning.db');

const SQL = await initSqlJs();
const buffer = fs.readFileSync(dbPath);
const db = new SQL.Database(buffer);

// Check user testuser@example.com
const stmt = db.prepare(`SELECT id, email, name FROM users WHERE email = 'testuser@example.com'`);

if (stmt.step()) {
  const user = stmt.getAsObject();
  console.log('User EXISTS:', user.name, '(' + user.email + ') - ID:', user.id);
} else {
  console.log('User NOT FOUND - account was deleted');
}

stmt.free();
db.close();
