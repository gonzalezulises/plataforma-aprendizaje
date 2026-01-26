const {initDatabase, run, queryOne} = require('./src/config/database.js');
initDatabase().then(() => {
  run('UPDATE courses SET is_published = 1 WHERE id = 298');
  console.log('Published!', queryOne('SELECT id, title, is_published FROM courses WHERE id = 298'));
});
