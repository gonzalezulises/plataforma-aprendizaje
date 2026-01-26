// Test the feature 25 query directly using sql.js
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'learning.db');

async function test() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  const instructorId = 2;

  function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  // Check courses with instructor_id = 2
  console.log('=== Courses with instructor_id = 2 ===');
  const courses2 = queryAll('SELECT id, title, slug, instructor_id FROM courses WHERE instructor_id = ?', [instructorId]);
  courses2.forEach(c => console.log(`  Course ${c.id}: "${c.title}" (instructor_id=${c.instructor_id})`));

  // Check courses with instructor_id = 99
  console.log('\n=== Courses with instructor_id = 99 ===');
  const courses99 = queryAll('SELECT id, title, slug, instructor_id FROM courses WHERE instructor_id = ?', [99]);
  courses99.forEach(c => console.log(`  Course ${c.id}: "${c.title}" (instructor_id=${c.instructor_id})`));

  // Check projects
  console.log('\n=== Projects ===');
  const projects = queryAll('SELECT id, course_id, title FROM projects');
  projects.forEach(p => console.log(`  Project ${p.id}: course_id="${p.course_id}" - "${p.title}"`));

  // Test join for project 7
  console.log('\n=== Project 7 course join test ===');
  const project7Join = queryAll(`
    SELECT p.id, p.course_id, c.id as joined_course_id, c.title as course_title, c.instructor_id
    FROM projects p
    JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
    WHERE p.id = 7
  `);
  console.log('Project 7 join result:', project7Join);

  // The main query
  console.log('\n=== Main query for instructor 2 ===');
  const query = `
    SELECT ps.id, ps.project_id, p.title as project_title, p.course_id, c.title as course_title, c.instructor_id as course_instructor_id
    FROM project_submissions ps
    JOIN projects p ON ps.project_id = p.id
    JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
    WHERE c.instructor_id = ?
    ORDER BY ps.submitted_at DESC
  `;
  const submissions = queryAll(query, [instructorId]);
  console.log(`Found ${submissions.length} submissions:`);
  submissions.forEach(s => {
    console.log(`  Submission ${s.id}: project_id=${s.project_id}, course_id="${s.course_id}", course_instructor_id=${s.course_instructor_id}`);
  });

  db.close();
}

test().catch(console.error);
