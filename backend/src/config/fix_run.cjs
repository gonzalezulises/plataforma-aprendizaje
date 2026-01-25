const fs = require('fs');
const filePath = 'C:/Users/gonza/claude-projects/backend/src/config/database.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the run function
const oldPattern = /export function run\(sql, params = \[\]\) \{[\s\S]*?return \{ lastInsertRowid: lastId, changes \};\n\}/;

const newCode = `export function run(sql, params = []) {
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

// More flexible pattern
const match = content.match(/export function run\(sql, params = \[\]\) \{[^}]*\}/s);
if (match) {
  console.log('Found match:', match[0].substring(0, 100));
}

// Simple string replacement
const oldStr = `export function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  // Get last_insert_rowid using db.prepare for reliable results
  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  let lastId = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    lastId = row.id;
  }
  stmt.free();
  const changes = db.getRowsModified();
  return { lastInsertRowid: lastId, changes };
}`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newCode);
  fs.writeFileSync(filePath, content);
  console.log('File updated successfully');
} else {
  console.log('Exact string not found, trying regex...');
  if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newCode);
    fs.writeFileSync(filePath, content);
    console.log('File updated with regex');
  } else {
    console.log('Pattern not found');
  }
}
