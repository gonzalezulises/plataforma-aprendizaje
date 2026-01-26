// Check for certificates via API
const baseUrl = 'http://localhost:3000/api';

// First login as a test user
async function main() {
  try {
    // Login as user 1 (admin/student)
    const loginRes = await fetch(`${baseUrl}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 1 })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Logged in as:', loginData.user?.name);

    // Check certificates
    const certsRes = await fetch(`${baseUrl}/certificates`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const certs = await certsRes.json();
    console.log('User certificates:', JSON.stringify(certs, null, 2));

    // Check enrollments
    const enrollRes = await fetch(`${baseUrl}/enrollments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const enrolls = await enrollRes.json();
    console.log('User enrollments:', JSON.stringify(enrolls, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
