// Script to start backend on port 3002 for testing Feature #201
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a modified .env file with PORT=3002
const envPath = path.join(__dirname, 'backend', '.env');
let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

// Update or add PORT
if (envContent.includes('PORT=')) {
  envContent = envContent.replace(/PORT=\d+/, 'PORT=3002');
} else {
  envContent += '\nPORT=3002';
}

fs.writeFileSync(envPath, envContent);
console.log('Updated .env with PORT=3002');

// Start the server
const server = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3002' }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
});

process.on('SIGINT', () => {
  server.kill();
  process.exit();
});
