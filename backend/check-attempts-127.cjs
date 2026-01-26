const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');

const attempts = db.prepare('SELECT * FROM code_attempts WHERE challenge_id = 1 AND user_id = 1 ORDER BY created_at DESC').all();

console.log('Database attempts for challenge 1, user 1:');
attempts.forEach((a, i) => {
  console.log(`\nAttempt ${i+1}:`);
  console.log('  ID:', a.id);
  console.log('  Status:', a.status);
  console.log('  Code:', a.code.substring(0, 80));
  console.log('  Created:', a.created_at);
  console.log('  Execution Time:', a.execution_time_ms, 'ms');
});

console.log('\nTotal attempts:', attempts.length);
db.close();
