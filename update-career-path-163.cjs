// Script to add course 30 to Data Scientist career path for Feature #163 testing
// Uses sql.js directly to update the database file

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'backend', 'data', 'learning.db');

async function main() {
  try {
    const SQL = await initSqlJs();

    // Load existing database
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    // Get current Data Scientist career path
    const result = db.exec("SELECT * FROM career_paths WHERE slug = 'data-scientist'");
    if (result.length > 0 && result[0].values.length > 0) {
      console.log('Current career path:', result[0].values[0]);
      console.log('Columns:', result[0].columns);

      // course_ids is at index 6 based on the schema
      const currentCourseIds = JSON.parse(result[0].values[0][6]);
      console.log('Current course_ids:', currentCourseIds);

      // Add course 30
      const newCourseIds = [...currentCourseIds, 30];
      console.log('New course_ids:', newCourseIds);

      // Update the career path
      const now = new Date().toISOString();
      db.run(`
        UPDATE career_paths
        SET course_ids = ?, updated_at = ?
        WHERE slug = 'data-scientist'
      `, [JSON.stringify(newCourseIds), now]);

      // Verify the update
      const updated = db.exec("SELECT course_ids FROM career_paths WHERE slug = 'data-scientist'");
      console.log('Updated course_ids:', updated[0].values[0][0]);

      // Save the database
      const data = db.export();
      const buffer2 = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer2);
      console.log('Database saved successfully');
    } else {
      console.error('Career path not found');
    }

    db.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
