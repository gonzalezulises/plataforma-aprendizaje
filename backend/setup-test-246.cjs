/**
 * Setup script for Feature #246 testing
 * Creates a course with multiple modules and lessons
 */

const { initDatabase, queryOne, queryAll, run, saveDatabase } = require('./src/config/database.js');

async function setup() {
  console.log('Setting up Feature #246 test data...');

  await initDatabase();

  // Find or create the test course
  let course = queryOne("SELECT * FROM courses WHERE slug = 'test-course-feature-246'");

  if (!course) {
    console.log('Creating test course...');
    run(`
      INSERT INTO courses (title, slug, description, category, level, is_published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `, ['Test Course Feature 246', 'test-course-feature-246', 'Course for testing module progress', 'Testing', 'Principiante']);
    course = queryOne("SELECT * FROM courses WHERE slug = 'test-course-feature-246'");
  }

  console.log('Course ID:', course.id);

  // Publish the course
  run('UPDATE courses SET is_published = 1 WHERE id = ?', [course.id]);

  // Create Module 1 with 3 lessons
  let module1 = queryOne('SELECT * FROM modules WHERE course_id = ? AND title = ?', [course.id, 'Module 1: Introduction']);
  if (!module1) {
    run(`
      INSERT INTO modules (course_id, title, description, order_index, created_at, updated_at)
      VALUES (?, ?, ?, 0, datetime('now'), datetime('now'))
    `, [course.id, 'Module 1: Introduction', 'Introduction module']);
    module1 = queryOne('SELECT * FROM modules WHERE course_id = ? AND title = ?', [course.id, 'Module 1: Introduction']);
  }
  console.log('Module 1 ID:', module1.id);

  // Create lessons for Module 1
  const module1Lessons = [
    { title: 'Lesson 1.1: Welcome', order_index: 0 },
    { title: 'Lesson 1.2: Getting Started', order_index: 1 },
    { title: 'Lesson 1.3: First Steps', order_index: 2 }
  ];

  for (const lesson of module1Lessons) {
    const existing = queryOne('SELECT * FROM lessons WHERE module_id = ? AND title = ?', [module1.id, lesson.title]);
    if (!existing) {
      run(`
        INSERT INTO lessons (module_id, title, order_index, content_type, duration_minutes, created_at, updated_at)
        VALUES (?, ?, ?, 'text', 10, datetime('now'), datetime('now'))
      `, [module1.id, lesson.title, lesson.order_index]);
    }
  }

  // Create Module 2 with 2 lessons
  let module2 = queryOne('SELECT * FROM modules WHERE course_id = ? AND title = ?', [course.id, 'Module 2: Basics']);
  if (!module2) {
    run(`
      INSERT INTO modules (course_id, title, description, order_index, created_at, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `, [course.id, 'Module 2: Basics', 'Basic concepts']);
    module2 = queryOne('SELECT * FROM modules WHERE course_id = ? AND title = ?', [course.id, 'Module 2: Basics']);
  }
  console.log('Module 2 ID:', module2.id);

  // Create lessons for Module 2
  const module2Lessons = [
    { title: 'Lesson 2.1: Core Concepts', order_index: 0 },
    { title: 'Lesson 2.2: Practice', order_index: 1 }
  ];

  for (const lesson of module2Lessons) {
    const existing = queryOne('SELECT * FROM lessons WHERE module_id = ? AND title = ?', [module2.id, lesson.title]);
    if (!existing) {
      run(`
        INSERT INTO lessons (module_id, title, order_index, content_type, duration_minutes, created_at, updated_at)
        VALUES (?, ?, ?, 'text', 15, datetime('now'), datetime('now'))
      `, [module2.id, lesson.title, lesson.order_index]);
    }
  }

  // Create Module 3 with 2 lessons
  let module3 = queryOne('SELECT * FROM modules WHERE course_id = ? AND title = ?', [course.id, 'Module 3: Advanced']);
  if (!module3) {
    run(`
      INSERT INTO modules (course_id, title, description, order_index, created_at, updated_at)
      VALUES (?, ?, ?, 2, datetime('now'), datetime('now'))
    `, [course.id, 'Module 3: Advanced', 'Advanced topics']);
    module3 = queryOne('SELECT * FROM modules WHERE course_id = ? AND title = ?', [course.id, 'Module 3: Advanced']);
  }
  console.log('Module 3 ID:', module3.id);

  // Create lessons for Module 3
  const module3Lessons = [
    { title: 'Lesson 3.1: Deep Dive', order_index: 0 },
    { title: 'Lesson 3.2: Final Project', order_index: 1 }
  ];

  for (const lesson of module3Lessons) {
    const existing = queryOne('SELECT * FROM lessons WHERE module_id = ? AND title = ?', [module3.id, lesson.title]);
    if (!existing) {
      run(`
        INSERT INTO lessons (module_id, title, order_index, content_type, duration_minutes, created_at, updated_at)
        VALUES (?, ?, ?, 'text', 20, datetime('now'), datetime('now'))
      `, [module3.id, lesson.title, lesson.order_index]);
    }
  }

  // Print summary
  const allModules = queryAll('SELECT * FROM modules WHERE course_id = ? ORDER BY order_index', [course.id]);
  console.log('\n=== Course Structure ===');
  for (const mod of allModules) {
    const lessons = queryAll('SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index', [mod.id]);
    console.log(`\nModule: ${mod.title} (ID: ${mod.id})`);
    for (const les of lessons) {
      console.log(`  - ${les.title} (ID: ${les.id})`);
    }
  }

  // Save database to disk
  saveDatabase();
  console.log('\nDatabase saved to disk!');

  console.log('\n✅ Setup complete!');
  console.log(`\nTest URL: http://localhost:5173/course/test-course-feature-246`);
}

setup().catch(console.error);
