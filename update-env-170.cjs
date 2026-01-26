const fs = require('fs');
const envPath = 'C:/Users/gonza/claude-projects/frontend/.env';
const newContent = `VITE_API_URL=http://localhost:3002/api
VITE_WS_URL=ws://localhost:3002/ws
VITE_APP_NAME=Plataforma de Aprendizaje
`;
fs.writeFileSync(envPath, newContent);
console.log('Updated .env to use port 3002');
