const fs = require('fs');
const filePath = 'C:/Users/gonza/claude-projects/backend/src/config/database.js';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// Use a pattern that matches the entire run function
const pattern = /export function run\(sql, params = \[\]\) \{\s*db\.run\(sql, params\);\s*saveDatabase\(\);\s*\/\/ Get last_insert_rowid using db\.prepare for reliable results\s*const stmt = db\.prepare\('SELECT last_insert_rowid\(\) as id'\);\s*let lastId = null;\s*if \(stmt\.step\(\)\) \{\s*const row = stmt\.getAsObject\(\);\s*lastId = row\.id;\s*\}\s*stmt\.free\(\);\s*const changes = db\.getRowsModified\(\);\s*return \{ lastInsertRowid: lastId, changes \};\s*\}/;

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

if (pattern.test(content)) {
  content = content.replace(pattern, newCode);
  fs.writeFileSync(filePath, content);
  console.log('File updated successfully');
} else {
  console.log('Pattern not found');
  // Debug: show what the function looks like
  const funcStart = content.indexOf('export function run(sql');
  if (funcStart !== -1) {
    console.log('Function found at position:', funcStart);
    console.log('Content around function:');
    console.log(JSON.stringify(content.substring(funcStart, funcStart + 500)));
  }
}
