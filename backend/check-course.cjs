const {initDatabase, queryOne, queryAll} = require('./src/config/database.js');
initDatabase().then(() => {
  console.log('Course 298:', queryOne('SELECT id, title, slug, is_published FROM courses WHERE id = 298'));
  console.log('All courses with test in name:', queryAll("SELECT id, title, slug, is_published FROM courses WHERE title LIKE '%test%' OR slug LIKE '%test%'"));
});
