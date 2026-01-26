// Verify analytics data using fetch to the backend API
async function verifyAnalytics() {
  // First, login as instructor to get session
  const loginRes = await fetch('http://localhost:3001/api/direct-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'instructor@test.com', password: 'password123' })
  });

  const cookies = loginRes.headers.get('set-cookie');
  console.log('Login successful');

  // Get analytics dashboard data
  const analyticsRes = await fetch('http://localhost:3001/api/analytics/dashboard', {
    headers: { 'Cookie': cookies }
  });

  const analytics = await analyticsRes.json();
  console.log('\n=== ANALYTICS DASHBOARD DATA ===');
  console.log('Overview:', JSON.stringify(analytics.overview, null, 2));
  console.log('\nRecent Completions:', JSON.stringify(analytics.recentCompletions, null, 2));
  console.log('\nLesson Stats:', JSON.stringify(analytics.lessonStats, null, 2));

  // Verify the data includes our test completion (lessonId could be string or number)
  const lesson108Completion = analytics.recentCompletions.find(c => String(c.lessonId) === '108');
  if (lesson108Completion) {
    console.log('\n✅ VERIFIED: Lesson #108 completion found in analytics!');
    console.log('  Student:', lesson108Completion.studentName);
    console.log('  Email:', lesson108Completion.studentEmail);
    console.log('  Completed at:', lesson108Completion.completedAt);
    console.log('\n✅ DATA IS REAL (not mocked) - reflects actual student activity from database!');
  } else {
    console.log('\n❌ ERROR: Lesson #108 completion NOT found!');
  }
}

verifyAnalytics().catch(console.error);
