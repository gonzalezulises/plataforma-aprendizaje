import { initDatabase, run, queryAll } from './src/config/database.js';

async function test() {
  await initDatabase();

  console.log('Testing run function...');
  const result = run(`INSERT INTO quizzes (title, description, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ['Direct Test Quiz', 'Testing lastInsertRowid', new Date().toISOString(), new Date().toISOString()]);

  console.log('Result:', result);
  console.log('lastInsertRowid type:', typeof result.lastInsertRowid);
  console.log('lastInsertRowid value:', result.lastInsertRowid);

  // Verify the quiz was inserted
  const quizzes = queryAll('SELECT id, title FROM quizzes ORDER BY id DESC LIMIT 3');
  console.log('Latest quizzes:', quizzes);
}

test().catch(console.error);
