// Directly publish all courses via SQL
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('Feature #236: Publishing all courses directly in database...\n');

  const DB_PATH = path.join(__dirname, 'data', 'learning.db');

  if (!fs.existsSync(DB_PATH)) {
    console.error('Database file not found at:', DB_PATH);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  // Check current count
  const countResult = db.exec('SELECT COUNT(*) as count FROM courses');
  const totalCount = countResult[0]?.values[0]?.[0] || 0;
  console.log(`Total courses in database: ${totalCount}`);

  const publishedResult = db.exec('SELECT COUNT(*) as count FROM courses WHERE is_published = 1');
  const publishedCount = publishedResult[0]?.values[0]?.[0] || 0;
  console.log(`Already published: ${publishedCount}`);

  // Update all courses to be published
  db.run('UPDATE courses SET is_published = 1');

  // Also ensure all have correct data
  console.log('Set all courses to published');

  // Verify
  const verifyResult = db.exec('SELECT COUNT(*) as count FROM courses WHERE is_published = 1');
  const newPublishedCount = verifyResult[0]?.values[0]?.[0] || 0;
  console.log(`Now published: ${newPublishedCount}`);

  // Save database
  const data = db.export();
  const buffer2 = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer2);

  console.log('\nDatabase saved. Backend needs to be restarted to see changes.');

  db.close();
}

main().catch(console.error);
