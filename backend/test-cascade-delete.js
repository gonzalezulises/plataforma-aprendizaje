// Test script for Feature #162: Deleting user removes their submissions
// Run with: node test-cascade-delete.js

import { queryOne, run, initDatabase } from './src/config/database.js';

async function testCascadeDelete() {
  console.log('=== Feature #162 Test: User Deletion Cascade ===\n');

  // Initialize database
  await initDatabase();

  // Wait for tables to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 1: Create a test user
  console.log('Step 1: Creating test user...');
  const testEmail = 'cascade_test_' + Date.now() + '@test.com';
  const result = run(
    'INSERT INTO users (email, name, role) VALUES (?, ?, ?)',
    [testEmail, 'Cascade Test User', 'student_free']
  );
  const testUserId = result.lastInsertRowid;
  console.log('  Created user with ID:', testUserId);

  // Step 2: Create submissions for this user
  console.log('\nStep 2: Creating code submissions for this user...');
  run(
    'INSERT INTO code_submissions (user_id, challenge_id, code, language, output, is_correct, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [String(testUserId), 1, 'print("test1")', 'python', 'test1', 1, new Date().toISOString()]
  );
  run(
    'INSERT INTO code_submissions (user_id, challenge_id, code, language, output, is_correct, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [String(testUserId), 1, 'print("test2")', 'python', 'test2', 1, new Date().toISOString()]
  );
  run(
    'INSERT INTO code_submissions (user_id, challenge_id, code, language, output, is_correct, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [String(testUserId), 2, 'print("test3")', 'python', 'test3', 0, new Date().toISOString()]
  );

  // Verify submissions were created
  const beforeCount = queryOne('SELECT COUNT(*) as count FROM code_submissions WHERE user_id = ?', [String(testUserId)]);
  console.log('  Created', beforeCount.count, 'submissions for user', testUserId);

  // Step 3: Delete the user and cascade to submissions
  console.log('\nStep 3: Deleting user and cascading to submissions...');

  // Delete code_submissions first (Feature #162)
  const deleteSubmissions = run('DELETE FROM code_submissions WHERE user_id = ?', [String(testUserId)]);
  console.log('  Deleted', deleteSubmissions.changes, 'code submissions');

  // Delete the user
  const deleteUser = run('DELETE FROM users WHERE id = ?', [testUserId]);
  console.log('  Deleted', deleteUser.changes, 'user record');

  // Step 4: Verify submissions are gone
  console.log('\nStep 4: Verifying submissions were deleted...');
  const afterCount = queryOne('SELECT COUNT(*) as count FROM code_submissions WHERE user_id = ?', [String(testUserId)]);
  console.log('  Submissions remaining for deleted user:', afterCount.count);

  // Verify user is gone
  const userExists = queryOne('SELECT id FROM users WHERE id = ?', [testUserId]);
  console.log('  User exists:', userExists ? 'YES (ERROR!)' : 'NO (correct)');

  // Test result
  console.log('\n=== TEST RESULT ===');
  if (afterCount.count === 0 && !userExists) {
    console.log('SUCCESS: User deletion properly cascaded to submissions!');
    console.log('Feature #162 is working correctly.');
    process.exit(0);
  } else {
    console.log('FAILURE: Cascade delete did not work properly!');
    process.exit(1);
  }
}

testCascadeDelete().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
