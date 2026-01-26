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

const stmt = db.prepare(`
  SELECT adr.*, u.email, u.name
  FROM account_deletion_requests adr
  JOIN users u ON adr.user_id = u.id
  ORDER BY adr.requested_at DESC
  LIMIT 1
`);

if (stmt.step()) {
  const request = stmt.getAsObject();
  console.log('Token:', request.token);
  console.log('URL: http://localhost:5173/confirm-deletion/' + request.token);
} else {
  console.log('No deletion requests found');
}

stmt.free();
db.close();
