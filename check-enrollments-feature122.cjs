const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'backend', 'database.sqlite'));

// Get a user to test with
const users = db.prepare('SELECT id, name, email FROM users WHERE role = ? LIMIT 5').all('student');
console.log('Available students:');
users.forEach(u => console.log(`  ID ${u.id}: ${u.name} (${u.email})`));

// Get a course to test with
const courses = db.prepare('SELECT id, title, slug FROM courses WHERE published = 1 LIMIT 5').all();
console.log('\nAvailable courses:');
courses.forEach(c => console.log(`  ID ${c.id}: ${c.title} (slug: ${c.slug})`));

// Get existing enrollments for test users
if (users.length > 0) {
  const userId = users[0].id;
  const enrollments = db.prepare(`
    SELECT e.id, e.course_id, e.completed, c.title
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.user_id = ?
  `).all(userId);
  console.log(`\nEnrollments for user ${userId} (${users[0].name}):`);
  if (enrollments.length === 0) {
    console.log('  No enrollments found');
  } else {
    enrollments.forEach(e => console.log(`  Course ${e.course_id}: ${e.title} (completed: ${e.completed})`));
  }
}

// Check course IDs that user is NOT enrolled in
if (users.length > 0 && courses.length > 0) {
  const userId = users[0].id;
  const notEnrolled = db.prepare(`
    SELECT c.id, c.title, c.slug
    FROM courses c
    WHERE c.published = 1
    AND c.id NOT IN (SELECT course_id FROM enrollments WHERE user_id = ?)
    LIMIT 3
  `).all(userId);
  console.log(`\nCourses user ${userId} is NOT enrolled in:`);
  notEnrolled.forEach(c => console.log(`  ID ${c.id}: ${c.title} (slug: ${c.slug})`));
}

db.close();
