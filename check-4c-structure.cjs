const Database = require('better-sqlite3');
const db = new Database('backend/learning.db');

// Get lessons for course 42
const lessons = db.prepare(`
  SELECT l.id, l.title, l.structure_4c
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = 42
  ORDER BY m.order_index, l.order_index
  LIMIT 5
`).all();

console.log('Lessons with 4C structure for Course 42:');
lessons.forEach((lesson, i) => {
  console.log(`\n--- Lesson ${i+1}: ${lesson.title} ---`);
  if (lesson.structure_4c && lesson.structure_4c !== '{}') {
    try {
      const structure = JSON.parse(lesson.structure_4c);
      console.log('4C Structure Keys:', Object.keys(structure));
      if (structure.connections) console.log('  - Connections: ✓', Object.keys(structure.connections));
      if (structure.concepts) console.log('  - Concepts: ✓', Object.keys(structure.concepts));
      if (structure.concrete_practice) console.log('  - Concrete Practice: ✓', Object.keys(structure.concrete_practice));
      if (structure.conclusion) console.log('  - Conclusion: ✓', Object.keys(structure.conclusion));
    } catch (e) {
      console.log('Error parsing:', e.message);
    }
  } else {
    console.log('No 4C structure or empty');
  }
});

db.close();
