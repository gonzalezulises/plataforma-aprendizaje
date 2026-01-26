// Feature #236: Populate database with 100 courses for performance testing
const http = require('http');

// Course categories and levels for realistic data
const categories = ['Programacion', 'Data Science', 'Web Development', 'Machine Learning', 'DevOps', 'Seguridad', 'Cloud Computing', 'Mobile Development', 'Blockchain', 'Testing'];
const levels = ['Principiante', 'Intermedio', 'Avanzado'];
const topics = ['React', 'Python', 'JavaScript', 'SQL', 'Node.js', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'MongoDB', 'PostgreSQL', 'Git', 'Linux', 'TensorFlow', 'PyTorch', 'FastAPI', 'Django', 'Vue.js', 'Angular', 'TypeScript', 'Go', 'Rust', 'Java', 'Spring', 'GraphQL', 'REST API', 'Microservices', 'CI/CD', 'Terraform', 'Ansible'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3Atest-session-236'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// First, login to get a session
async function login() {
  const res = await makeRequest('POST', '/api/auth/login', {
    email: 'instructor@test.com',
    password: 'password123'
  });

  if (res.status !== 200) {
    console.log('Login failed, continuing anyway (may need auth bypass)');
  } else {
    console.log('Logged in successfully');
  }
}

async function createCourse(index) {
  const topic1 = getRandomItem(topics);
  const topic2 = getRandomItem(topics.filter(t => t !== topic1));
  const category = getRandomItem(categories);
  const level = getRandomItem(levels);

  const course = {
    title: `PERF_TEST_${index.toString().padStart(3, '0')}: ${topic1} y ${topic2}`,
    description: `Curso de rendimiento #${index}. Aprende ${topic1} combinado con ${topic2}. Este es un curso de prueba para verificar el rendimiento de la plataforma con muchos cursos. Incluye ejemplos prácticos, ejercicios y proyectos del mundo real.`,
    category: category,
    level: level,
    is_premium: Math.random() > 0.7 ? 1 : 0,
    is_published: 1,
    duration_hours: Math.floor(Math.random() * 40) + 5
  };

  const res = await makeRequest('POST', '/api/courses', course);
  return res;
}

async function main() {
  console.log('Feature #236: Populating database with 100 courses...\n');

  await login();

  // Check current count
  const current = await makeRequest('GET', '/api/courses');
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
    try {
      const result = await createCourse(i);
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
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nDone! Created: ${created}, Failed: ${failed}`);

  // Verify final count
  const final = await makeRequest('GET', '/api/courses');
  console.log(`Final course count: ${final.data.total || 'unknown'}`);
}

main().catch(console.error);
