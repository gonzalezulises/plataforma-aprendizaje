const {initDatabase, queryAll} = require('./src/config/database.js');
initDatabase().then(() => {
  console.log('Modules for course 298:', queryAll('SELECT * FROM modules WHERE course_id = 298'));
});
