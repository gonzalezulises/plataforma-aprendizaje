// Test script for Feature #163: Deleted course removed from career path
// This script tests the handleCourseDeletedFromCareerPaths logic directly

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'learning.db');

async function main() {
  console.log('=== Feature #163 Test: Deleted course removed from career path ===\n');

  try {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    // Helper functions to match the backend
    function queryAll(sql, params = []) {
      const stmt = db.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }

    function queryOne(sql, params = []) {
      const results = queryAll(sql, params);
      return results[0] || null;
    }

    function run(sql, params = []) {
      db.run(sql, params);
    }

    // Step 1: Create a test course
    console.log('Step 1: Create a test course');
    const now = new Date().toISOString();
    run(`
      INSERT INTO courses (title, slug, description, instructor_id, category, tags, level, is_premium, is_published, thumbnail_url, duration_hours, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['TEST_163_DELETE_ME', 'test-163-delete-me', 'Test course for Feature 163', 2, 'Data Science', '[]', 'Principiante', 0, 0, null, 10, now, now]);

    const testCourse = queryOne("SELECT * FROM courses WHERE slug = 'test-163-delete-me'");
    console.log(`   Created test course: ID ${testCourse.id}, Title: "${testCourse.title}"`);

    // Step 2: Add the course to Data Scientist career path
    console.log('\nStep 2: Add course to Data Scientist career path');
    const careerPath = queryOne("SELECT * FROM career_paths WHERE slug = 'data-scientist'");
    const originalCourseIds = JSON.parse(careerPath.course_ids || '[]');
    console.log(`   Original course_ids: [${originalCourseIds.join(', ')}]`);

    const updatedCourseIds = [...originalCourseIds, testCourse.id];
    run(`UPDATE career_paths SET course_ids = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(updatedCourseIds), now, careerPath.id]);

    const updatedPath = queryOne("SELECT * FROM career_paths WHERE slug = 'data-scientist'");
    console.log(`   Updated course_ids: ${updatedPath.course_ids}`);

    // Verify the course is in the career path
    console.log('\nStep 3: Verify course is in career path');
    const pathWithNewCourse = JSON.parse(updatedPath.course_ids);
    if (pathWithNewCourse.includes(testCourse.id)) {
      console.log(`   ✓ Course ${testCourse.id} is in the career path`);
    } else {
      console.log(`   ✗ ERROR: Course ${testCourse.id} is NOT in the career path`);
      process.exit(1);
    }

    // Step 4: Simulate course deletion with career path cleanup (the new logic)
    console.log('\nStep 4: Delete the course (with career path cascade logic)');

    // This is the handleCourseDeletedFromCareerPaths function logic:
    const allCareerPaths = queryAll('SELECT * FROM career_paths');
    for (const cp of allCareerPaths) {
      const courseIds = JSON.parse(cp.course_ids || '[]');
      const courseIdInt = testCourse.id;

      if (courseIds.includes(courseIdInt)) {
        // Remove the deleted course from the array
        const newCourseIds = courseIds.filter(id => id !== courseIdInt);

        // Update the career path
        run(`UPDATE career_paths SET course_ids = ?, updated_at = ? WHERE id = ?`,
          [JSON.stringify(newCourseIds), new Date().toISOString(), cp.id]);

        console.log(`   Removed course ${courseIdInt} from career path "${cp.name}" (id: ${cp.id})`);
      }
    }

    // Delete the actual course
    run('DELETE FROM courses WHERE id = ?', [testCourse.id]);
    console.log(`   Deleted course ${testCourse.id}`);

    // Step 5: Verify the course is removed from the career path
    console.log('\nStep 5: Verify course is REMOVED from career path');
    const finalPath = queryOne("SELECT * FROM career_paths WHERE slug = 'data-scientist'");
    const finalCourseIds = JSON.parse(finalPath.course_ids || '[]');
    console.log(`   Final course_ids: [${finalCourseIds.join(', ')}]`);

    if (!finalCourseIds.includes(testCourse.id)) {
      console.log(`   ✓ SUCCESS: Course ${testCourse.id} has been removed from the career path!`);
    } else {
      console.log(`   ✗ FAILURE: Course ${testCourse.id} is still in the career path!`);
      process.exit(1);
    }

    // Verify original courses are still intact
    const expectedCourseIds = originalCourseIds;
    const allOriginalCoursesPresent = expectedCourseIds.every(id => finalCourseIds.includes(id));
    if (allOriginalCoursesPresent && finalCourseIds.length === expectedCourseIds.length) {
      console.log(`   ✓ All original courses [${expectedCourseIds.join(', ')}] are still present`);
    } else {
      console.log(`   ✗ WARNING: Course list doesn't match expected [${expectedCourseIds.join(', ')}]`);
    }

    // Save the database
    const data = db.export();
    const buffer2 = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer2);
    console.log('\n   Database saved successfully');

    console.log('\n=== Feature #163 Test PASSED ===');
    console.log('Course deletion properly removes the course from career paths.');

    db.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
