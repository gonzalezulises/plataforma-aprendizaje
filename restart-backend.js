// Script to test if backend needs restart
const http = require('http');

const testEndpoint = (path) => {
  return new Promise((resolve) => {
    const options = { hostname: 'localhost', port: 3001, path, method: 'GET', timeout: 5000 };
    const req = http.request(options, (res) => {
      resolve({ status: res.statusCode, path });
    });
    req.on('error', (e) => resolve({ status: 'error', path, message: e.message }));
    req.on('timeout', () => resolve({ status: 'timeout', path }));
    req.end();
  });
};

async function main() {
  console.log('Testing backend endpoints...');

  const health = await testEndpoint('/api/health');
  console.log('Health:', health.status);

  const dashboard = await testEndpoint('/api/analytics/dashboard');
  console.log('Dashboard:', dashboard.status);

  const exportAll = await testEndpoint('/api/analytics/export-all');
  console.log('Export-all:', exportAll.status);

  if (exportAll.status === 404) {
    console.log('\n*** Backend needs restart to pick up new export routes ***');
    console.log('Please restart the backend server manually.');
  }
}

main();
