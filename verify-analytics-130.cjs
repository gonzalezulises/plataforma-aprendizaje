const Database = require('./backend/node_modules/better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== Database Analytics Cross-Check ===\n');

// Count total students (users with student role)
const students = db.prepare("SELECT COUNT(*) as count FROM users WHERE role LIKE 'student%'").get();
console.log('Total Students:', students.count);

// Count total courses
const courses = db.prepare("SELECT COUNT(*) as count FROM courses").get();
console.log('Total Courses:', courses.count);

// Count enrollments
const enrollments = db.prepare("SELECT COUNT(*) as count FROM enrollments").get();
console.log('Total Enrollments:', enrollments.count);

// Count completed lessons
const completedLessons = db.prepare("SELECT COUNT(*) as count FROM lesson_progress WHERE status = 'completed'").get();
console.log('Completed Lessons:', completedLessons.count);

// Recent lesson completions
console.log('\n=== Recent Lesson Completions ===');
const recentLessons = db.prepare(`
  SELECT lp.lesson_id, u.name, u.email, lp.completed_at
  FROM lesson_progress lp
  JOIN users u ON lp.user_id = u.id
  WHERE lp.status = 'completed'
  ORDER BY lp.completed_at DESC
  LIMIT 5
`).all();
recentLessons.forEach(l => {
  console.log(`  Lesson #${l.lesson_id}: ${l.name} (${l.email}) - ${l.completed_at}`);
});

// Course statistics
console.log('\n=== Course Statistics ===');
const courseStats = db.prepare(`
  SELECT c.title,
         COUNT(DISTINCT e.id) as enrollments,
         (SELECT COUNT(*) FROM lesson_progress lp
          JOIN lessons l ON lp.lesson_id = l.id
          JOIN modules m ON l.module_id = m.id
          WHERE m.course_id = c.id AND lp.status = 'completed') as completed
  FROM courses c
  LEFT JOIN enrollments e ON c.id = e.course_id
  GROUP BY c.id
  ORDER BY enrollments DESC
  LIMIT 5
`).all();
courseStats.forEach(cs => {
  console.log(`  ${cs.title}: ${cs.enrollments} enrolled, ${cs.completed} lessons completed`);
});

db.close();
console.log('\n=== Verification Complete ===');
