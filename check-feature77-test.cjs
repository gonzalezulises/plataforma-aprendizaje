const http = require('http');

// First, let's create a simple career path with just one completed course
const createCareerPath = () => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      name: 'TEST_F77_Quick Badge Path',
      slug: 'test-f77-quick-badge',
      description: 'Test career path for Feature #77 badge testing',
      icon: 'trophy',
      color: '#F59E0B',
      course_ids: [24], // TEST_120_DevOps Fundamentals - already completed
      order_index: 99,
      is_published: 1
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/career-paths',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Create career path response:', res.statusCode, body);
        resolve(JSON.parse(body));
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

createCareerPath().then(result => {
  console.log('Career path result:', result);
}).catch(err => {
  console.error('Error:', err);
});
