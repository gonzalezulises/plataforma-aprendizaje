const Database = require('better-sqlite3');
const db = new Database('backend/database.sqlite');

// Check existing certificates
const certs = db.prepare('SELECT * FROM certificates LIMIT 5').all();
console.log('Existing certificates:', JSON.stringify(certs, null, 2));

// If no certificates, create a test one
if (certs.length === 0) {
  console.log('\nNo certificates found. Creating a test certificate...');

  // Check if we have any enrollments
  const enrollment = db.prepare(`
    SELECT e.*, u.name as user_name, c.title as course_title
    FROM enrollments e
    JOIN users u ON e.user_id = u.id
    JOIN courses c ON e.course_id = c.id
    LIMIT 1
  `).get();

  if (enrollment) {
    const crypto = require('crypto');
    const verificationCode = crypto.randomBytes(12).toString('hex').toUpperCase();

    try {
      db.prepare(`
        INSERT INTO certificates (user_id, course_id, user_name, course_title, verification_code)
        VALUES (?, ?, ?, ?, ?)
      `).run(enrollment.user_id, enrollment.course_id, enrollment.user_name || 'Test User', enrollment.course_title, verificationCode);

      console.log('Created test certificate with code:', verificationCode);
    } catch (err) {
      console.log('Error creating certificate:', err.message);
    }
  } else {
    console.log('No enrollments found to create certificate for');
  }
}

// Get final list
const finalCerts = db.prepare('SELECT * FROM certificates LIMIT 5').all();
console.log('\nFinal certificates list:', JSON.stringify(finalCerts, null, 2));

db.close();
