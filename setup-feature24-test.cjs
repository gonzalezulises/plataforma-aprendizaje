/**
 * Setup test data for Feature #24: Instructor can view all student submissions for their courses
 *
 * This script:
 * 1. Finds or creates the instructor user
 * 2. Assigns courses to the instructor
 * 3. Creates a student user
 * 4. Creates student submissions for the instructor's courses
 * 5. Creates another instructor with separate courses to test access restrictions
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, 'backend', 'data', 'learning_platform.db');
const db = new Database(dbPath);

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
  return { hash, salt };
}

console.log('=== Setting up Feature #24 Test Data ===\n');

// 1. Find or create instructor user
let instructor = db.prepare('SELECT * FROM users WHERE email = ?').get('instructor@test.com');
if (!instructor) {
  const { hash, salt } = hashPassword('password123');
  db.prepare('INSERT INTO users (email, name, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)').run(
    'instructor@test.com', 'Test Instructor', 'instructor_admin', hash, salt
  );
  instructor = db.prepare('SELECT * FROM users WHERE email = ?').get('instructor@test.com');
}
console.log('Instructor 1:', { id: instructor.id, name: instructor.name, email: instructor.email });

// 2. Find or create a second instructor (to test access restriction)
let instructor2 = db.prepare('SELECT * FROM users WHERE email = ?').get('instructor2@test.com');
if (!instructor2) {
  const { hash, salt } = hashPassword('password123');
  db.prepare('INSERT INTO users (email, name, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)').run(
    'instructor2@test.com', 'Other Instructor', 'instructor_admin', hash, salt
  );
  instructor2 = db.prepare('SELECT * FROM users WHERE email = ?').get('instructor2@test.com');
}
console.log('Instructor 2:', { id: instructor2.id, name: instructor2.name, email: instructor2.email });

// 3. Find or create a student user
let student = db.prepare('SELECT * FROM users WHERE email = ?').get('student@test.com');
if (!student) {
  const { hash, salt } = hashPassword('password123');
  db.prepare('INSERT INTO users (email, name, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)').run(
    'student@test.com', 'Test Student', 'student_free', hash, salt
  );
  student = db.prepare('SELECT * FROM users WHERE email = ?').get('student@test.com');
}
console.log('Student:', { id: student.id, name: student.name, email: student.email });

// 4. Assign courses to instructors
// Course 1 (Python) -> Instructor 1
// Course 2 (Data Science) -> Instructor 2
const courses = db.prepare('SELECT id, title, slug, instructor_id FROM courses LIMIT 4').all();
console.log('\nCourses before update:', courses);

// Assign first two courses to instructor 1
if (courses[0]) {
  db.prepare('UPDATE courses SET instructor_id = ? WHERE id = ?').run(instructor.id, courses[0].id);
  console.log(`Assigned course "${courses[0].title}" to Instructor 1`);
}
if (courses[2]) {
  db.prepare('UPDATE courses SET instructor_id = ? WHERE id = ?').run(instructor.id, courses[2].id);
  console.log(`Assigned course "${courses[2].title}" to Instructor 1`);
}

// Assign next two courses to instructor 2
if (courses[1]) {
  db.prepare('UPDATE courses SET instructor_id = ? WHERE id = ?').run(instructor2.id, courses[1].id);
  console.log(`Assigned course "${courses[1].title}" to Instructor 2`);
}
if (courses[3]) {
  db.prepare('UPDATE courses SET instructor_id = ? WHERE id = ?').run(instructor2.id, courses[3].id);
  console.log(`Assigned course "${courses[3].title}" to Instructor 2`);
}

const coursesAfter = db.prepare('SELECT id, title, slug, instructor_id FROM courses LIMIT 4').all();
console.log('\nCourses after update:', coursesAfter);

// 5. Create projects for courses if they don't exist
// Project for course 1 (instructor 1's course)
let project1 = db.prepare('SELECT * FROM projects WHERE course_id = ?').get(courses[0]?.slug || 'python-fundamentos');
if (!project1 && courses[0]) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO projects (course_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    courses[0].slug, 'Feature 24 Test Project - Instructor 1', 'Test project for Feature #24', now, now
  );
  project1 = db.prepare('SELECT * FROM projects WHERE title = ?').get('Feature 24 Test Project - Instructor 1');
}
console.log('\nProject for Instructor 1 course:', project1);

// Project for course 2 (instructor 2's course)
let project2 = db.prepare('SELECT * FROM projects WHERE course_id = ?').get(courses[1]?.slug || 'data-science-python');
if (!project2 && courses[1]) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO projects (course_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    courses[1].slug, 'Feature 24 Test Project - Instructor 2', 'Test project for Feature #24 - Other instructor', now, now
  );
  project2 = db.prepare('SELECT * FROM projects WHERE title = ?').get('Feature 24 Test Project - Instructor 2');
}
console.log('Project for Instructor 2 course:', project2);

// 6. Create student submissions for both projects
const now = new Date().toISOString();

// Submission for instructor 1's project
if (project1) {
  const existingSub1 = db.prepare('SELECT * FROM project_submissions WHERE project_id = ? AND user_id = ?').get(project1.id, student.id);
  if (!existingSub1) {
    db.prepare('INSERT INTO project_submissions (user_id, project_id, content, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      student.id, project1.id, 'TEST_SUBMISSION_INSTRUCTOR1_' + Date.now(), 'submitted', now, now
    );
    console.log('\nCreated submission for Instructor 1 project');
  } else {
    console.log('\nSubmission already exists for Instructor 1 project');
  }
}

// Submission for instructor 2's project
if (project2) {
  const existingSub2 = db.prepare('SELECT * FROM project_submissions WHERE project_id = ? AND user_id = ?').get(project2.id, student.id);
  if (!existingSub2) {
    db.prepare('INSERT INTO project_submissions (user_id, project_id, content, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      student.id, project2.id, 'TEST_SUBMISSION_INSTRUCTOR2_' + Date.now(), 'submitted', now, now
    );
    console.log('Created submission for Instructor 2 project');
  } else {
    console.log('Submission already exists for Instructor 2 project');
  }
}

// 7. Show final state
console.log('\n=== Final State ===');
const allProjects = db.prepare(`
  SELECT p.id, p.title, p.course_id, c.instructor_id, c.title as course_title
  FROM projects p
  LEFT JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
`).all();
console.log('\nAll Projects with Course Ownership:');
allProjects.forEach(p => {
  console.log(`  Project ${p.id}: "${p.title}" -> Course "${p.course_title}" (instructor_id: ${p.instructor_id})`);
});

const allSubmissions = db.prepare(`
  SELECT ps.id, ps.user_id, ps.project_id, ps.status, p.title as project_title, c.instructor_id
  FROM project_submissions ps
  JOIN projects p ON ps.project_id = p.id
  LEFT JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
`).all();
console.log('\nAll Submissions:');
allSubmissions.forEach(s => {
  console.log(`  Submission ${s.id}: User ${s.user_id} -> Project "${s.project_title}" (instructor_id: ${s.instructor_id}, status: ${s.status})`);
});

console.log('\n=== Expected Results ===');
console.log(`Instructor 1 (id=${instructor.id}) should see submissions for projects in courses they own`);
console.log(`Instructor 2 (id=${instructor2.id}) should see submissions for projects in courses they own`);
console.log('Each instructor should NOT see submissions from the other instructor\'s courses');

db.close();
console.log('\nSetup complete!');
