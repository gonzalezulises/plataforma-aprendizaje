const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');

// Add video content block to lesson 1
const videoContent = JSON.stringify({
  id: 'feature-81-test-video',
  title: 'Video: Introduccion a Python',
  src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  poster: null,
  alternativeContent: 'Esta leccion cubre los fundamentos de Python. Si el video no carga, puedes revisar el contenido de texto a continuacion.'
});

// Check if video content already exists for lesson 1
const existing = db.prepare(`
  SELECT id FROM lesson_content
  WHERE lesson_id = 1 AND type = 'video'
`).get();

if (existing) {
  console.log('Video content already exists for lesson 1, updating...');
  db.prepare(`
    UPDATE lesson_content
    SET content = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(videoContent, existing.id);
  console.log('Video content updated!');
} else {
  console.log('Adding video content to lesson 1...');
  db.prepare(`
    INSERT INTO lesson_content (lesson_id, type, content, order_index, created_at, updated_at)
    VALUES (1, 'video', ?, 0, datetime('now'), datetime('now'))
  `).run(videoContent);
  console.log('Video content added!');
}

// Verify the content
const result = db.prepare(`
  SELECT * FROM lesson_content WHERE lesson_id = 1
`).all();

console.log('\nLesson 1 content blocks:');
result.forEach(r => {
  console.log(`  - ID: ${r.id}, Type: ${r.type}, Order: ${r.order_index}`);
});

db.close();
console.log('\nDone!');
