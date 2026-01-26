// Feature #236: Create 100 complete courses with modules and lessons via API
const http = require('http');

const categories = ['Programacion', 'Data Science', 'Web Development', 'Machine Learning', 'DevOps', 'Seguridad', 'Cloud Computing', 'Mobile Development', 'Blockchain', 'Testing'];
const levels = ['Principiante', 'Intermedio', 'Avanzado'];
const topics = ['React', 'Python', 'JavaScript', 'SQL', 'Node.js', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'MongoDB', 'PostgreSQL', 'Git', 'Linux', 'TensorFlow', 'PyTorch', 'FastAPI', 'Django', 'Vue.js', 'Angular', 'TypeScript', 'Go', 'Rust', 'Java', 'Spring', 'GraphQL', 'REST API', 'Microservices', 'CI/CD', 'Terraform', 'Ansible'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeRequest(method, path, data, cookies = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (cookies) options.headers['Cookie'] = cookies;

    const req = http.request(options, (res) => {
      let body = '';
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
  console.log('Feature #236: Creating 100 complete courses via API...\n');

  // Login
  const loginRes = await makeRequest('POST', '/api/auth/dev-login', { email: 'instructor@test.com', password: 'password123' });
  if (loginRes.status !== 200) {
    console.log('Login failed:', loginRes.status);
    return;
  }
  const cookie = loginRes.setCookie ? loginRes.setCookie[0].split(';')[0] : '';
  console.log('Logged in successfully');

  // Check current count
  const current = await makeRequest('GET', '/api/courses?limit=200', null, cookie);
  const existingCount = current.data?.courses?.length || 0;
  console.log(`Currently ${existingCount} published courses`);

  const targetCount = 100;
  const coursesToCreate = targetCount - existingCount;

  if (coursesToCreate <= 0) {
    console.log(`Already have ${existingCount} courses, no need to add more.`);
    return;
  }

  console.log(`Creating ${coursesToCreate} complete courses...\n`);

  let created = 0;
  let failed = 0;

  for (let i = existingCount + 1; i <= targetCount; i++) {
    const topic1 = getRandomItem(topics);
    const topic2 = getRandomItem(topics.filter(t => t !== topic1));
    const category = getRandomItem(categories);
    const level = getRandomItem(levels);

    try {
      // 1. Create course
      const courseRes = await makeRequest('POST', '/api/courses', {
        title: `PERF_${i.toString().padStart(3, '0')}: ${topic1} y ${topic2}`,
        description: `Curso de rendimiento #${i}. Aprende ${topic1} combinado con ${topic2}. Incluye ejemplos prácticos y proyectos del mundo real.`,
        category: category,
        level: level,
        is_premium: Math.random() > 0.7 ? 1 : 0,
        duration_hours: Math.floor(Math.random() * 40) + 5
      }, cookie);

      if (courseRes.status !== 201) {
        console.log(`Failed to create course ${i}:`, courseRes.data?.error);
        failed++;
        continue;
      }

      const courseId = courseRes.data.course.id;

      // 2. Create a module
      const moduleRes = await makeRequest('POST', `/api/courses/${courseId}/modules`, {
        title: 'Modulo 1: Introduccion',
        description: 'Modulo introductorio'
      }, cookie);

      if (moduleRes.status !== 201) {
        console.log(`Failed to create module for course ${i}:`, moduleRes.data?.error);
        failed++;
        continue;
      }

      const moduleId = moduleRes.data.module.id;

      // 3. Create a lesson
      const lessonRes = await makeRequest('POST', `/api/courses/${courseId}/modules/${moduleId}/lessons`, {
        title: 'Leccion 1: Primeros pasos',
        description: 'Leccion introductoria',
        content_type: 'text',
        duration_minutes: 15
      }, cookie);

      if (lessonRes.status !== 201) {
        console.log(`Failed to create lesson for course ${i}:`, lessonRes.data?.error);
        failed++;
        continue;
      }

      // 4. Publish the course
      const publishRes = await makeRequest('POST', `/api/courses/${courseId}/publish`, {}, cookie);

      if (publishRes.status !== 200) {
        console.log(`Failed to publish course ${i}:`, publishRes.data?.error);
        failed++;
        continue;
      }

      created++;
      if (created % 10 === 0) {
        console.log(`Created and published ${created}/${coursesToCreate} courses...`);
      }
    } catch (err) {
      console.error(`Error with course ${i}:`, err.message);
      failed++;
    }

    // Small delay
    await new Promise(r => setTimeout(r, 20));
  }

  console.log(`\nDone! Created: ${created}, Failed: ${failed}`);

  // Verify final count
  const final = await makeRequest('GET', '/api/courses?limit=200', null, cookie);
  console.log(`Final published course count: ${final.data?.courses?.length || 'unknown'}`);
}

main().catch(console.error);
