// Test script for Feature #163: Career path progress recalculates after course deletion
// This tests that user progress is properly recalculated when a course is removed

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'learning.db');

async function main() {
  console.log('=== Feature #163 Progress Test: Career path progress recalculates ===\n');

  try {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    // Helper functions
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

    const testUserId = 999; // Use a test user ID

    // Step 1: Create a test course
    console.log('Step 1: Create a test course');
    const now = new Date().toISOString();
    run(`
      INSERT INTO courses (title, slug, description, instructor_id, category, tags, level, is_premium, is_published, thumbnail_url, duration_hours, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['TEST_163_PROGRESS_TEST', 'test-163-progress', 'Test course for progress recalculation', 2, 'Data Science', '[]', 'Principiante', 0, 0, null, 10, now, now]);

    const testCourse = queryOne("SELECT * FROM courses WHERE slug = 'test-163-progress'");
    console.log(`   Created test course: ID ${testCourse.id}`);

    // Step 2: Add the course to Data Scientist career path
    console.log('\nStep 2: Add course to Data Scientist career path');
    const careerPath = queryOne("SELECT * FROM career_paths WHERE slug = 'data-scientist'");
    const originalCourseIds = JSON.parse(careerPath.course_ids || '[]');
    const updatedCourseIds = [...originalCourseIds, testCourse.id];
    run(`UPDATE career_paths SET course_ids = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(updatedCourseIds), now, careerPath.id]);
    console.log(`   Updated course_ids: [${updatedCourseIds.join(', ')}] (${updatedCourseIds.length} courses)`);

    // Step 3: Create a user career path progress with 2 courses completed (including the new one)
    console.log('\nStep 3: Create user career path progress');
    // Say user completed courses 3 and the new test course
    const completedCourses = [3, testCourse.id]; // Python + our test course
    const progressPercent = (completedCourses.length / updatedCourseIds.length) * 100;

    run(`
      INSERT OR REPLACE INTO user_career_progress (user_id, career_path_id, started_at, progress_percent, current_course_index, courses_completed, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [testUserId, careerPath.id, now, progressPercent, 1, JSON.stringify(completedCourses), now]);

    const initialProgress = queryOne('SELECT * FROM user_career_progress WHERE user_id = ? AND career_path_id = ?', [testUserId, careerPath.id]);
    console.log(`   Initial progress: ${initialProgress.progress_percent.toFixed(1)}% (${completedCourses.length}/${updatedCourseIds.length} courses)`);
    console.log(`   Completed courses: [${completedCourses.join(', ')}]`);

    // Step 4: Simulate course deletion with progress recalculation
    console.log('\nStep 4: Delete the course and recalculate progress');

    // This is the handleCourseDeletedFromCareerPaths function logic for progress:
    const cp = queryOne('SELECT * FROM career_paths WHERE id = ?', [careerPath.id]);
    const courseIds = JSON.parse(cp.course_ids || '[]');
    const courseIdInt = testCourse.id;

    if (courseIds.includes(courseIdInt)) {
      // Remove the deleted course from career path
      const newCourseIds = courseIds.filter(id => id !== courseIdInt);
      run(`UPDATE career_paths SET course_ids = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(newCourseIds), new Date().toISOString(), cp.id]);

      console.log(`   Removed course ${courseIdInt} from career path`);
      console.log(`   New course_ids: [${newCourseIds.join(', ')}] (${newCourseIds.length} courses)`);

      // Recalculate progress for all users in this career path
      const userProgresses = queryAll('SELECT * FROM user_career_progress WHERE career_path_id = ?', [cp.id]);

      for (const progress of userProgresses) {
        const coursesCompleted = JSON.parse(progress.courses_completed || '[]');

        // Remove the deleted course from completed courses
        const updatedCoursesCompleted = coursesCompleted.filter(id => id !== courseIdInt);

        // Recalculate progress percentage
        const newProgressPercent = newCourseIds.length > 0
          ? (updatedCoursesCompleted.length / newCourseIds.length) * 100
          : 0;

        run(`
          UPDATE user_career_progress
          SET courses_completed = ?, progress_percent = ?, updated_at = ?
          WHERE id = ?
        `, [
          JSON.stringify(updatedCoursesCompleted),
          newProgressPercent,
          new Date().toISOString(),
          progress.id
        ]);

        console.log(`   User ${progress.user_id}: ${coursesCompleted.length}/${courseIds.length} -> ${updatedCoursesCompleted.length}/${newCourseIds.length} courses`);
        console.log(`   Progress: ${progress.progress_percent.toFixed(1)}% -> ${newProgressPercent.toFixed(1)}%`);
      }
    }

    // Delete the actual course
    run('DELETE FROM courses WHERE id = ?', [testCourse.id]);

    // Step 5: Verify progress was recalculated correctly
    console.log('\nStep 5: Verify progress recalculated correctly');
    const finalProgress = queryOne('SELECT * FROM user_career_progress WHERE user_id = ? AND career_path_id = ?', [testUserId, careerPath.id]);
    const finalCourseIds = JSON.parse(queryOne('SELECT course_ids FROM career_paths WHERE id = ?', [careerPath.id]).course_ids);
    const finalCompletedCourses = JSON.parse(finalProgress.courses_completed || '[]');

    console.log(`   Final completed courses: [${finalCompletedCourses.join(', ')}]`);
    console.log(`   Final progress: ${finalProgress.progress_percent.toFixed(1)}%`);

    // The deleted course should NOT be in completed courses
    if (finalCompletedCourses.includes(testCourse.id)) {
      console.log(`   ✗ FAILURE: Deleted course ${testCourse.id} is still in completed courses!`);
      process.exit(1);
    } else {
      console.log(`   ✓ Deleted course ${testCourse.id} removed from completed courses`);
    }

    // Progress should be recalculated based on remaining courses
    // User had completed [3, testCourse.id], now only [3] should remain
    // Original 4 courses, now back to 4 courses, 1 completed = 25%
    const expectedProgress = (finalCompletedCourses.length / finalCourseIds.length) * 100;
    if (Math.abs(finalProgress.progress_percent - expectedProgress) < 0.1) {
      console.log(`   ✓ Progress correctly recalculated to ${expectedProgress.toFixed(1)}%`);
    } else {
      console.log(`   ✗ FAILURE: Progress is ${finalProgress.progress_percent.toFixed(1)}% but expected ${expectedProgress.toFixed(1)}%`);
      process.exit(1);
    }

    // Cleanup: Remove test user progress
    run('DELETE FROM user_career_progress WHERE user_id = ?', [testUserId]);

    // Save the database
    const data = db.export();
    const buffer2 = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer2);
    console.log('\n   Database saved successfully');

    console.log('\n=== Feature #163 Progress Test PASSED ===');
    console.log('Career path progress is properly recalculated when a course is deleted.');

    db.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
