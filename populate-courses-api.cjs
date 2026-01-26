// Feature #236: Populate database with 100 courses via API
const http = require('http');

// Course categories and levels for realistic data
const categories = ['Programacion', 'Data Science', 'Web Development', 'Machine Learning', 'DevOps', 'Seguridad', 'Cloud Computing', 'Mobile Development', 'Blockchain', 'Testing'];
const levels = ['Principiante', 'Intermedio', 'Avanzado'];
const topics = ['React', 'Python', 'JavaScript', 'SQL', 'Node.js', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'MongoDB', 'PostgreSQL', 'Git', 'Linux', 'TensorFlow', 'PyTorch', 'FastAPI', 'Django', 'Vue.js', 'Angular', 'TypeScript', 'Go', 'Rust', 'Java', 'Spring', 'GraphQL', 'REST API', 'Microservices', 'CI/CD', 'Terraform', 'Ansible'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Read cookies from file - these were saved when we logged in via browser
const fs = require('fs');
let sessionCookie = '';
try {
  const cookieFiles = fs.readdirSync('.').filter(f => f.startsWith('cookies-') && f.endsWith('.txt'));
  if (cookieFiles.length > 0) {
    // Use the most recent one
    const cookieContent = fs.readFileSync(cookieFiles[cookieFiles.length - 1], 'utf8');
    sessionCookie = cookieContent.trim();
    console.log('Using cookies from:', cookieFiles[cookieFiles.length - 1]);
  }
} catch (e) {
  console.log('No cookie file found, will try without auth');
}

function makeRequest(method, path, data, cookies = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (cookies) {
      options.headers['Cookie'] = cookies;
    }

    const req = http.request(options, (res) => {
      let body = '';
      // Capture set-cookie header for session
      const setCookie = res.headers['set-cookie'];
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), setCookie });
        } catch {
          resolve({ status: res.statusCode, data: body, setCookie });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('Feature #236: Populating database with 100 courses via API...\n');

  // Login first to get session
  console.log('Logging in as instructor...');
  const loginRes = await makeRequest('POST', '/api/auth/dev-login', {
    email: 'instructor@test.com',
    password: 'password123'
  });

  if (loginRes.status !== 200) {
    console.log('Login failed:', loginRes.status, loginRes.data);
    return;
  }

  // Extract session cookie
  let cookie = '';
  if (loginRes.setCookie) {
    cookie = loginRes.setCookie[0].split(';')[0];
    console.log('Got session cookie');
  }

  // Check current count
  const current = await makeRequest('GET', '/api/courses', null, cookie);
  const existingCount = current.data.total || 0;
  console.log(`Currently ${existingCount} courses in database`);

  const targetCount = 100;
  const coursesToCreate = targetCount - existingCount;

  if (coursesToCreate <= 0) {
    console.log(`Already have ${existingCount} courses, no need to add more.`);
    return;
  }

  console.log(`Creating ${coursesToCreate} new courses to reach 100 total...\n`);

  let created = 0;
  let failed = 0;

  for (let i = existingCount + 1; i <= targetCount; i++) {
    const topic1 = getRandomItem(topics);
    const topic2 = getRandomItem(topics.filter(t => t !== topic1));
    const category = getRandomItem(categories);
    const level = getRandomItem(levels);

    const course = {
      title: `PERF_TEST_${i.toString().padStart(3, '0')}: ${topic1} y ${topic2}`,
      description: `Curso de rendimiento #${i}. Aprende ${topic1} combinado con ${topic2}. Este es un curso de prueba para verificar el rendimiento de la plataforma con muchos cursos. Incluye ejemplos prácticos, ejercicios y proyectos del mundo real.`,
      category: category,
      level: level,
      is_premium: Math.random() > 0.7 ? 1 : 0,
      is_published: 1,
      duration_hours: Math.floor(Math.random() * 40) + 5
    };

    try {
      const result = await makeRequest('POST', '/api/courses', course, cookie);
      if (result.status === 201 || result.status === 200) {
        created++;
        if (created % 10 === 0) {
          console.log(`Created ${created}/${coursesToCreate} courses...`);
        }
      } else {
        console.log(`Failed to create course ${i}: ${result.status}`, result.data?.error || '');
        failed++;
      }
    } catch (err) {
      console.error(`Error creating course ${i}:`, err.message);
      failed++;
    }

    // Small delay to not overwhelm the server
    await new Promise(r => setTimeout(r, 30));
  }

  console.log(`\nDone! Created: ${created}, Failed: ${failed}`);

  // Verify final count
  const final = await makeRequest('GET', '/api/courses', null, cookie);
  console.log(`Final course count: ${final.data.total || 'unknown'}`);
}

main().catch(console.error);
