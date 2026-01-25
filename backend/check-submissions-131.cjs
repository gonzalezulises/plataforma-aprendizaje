const Database = require('better-sqlite3');
const db = new Database('./data/skillforge.db', { readonly: true });

// Check for project submissions
const submissions = db.prepare('SELECT * FROM project_submissions LIMIT 5').all();
console.log('Project submissions:', JSON.stringify(submissions, null, 2));

// Check for instructor users
const instructors = db.prepare("SELECT id, email, role FROM users WHERE role = 'instructor' OR role = 'admin' LIMIT 3").all();
console.log('\nInstructor users:', JSON.stringify(instructors, null, 2));

db.close();
