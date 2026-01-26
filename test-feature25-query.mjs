// Test the feature 25 query directly
import Database from 'better-sqlite3';

const db = new Database('./backend/database.sqlite');

const instructorId = 2;

// The query used in projects.js
const query = `
  SELECT ps.*, p.title as project_title, p.course_id, c.title as course_title, c.instructor_id as course_instructor_id
  FROM project_submissions ps
  JOIN projects p ON ps.project_id = p.id
  JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
  WHERE c.instructor_id = ?
  ORDER BY ps.submitted_at DESC
`;

console.log('Running query for instructor:', instructorId);
console.log('Query:', query);

const submissions = db.prepare(query).all(instructorId);

console.log('\nFound', submissions.length, 'submissions:');
submissions.forEach(s => {
  console.log(`  Submission ${s.id}: project_id=${s.project_id}, course_id="${s.course_id}", course_instructor_id=${s.course_instructor_id}`);
});

// Also check what courses have instructor_id = 2
console.log('\n\nCourses with instructor_id = 2:');
const courses = db.prepare('SELECT id, title, slug, instructor_id FROM courses WHERE instructor_id = ?').all(instructorId);
courses.forEach(c => {
  console.log(`  Course ${c.id}: "${c.title}" (slug: ${c.slug})`);
});

// Check project 7's course join
console.log('\n\nProject 7 course join test:');
const project7 = db.prepare(`
  SELECT p.id, p.course_id, c.id as joined_course_id, c.title as course_title, c.instructor_id
  FROM projects p
  JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
  WHERE p.id = 7
`).get();
console.log('Project 7 join result:', project7);

db.close();
