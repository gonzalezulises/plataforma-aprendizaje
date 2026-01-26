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

// Delete all unconfirmed deletion requests
db.run(`DELETE FROM account_deletion_requests WHERE confirmed_at IS NULL`);

// Save the database
const data = db.export();
const dbBuffer = Buffer.from(data);
fs.writeFileSync(dbPath, dbBuffer);

console.log('Cancelled all pending deletion requests');
db.close();
