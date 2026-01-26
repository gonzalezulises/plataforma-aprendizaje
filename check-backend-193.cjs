const http = require('http');

http.get('http://localhost:3002/api/health', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Backend OK:', data));
}).on('error', (e) => console.log('Backend Error:', e.message));
