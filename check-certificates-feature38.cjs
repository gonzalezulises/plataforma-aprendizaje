const Database = require('better-sqlite3');
const db = new Database('./backend/data/database.sqlite');

console.log('=== Checking Certificates ===');
const certs = db.prepare('SELECT * FROM certificates LIMIT 5').all();
console.log('Certificates:', JSON.stringify(certs, null, 2));

if (certs.length > 0) {
  console.log('\n=== First Certificate Verification Code ===');
  console.log('Code:', certs[0].verification_code);
}

db.close();
