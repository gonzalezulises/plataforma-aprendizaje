const db = require('./backend/src/config/database.js');
const lessons = db.queryAll("SELECT id, title, content_type, content FROM lessons LIMIT 10");
lessons.forEach(l => {
  console.log(`Lesson ${l.id}: ${l.title} (${l.content_type})`);
  if (l.content) {
    try {
      const content = JSON.parse(l.content);
      const hasVideo = content.some && content.some(c => c.type === 'video');
      console.log(`  Has video content: ${hasVideo}`);
    } catch (e) {
      console.log(`  Content parse error: ${e.message}`);
    }
  }
});
