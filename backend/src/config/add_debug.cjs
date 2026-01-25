const fs = require('fs');
const filePath = 'C:/Users/gonza/claude-projects/backend/src/config/database.js';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// Add debug logging
const oldCode = `export function run(sql, params = []) {
  db.run(sql, params);
  // Get last_insert_rowid BEFORE saveDatabase to ensure it's still valid
  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  let lastId = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    // Convert BigInt to Number if necessary
    lastId = typeof row.id === 'bigint' ? Number(row.id) : row.id;
  }
  stmt.free();
  const changes = db.getRowsModified();
  saveDatabase();
  return { lastInsertRowid: lastId, changes };
}`;

const newCode = `export function run(sql, params = []) {
  db.run(sql, params);
  // Get last_insert_rowid BEFORE saveDatabase to ensure it's still valid
  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  let lastId = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    console.log('[DB Debug] row.id type:', typeof row.id, 'value:', row.id);
    // Convert BigInt to Number if necessary
    lastId = typeof row.id === 'bigint' ? Number(row.id) : row.id;
    console.log('[DB Debug] lastId after conversion:', lastId);
  }
  stmt.free();
  const changes = db.getRowsModified();
  saveDatabase();
  console.log('[DB Debug] Returning lastInsertRowid:', lastId);
  return { lastInsertRowid: lastId, changes };
}`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(filePath, content);
  console.log('Debug logging added successfully');
} else {
  console.log('Old code not found');
}
