// Setup premium course content for Feature #15 testing
const fetch = require('node-fetch');

async function setupPremiumContent() {
  // First, login as instructor
  const loginRes = await fetch('http://localhost:3001/api/direct-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'instructor@test.com',
      password: 'password123'
    })
  });

  const cookies = loginRes.headers.raw()['set-cookie'];
  const sessionCookie = cookies ? cookies[0].split(';')[0] : '';
  console.log('Login response:', await loginRes.json());
  console.log('Session cookie:', sessionCookie);

  // Create a module for premium course (id: 2 - Data Science con Python)
  const moduleRes = await fetch('http://localhost:3001/api/courses/2/modules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    },
    body: JSON.stringify({
      title: 'Premium Module - Data Analysis Basics',
      description: 'This is premium content for testing Feature #15',
      order_index: 0
    })
  });

  const moduleData = await moduleRes.json();
  console.log('Module creation response:', moduleData);

  if (!moduleData.module) {
    console.log('Failed to create module');
    return;
  }

  const moduleId = moduleData.module.id;

  // Create a lesson for the module
  const lessonRes = await fetch(`http://localhost:3001/api/courses/2/modules/${moduleId}/lessons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    },
    body: JSON.stringify({
      title: 'Premium Lesson - Intro to Data Science',
      description: 'This premium lesson content should be blocked for free users',
      order_index: 0,
      content_type: 'video',
      duration_minutes: 30
    })
  });

  const lessonData = await lessonRes.json();
  console.log('Lesson creation response:', lessonData);

  if (!lessonData.lesson) {
    console.log('Failed to create lesson');
    return;
  }

  const lessonId = lessonData.lesson.id;

  // Add content to the lesson
  const contentRes = await fetch(`http://localhost:3001/api/courses/2/modules/${moduleId}/lessons/${lessonId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    },
    body: JSON.stringify({
      type: 'text',
      content: {
        html: '<h1>Premium Content</h1><p>This is exclusive premium content that free users should NOT be able to see. If you see this as a free user, Feature #15 is FAILING!</p>'
      },
      order_index: 0
    })
  });

  const contentData = await contentRes.json();
  console.log('Content creation response:', contentData);

  console.log('\n=== Setup Complete ===');
  console.log('Premium course (id: 2) now has:');
  console.log('- Module ID:', moduleId);
  console.log('- Lesson ID:', lessonId);
  console.log('\nTest Feature #15 by:');
  console.log('1. Log in as testuser@example.com (student_free)');
  console.log('2. Navigate to /lesson/' + lessonId);
  console.log('3. Verify access is denied with upgrade prompt');
}

setupPremiumContent().catch(console.error);
