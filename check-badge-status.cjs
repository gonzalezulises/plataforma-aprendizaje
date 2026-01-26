const sqlite = require('better-sqlite3');
const db = new sqlite('backend/learning.db');

// Get user
const user = db.prepare("SELECT id, name, email, role FROM users WHERE email LIKE '%prueba%' OR email LIKE '%test%'").get();
console.log('User:', JSON.stringify(user, null, 2));

// Get courses in Python Developer path
const courses = db.prepare('SELECT id, title FROM courses WHERE id IN (1, 2)').all();
console.log('Courses:', JSON.stringify(courses, null, 2));

// Check enrollments
if (user) {
  const enrollments = db.prepare('SELECT * FROM enrollments WHERE user_id = ?').all(user.id);
  console.log('Enrollments:', JSON.stringify(enrollments, null, 2));

  // Check career path progress
  const careerProgress = db.prepare('SELECT * FROM user_career_progress WHERE user_id = ?').all(user.id);
  console.log('Career Progress:', JSON.stringify(careerProgress, null, 2));

  // Check career badges
  const badges = db.prepare('SELECT * FROM career_badges WHERE user_id = ?').all(user.id);
  console.log('Badges:', JSON.stringify(badges, null, 2));
}

db.close();
