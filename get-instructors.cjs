const db = require('./backend/src/config/database.js');
db.all('SELECT id, email, role FROM users WHERE role = "instructor" LIMIT 5', (err, rows) => {
  if (err) console.error(err);
  else console.log(JSON.stringify(rows, null, 2));
  db.close();
});
